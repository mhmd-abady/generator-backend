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

  // Priority: Neighborhood -> Region -> Global
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

    const neighborhoodTariff = await tx.tariff.findFirst({
      where: { neighborhoodId, month, year },
      orderBy: { id: 'desc' }, // pick newest
    });
    if (neighborhoodTariff) return neighborhoodTariff;

    const regionTariff = await tx.tariff.findFirst({
      where: { regionId, month, year },
      orderBy: { id: 'desc' }, // pick newest
    });
    if (regionTariff) return regionTariff;

    const globalTariff = await tx.tariff.findFirst({
      where: { regionId: null, neighborhoodId: null, month, year },
      orderBy: { id: 'desc' }, // pick newest
    });
    if (globalTariff) return globalTariff;

    throw new NotFoundException('No tariff found for this period');
  }

  private async getPreviousBalanceTx(
    tx: PrismaClient | Prisma.TransactionClient,
    params: { meterId: number; month: number; year: number },
  ): Promise<number> {
    const { meterId, month, year } = params;

    // latest invoice strictly before (year, month)
    const prev = await tx.invoice.findFirst({
      where: {
        meterId,
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
      const ampereRate = tariff.ampereRate;

      const consumption = reading.consumptionKwh;
      const kwhCost = consumption * kwhRate;

      const ampere = meter.ampere ?? 0;
      const ampereFee = ampere > 0 ? ampere * ampereRate : 0;

      // Previous balance (carry forward)
      const previousBalance = await this.getPreviousBalanceTx(tx, {
        meterId: meter.id,
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

      return created;
    });
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
    return this.prisma.invoice.findMany({
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
    });
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
    return invoice;
  }

  async generateInvoicePdf(id: number) {
    const invoice = await this.findOne(id);
    return this.invoicePdfService.generateInvoice(invoice);
  }
}
