import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PeriodCloseService } from 'src/period-close/period-close.service';
import { ExchangeRateService } from 'src/exchange-rate/exchange-rate.service';
import { InvoicePdfService } from './invoice-pdf.service';

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private periodClose: PeriodCloseService,
    private exchangeRateService: ExchangeRateService,
    private invoicePdfService: InvoicePdfService,
  ) {}

  private async resolveAmpereFeeTx(
    tx: PrismaClient | Prisma.TransactionClient,
    meterAmpere: number | null | undefined,
  ): Promise<number> {
    if (!meterAmpere || meterAmpere <= 0) return 0;

    const pricing = await (tx as any).amperePricing.findUnique({
      where: { ampere: meterAmpere },
    });

    if (pricing?.isActive) {
      return pricing.price;
    }

    throw new BadRequestException(
      `No active ampere pricing found for ${meterAmpere}A`,
    );
  }

  // Priority: Neighborhood -> Region -> Global (pick latest available up to the target period)
  private async resolveTariffTx(
    tx: PrismaClient | Prisma.TransactionClient,
    params: {
      neighborhoodId: number;
      regionId: number;
      month: number;
      year: number;
    },
  ) {
    const { neighborhoodId, regionId, month, year } = params;

    // helper: latest tariff up to (year, month)
    const findLatest = (where: any) =>
      tx.tariff.findFirst({
        where: {
          ...where,
          OR: [
            { year: { lt: year } },
            { year, month: { lte: month } },
          ],
        },
        orderBy: [{ year: 'desc' }, { month: 'desc' }, { id: 'desc' }],
      });

    // 1) Neighborhood
    const neighborhoodTariff = await findLatest({ neighborhoodId });
    if (neighborhoodTariff) return neighborhoodTariff;

    // 2) Region
    const regionTariff = await findLatest({ regionId });
    if (regionTariff) return regionTariff;

    // 3) Global
    const globalTariff = await findLatest({
      regionId: null,
      neighborhoodId: null,
    });
    if (globalTariff) return globalTariff;

    throw new NotFoundException('No tariff found for this or previous periods');
  }

  private async getPreviousBalanceTx(
    tx: PrismaClient | Prisma.TransactionClient,
    params: { subscriberId: number; month: number; year: number },
  ): Promise<number> {
    const { subscriberId, month, year } = params;

    // latest invoice strictly before (year, month) across all subscriber meters
    const prev = await (tx as any).invoice.findFirst({
      where: {
        meter: { subscriberId },
        OR: [{ year: { lt: year } }, { year, month: { lt: month } }],
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });

    return prev?.remainingBalance ?? 0;
  }

  async createFromReading(readingId: number) {
    return this.prisma.$transaction(async (tx) => {
      // Load reading (with meter -> box -> neighborhood -> region)
      const reading = await tx.meterReading.findUnique({
        where: { id: readingId },
        include: {
          invoice: true,
          meter: {
            include: {
              box: { include: { neighborhood: { include: { region: true } } } },
              subscriber: true,
            },
          },
        },
      });

      if (!reading) throw new NotFoundException('Reading not found');

      // Ensure reading not already invoiced
      if (reading.invoice) {
        throw new BadRequestException(
          'Invoice already exists for this reading',
        );
      }

      const meter = reading.meter;
      if ((meter as any).status && (meter as any).status !== 'ACTIVE') {
        throw new BadRequestException('Meter is inactive');
      }
      const neighborhoodId = meter.box.neighborhoodId;
      const regionId = meter.box.neighborhood.regionId;
      await this.periodClose.assertOpenOrThrow(reading.month, reading.year);

      // Ensure no invoice exists for same meter/month/year (extra safety)
      const duplicate = await tx.invoice.findUnique({
        where: {
          meterId_month_year: {
            meterId: meter.id,
            month: reading.month,
            year: reading.year,
          },
        },
      });
      if (duplicate) {
        throw new BadRequestException(
          'Invoice already exists for this meter and period',
        );
      }

      // Resolve tariff (priority)
      const tariff = await this.resolveTariffTx(tx, {
        neighborhoodId,
        regionId,
        month: reading.month,
        year: reading.year,
      });

      // Compute amounts (snapshot)
      const kwhRate = tariff.kwhRate;

      const consumption = reading.consumptionKwh;
      const kwhCost = consumption * kwhRate;

      const ampere = meter.ampere ?? 0;
      const ampereFee = await this.resolveAmpereFeeTx(tx, ampere);

      // Previous balance (carry forward)
      const previousBalance = await this.getPreviousBalanceTx(tx, {
        subscriberId: meter.subscriberId,
        month: reading.month,
        year: reading.year,
      });
      const fixesAmount = 0; // default
      const fixesNote = null;
      const totalDue = previousBalance + kwhCost + ampereFee + fixesAmount;

      // Create invoice (financially frozen)
      const rate = await this.exchangeRateService.getActiveRate();

      const created = await tx.invoice.create({
        data: {
          month: reading.month,
          year: reading.year,
          meterId: meter.id,
          readingId: reading.id,

          kwhRate,
          ampereFee,

          previousBalance,
          fixesAmount,
          fixesNote,
          totalDue,
          amountPaid: 0,
          remainingBalance: totalDue,
          status: 'ISSUED',
          exchangeRate: rate.usdToLbp,
        },
        include: {
          meter: {
            include: {
              subscriber: true,
              box: { include: { neighborhood: { include: { region: true } } } },
            },
          },
          reading: true,
          payments: true,
        },
      });

      // Apply any available credit (payments with invoiceId = null)
      const creditPayments = await tx.payment.findMany({
        where: {
          subscriberId: meter.subscriberId,
          invoiceId: null,
          isReversed: false,
          isPrepayment: true,
          amount: { gt: 0 },
        },
        orderBy: [{ paidAt: 'asc' }, { id: 'asc' }],
      });

      let remainingToApply = created.totalDue;
      let appliedCredit = 0;

      for (const credit of creditPayments) {
        if (remainingToApply <= 0) break;

        const useAmount = Math.min(remainingToApply, credit.amount);
        if (useAmount <= 0) continue;

        if (credit.amount <= useAmount + 1e-6) {
          // Fully apply this credit payment to the invoice
          await tx.payment.update({
            where: { id: credit.id },
            data: { invoiceId: created.id },
          });
        } else {
          // Split credit: part applied to invoice, remainder stays as credit
          await tx.payment.update({
            where: { id: credit.id },
            data: { amount: useAmount, invoiceId: created.id },
          });

          await tx.payment.create({
            data: {
              amount: credit.amount - useAmount,
              paidAt: credit.paidAt,
              subscriberId: credit.subscriberId,
              receiverType: credit.receiverType as any,
              receiverId: credit.receiverId,
              invoiceId: null,
              isPrepayment: true,
            },
          });
        }

        appliedCredit += useAmount;
        remainingToApply -= useAmount;
      }

      let finalInvoice = created;
      if (appliedCredit > 0) {
        const newRemaining = Math.max(created.totalDue - appliedCredit, 0);
        const newStatus = newRemaining <= 0 ? 'PAID' : 'PARTIALLY_PAID';

        await tx.invoice.update({
          where: { id: created.id },
          data: {
            amountPaid: appliedCredit,
            remainingBalance: newRemaining,
            status: newStatus,
          },
        });

        finalInvoice = {
          ...created,
          amountPaid: appliedCredit,
          remainingBalance: newRemaining,
          status: newStatus,
        };
      }

      return this.withLbpAmounts(
        this.withThisMonthDue({
          ...finalInvoice,
          tariffDetails: {
            id: tariff.id,
            scope: tariff.neighborhoodId
              ? 'NEIGHBORHOOD'
              : tariff.regionId
              ? 'REGION'
              : 'GLOBAL',
            month: tariff.month,
            year: tariff.year,
            kwhRate: tariff.kwhRate,
          },
        }),
      );
    });
  }

  /**
   * Helper used only for presentation: fetch the tariff that *would* apply
   * to the invoice period/scope and return a lean summary for the frontend.
   * If the tariff record no longer exists, fall back to the stored rates.
   */
  private async buildTariffDetails(invoice: any) {
    try {
      const tariff = await this.resolveTariffTx(this.prisma, {
        neighborhoodId: invoice.meter.box.neighborhoodId,
        regionId: invoice.meter.box.neighborhood.regionId,
        month: invoice.month,
        year: invoice.year,
      });

      const scope = tariff.neighborhoodId
        ? 'NEIGHBORHOOD'
        : tariff.regionId
        ? 'REGION'
        : 'GLOBAL';

      return {
        id: tariff.id,
        scope,
        month: tariff.month,
        year: tariff.year,
        kwhRate: tariff.kwhRate,
      };
    } catch (err) {
      // If tariff was deleted or missing, surface what we know from the invoice
      return {
        id: null,
        scope: 'UNKNOWN',
        month: invoice.month,
        year: invoice.year,
        kwhRate: invoice.kwhRate,
        note: 'Tariff record not found; showing rates stored on invoice',
      };
    }
  }

  private withLbpAmounts<T extends { exchangeRate?: number }>(invoice: T) {
    const rate = invoice.exchangeRate ?? 1;
    return {
      ...invoice,
      lbp: {
        totalDue: (invoice as any).totalDue * rate,
        amountPaid: (invoice as any).amountPaid * rate,
        remainingBalance: (invoice as any).remainingBalance * rate,
        previousBalance: (invoice as any).previousBalance * rate,
        ampereFee: (invoice as any).ampereFee * rate,
        kwhRate: (invoice as any).kwhRate * rate,
        fixesAmount: (invoice as any).fixesAmount * rate,
        thisMonthDue: (invoice as any).thisMonthDue * rate,
      },
    };
  }

  private withThisMonthDue<T extends { reading?: any }>(invoice: T) {
    const reading = (invoice as any).reading;
    const kwhRate = (invoice as any).kwhRate ?? 0;
    const ampereFee = (invoice as any).ampereFee ?? 0;
    const fixesAmount = (invoice as any).fixesAmount ?? 0;

    let thisMonthDue = 0;
    if (reading && typeof reading.consumptionKwh === 'number') {
      thisMonthDue = reading.consumptionKwh * kwhRate + ampereFee + fixesAmount;
    } else {
      const totalDue = (invoice as any).totalDue ?? 0;
      const previousBalance = (invoice as any).previousBalance ?? 0;
      thisMonthDue = totalDue - previousBalance;
    }

    if (thisMonthDue < 0) thisMonthDue = 0;

    return {
      ...invoice,
      thisMonthDue,
    };
  }

  async addFixesToInvoice(
    invoiceId: number,
    fixesAmount: number,
    fixesNote?: string,
  ) {
    if (fixesAmount <= 0) {
      throw new BadRequestException('Fixes amount must be greater than 0');
    }

    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
      });

      if (!invoice) {
        throw new NotFoundException('Invoice not found');
      }

      // Do not allow editing closed / paid invoices
      if (invoice.status === 'PAID' || invoice.status === 'CANCELLED') {
        throw new BadRequestException(
          'Cannot add fixes to a paid or cancelled invoice',
        );
      }

      // Update totals
      const newTotal = invoice.totalDue + fixesAmount;
      const newRemaining = invoice.remainingBalance + fixesAmount;

      return tx.invoice.update({
        where: { id: invoiceId },
        data: {
          fixesAmount: invoice.fixesAmount + fixesAmount,
          fixesNote,
          totalDue: newTotal,
          remainingBalance: newRemaining,
        },
      });
    });
  }

  findAll(params?: {
    year?: number;
    month?: number;
    status?: string;
    subscriberId?: number;
    regionId?: number;
    neighborhoodId?: number;
  }) {
    return this.prisma.invoice
      .findMany({
        where: {
          ...(params?.year !== undefined ? { year: params.year } : {}),
          ...(params?.month !== undefined ? { month: params.month } : {}),
          ...(params?.status !== undefined
            ? { status: params.status as any }
            : {}),
          ...(params?.subscriberId !== undefined
            ? { meter: { subscriberId: params.subscriberId } }
            : {}),
          ...(params?.neighborhoodId !== undefined
            ? {
                meter: {
                  box: {
                    neighborhoodId: params.neighborhoodId,
                  },
                },
              }
            : {}),
          ...(params?.regionId !== undefined
            ? {
                meter: {
                  box: {
                    neighborhood: {
                      regionId: params.regionId,
                    },
                  },
                },
              }
            : {}),
        },
        orderBy: [{ year: 'desc' }, { month: 'desc' }, { id: 'desc' }],
        include: {
          meter: {
            include: {
              subscriber: true,
              box: { include: { neighborhood: { include: { region: true } } } },
            },
          },
          reading: true,
          payments: true,
        },
      })
      .then((invoices) =>
        Promise.all(
          invoices.map(async (inv) => ({
            ...this.withLbpAmounts(
              this.withThisMonthDue({
                ...inv,
                tariffDetails: await this.buildTariffDetails(inv),
              }),
            ),
          })),
        ),
      );
  }

  async findOne(id: number) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        meter: {
          include: {
            subscriber: true,
            box: { include: { neighborhood: { include: { region: true } } } },
          },
        },
        reading: true,
        payments: { include: { receiver: true, subscriber: true } },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    const tariffDetails = await this.buildTariffDetails(invoice);
    return this.withLbpAmounts(
      this.withThisMonthDue({ ...invoice, tariffDetails }),
    );
  }

  async generateInvoicePdf(id: number) {
    const invoice = await this.findOne(id);
    return this.invoicePdfService.generateInvoice(invoice);
  }
}
