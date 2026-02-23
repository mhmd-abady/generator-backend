import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PeriodCloseService } from '../period-close/period-close.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly periodClose: PeriodCloseService,
  ) {}

  private parseDateRange(from?: string, to?: string) {
    if (!from && !to) return undefined;
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;
    if (fromDate && Number.isNaN(fromDate.getTime())) {
      throw new BadRequestException('Invalid from date');
    }
    if (toDate && Number.isNaN(toDate.getTime())) {
      throw new BadRequestException('Invalid to date');
    }
    if (!fromDate && !toDate) return undefined;
    let start = fromDate ?? (toDate as Date);
    let end = toDate ?? (fromDate as Date);
    if (start > end) {
      const tmp = start;
      start = end;
      end = tmp;
    }
    return { start, end };
  }

  private buildMonthYearRange(from?: string, to?: string) {
    const range = this.parseDateRange(from, to);
    if (!range) return undefined;
    const start = new Date(range.start.getFullYear(), range.start.getMonth(), 1);
    const end = new Date(range.end.getFullYear(), range.end.getMonth(), 1);
    const months: { month: number; year: number }[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      months.push({
        month: cursor.getMonth() + 1,
        year: cursor.getFullYear(),
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return months;
  }

  async overview(filters: {
    month?: number;
    year?: number;
    from?: string;
    to?: string;
    regionId?: number;
    neighborhoodId?: number;
  }) {
    if ((filters.month && !filters.year) || (!filters.month && filters.year)) {
      throw new BadRequestException('month and year must be together');
    }

    const invoiceWhere: any = {};
    const paymentWhere: any = {};

    const months = this.buildMonthYearRange(filters.from, filters.to);
    const hasMonthFilter = Boolean(filters.month && filters.year);
    const periodMonths =
      months ??
      (hasMonthFilter
        ? [{ month: filters.month as number, year: filters.year as number }]
        : undefined);

    if (periodMonths) {
      invoiceWhere.OR = periodMonths;
      paymentWhere.invoice = { OR: periodMonths };
    }

    if (filters.neighborhoodId) {
      invoiceWhere.meter = { box: { neighborhoodId: filters.neighborhoodId } };
      if (periodMonths) {
        paymentWhere.invoice = {
          ...(paymentWhere.invoice ?? {}),
          meter: { box: { neighborhoodId: filters.neighborhoodId } },
        };
      } else {
        paymentWhere.OR = [
          {
            invoice: {
              meter: { box: { neighborhoodId: filters.neighborhoodId } },
            },
          },
          {
            subscriber: {
              meter: { box: { neighborhoodId: filters.neighborhoodId } },
            },
          },
        ];
      }
    } else if (filters.regionId) {
      invoiceWhere.meter = {
        box: { neighborhood: { regionId: filters.regionId } },
      };
      if (periodMonths) {
        paymentWhere.invoice = {
          ...(paymentWhere.invoice ?? {}),
          meter: { box: { neighborhood: { regionId: filters.regionId } } },
        };
      } else {
        paymentWhere.OR = [
          {
            invoice: {
              meter: { box: { neighborhood: { regionId: filters.regionId } } },
            },
          },
          {
            subscriber: {
              meter: { box: { neighborhood: { regionId: filters.regionId } } },
            },
          },
        ];
      }
    }

    const [
      subscribers,
      meters,
      boxes,
      invoiceAgg,
      paymentAgg,
      outstandingAgg,
      carriedForwardAgg,
    ] = await Promise.all([
      this.prisma.subscriber.count(),
      this.prisma.meter.count(),
      this.prisma.box.count(),
      this.prisma.invoice.aggregate({
        where: invoiceWhere,
        _sum: { totalDue: true },
      }),
      this.prisma.payment.aggregate({
        where: { ...paymentWhere /*isReversed: false*/ },
        _sum: { amount: true },
      }),
      this.prisma.invoice.aggregate({
        _sum: { remainingBalance: true },
      }),
      this.prisma.invoice.aggregate({
        where: invoiceWhere,
        _sum: { previousBalance: true },
      }),
    ]);

    return {
      subscribersCount: subscribers,
      metersCount: meters,
      boxesCount: boxes,
      totalInvoiced: invoiceAgg._sum.totalDue ?? 0,
      totalCollected: paymentAgg._sum.amount ?? 0,
      totalOutstanding: outstandingAgg._sum.remainingBalance ?? 0,
      totalCarriedForward: carriedForwardAgg._sum.previousBalance ?? 0,
    };
  }

  async monthlyTrend(filters: {
    year?: number;
    from?: string;
    to?: string;
    regionId?: number;
    neighborhoodId?: number;
  }) {
    if (!filters.year && !filters.from && !filters.to) {
      throw new BadRequestException('from/to or year is required');
    }

    const months =
      this.buildMonthYearRange(filters.from, filters.to) ??
      (filters.year
        ? Array.from({ length: 12 }, (_, i) => ({
            month: i + 1,
            year: filters.year as number,
          }))
        : undefined);

    if (!months) {
      throw new BadRequestException('from/to or year is required');
    }

    const rows: {
      month: number;
      invoiced: number;
      collected: number;
    }[] = [];

    for (const period of months) {
      const where: any = { month: period.month, year: period.year };

      if (filters.neighborhoodId) {
        where.meter = { box: { neighborhoodId: filters.neighborhoodId } };
      } else if (filters.regionId) {
        where.meter = {
          box: { neighborhood: { regionId: filters.regionId } },
        };
      }

      const invoices = await this.prisma.invoice.aggregate({
        where,
        _sum: { totalDue: true },
      });

      const payments = await this.prisma.payment.aggregate({
        where: {
          /*isReversed: false,*/
          invoice: {
            month: period.month,
            year: period.year,
            ...(filters.neighborhoodId
              ? { meter: { box: { neighborhoodId: filters.neighborhoodId } } }
              : filters.regionId
                ? {
                    meter: {
                      box: { neighborhood: { regionId: filters.regionId } },
                    },
                  }
                : {}),
          },
        },
        _sum: { amount: true },
      });

      rows.push({
        month: period.month,
        invoiced: invoices._sum.totalDue ?? 0,
        collected: payments._sum.amount ?? 0,
      });
    }

    return rows;
  }

  async regionsBreakdown(filters: {
    month?: number;
    year?: number;
    from?: string;
    to?: string;
    regionId?: number;
    neighborhoodId?: number;
  }) {
    const regionWhere: any = {};

    if (filters.regionId) {
      regionWhere.id = filters.regionId;
    } else if (filters.neighborhoodId) {
      regionWhere.neighborhoods = { some: { id: filters.neighborhoodId } };
    }

    const regions = await this.prisma.region.findMany({
      where: regionWhere,
      select: { id: true, name: true },
    });

    const result: {
      regionId: number;
      regionName: string;
      invoicesCount: number;
      totalInvoiced: number;
      totalCollected: number;
      totalOutstanding: number;
    }[] = [];

    for (const r of regions) {
      const where: any = {
        meter: { box: { neighborhood: { regionId: r.id } } },
      };

      if (filters.neighborhoodId) {
        where.meter = { box: { neighborhoodId: filters.neighborhoodId } };
      }

      if ((filters.month && !filters.year) || (!filters.month && filters.year)) {
        throw new BadRequestException('month and year must be together');
      }

      const months = this.buildMonthYearRange(filters.from, filters.to);
      const hasMonthFilter = Boolean(filters.month && filters.year);
      const periodMonths =
        months ??
        (hasMonthFilter
          ? [{ month: filters.month as number, year: filters.year as number }]
          : undefined);

      if (periodMonths) {
        where.OR = periodMonths;
      }

      const invoices = await this.prisma.invoice.aggregate({
        where,
        _sum: { totalDue: true, remainingBalance: true },
        _count: { _all: true },
      });

      const paymentInvoiceWhere: any = {
        meter: filters.neighborhoodId
          ? { box: { neighborhoodId: filters.neighborhoodId } }
          : { box: { neighborhood: { regionId: r.id } } },
      };
      if (periodMonths) {
        paymentInvoiceWhere.OR = periodMonths;
      }

      const payments = await this.prisma.payment.aggregate({
        where: {
          /*isReversed: false,*/
          invoice: paymentInvoiceWhere,
        },
        _sum: { amount: true },
      });

      result.push({
        regionId: r.id,
        regionName: r.name,
        invoicesCount: invoices._count._all ?? 0,
        totalInvoiced: invoices._sum.totalDue ?? 0,
        totalCollected: payments._sum.amount ?? 0,
        totalOutstanding: invoices._sum.remainingBalance ?? 0,
      });
    }

    return result;
  }

  async periodStatus(month?: number, year?: number) {
    if (!month || !year) {
      throw new BadRequestException('month and year are required');
    }
    const isClosed = await this.periodClose.isClosed(month, year);
    if (!isClosed) return { isClosed: false };

    const row = await this.prisma.periodClose.findUnique({
      where: { month_year: { month, year } },
      include: { closedByUser: { select: { id: true, username: true } } },
    });

    return {
      isClosed: true,
      closedAt: row?.closedAt,
      closedBy: row?.closedByUser,
    };
  }
}
