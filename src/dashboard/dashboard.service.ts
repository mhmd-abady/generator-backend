import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PeriodCloseService } from '../period-close/period-close.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly periodClose: PeriodCloseService,
  ) {}

  async overview(filters: {
    month?: number;
    year?: number;
    regionId?: number;
    neighborhoodId?: number;
  }) {
    if ((filters.month && !filters.year) || (!filters.month && filters.year)) {
      throw new BadRequestException('month and year must be together');
    }

    const invoiceWhere: any = {};
    const paymentWhere: any = {};

    if (filters.month && filters.year) {
      invoiceWhere.month = filters.month;
      invoiceWhere.year = filters.year;

      const from = new Date(filters.year, filters.month - 1, 1);
      const to = new Date(filters.year, filters.month, 0, 23, 59, 59);
      paymentWhere.paidAt = { gte: from, lte: to };
    }

    if (filters.neighborhoodId) {
      invoiceWhere.meter = { box: { neighborhoodId: filters.neighborhoodId } };
      paymentWhere.OR = [
        {
          invoice: {
            meter: { box: { neighborhoodId: filters.neighborhoodId } },
          },
        },
        {
          subscriber: {
            meters: {
              some: { box: { neighborhoodId: filters.neighborhoodId } },
            },
          },
        },
      ];
    } else if (filters.regionId) {
      invoiceWhere.meter = {
        box: { neighborhood: { regionId: filters.regionId } },
      };
      paymentWhere.OR = [
        {
          invoice: {
            meter: { box: { neighborhood: { regionId: filters.regionId } } },
          },
        },
        {
          subscriber: {
            meters: {
              some: { box: { neighborhood: { regionId: filters.regionId } } },
            },
          },
        },
      ];
    }

    const [subscribers, meters, boxes, invoiceAgg, paymentAgg, outstandingAgg] =
      await Promise.all([
        this.prisma.subscriber.count(),
        this.prisma.meter.count(),
        this.prisma.box.count(),
        this.prisma.invoice.aggregate({
          where: invoiceWhere,
          _sum: { totalDue: true },
        }),
        this.prisma.payment.aggregate({
          where: { ...paymentWhere, /*isReversed: false*/ },
          _sum: { amount: true },
        }),
        this.prisma.invoice.aggregate({
          _sum: { remainingBalance: true },
        }),
      ]);

    return {
      subscribersCount: subscribers,
      metersCount: meters,
      boxesCount: boxes,
      totalInvoiced: invoiceAgg._sum.totalDue ?? 0,
      totalCollected: paymentAgg._sum.amount ?? 0,
      totalOutstanding: outstandingAgg._sum.remainingBalance ?? 0,
    };
  }

  async monthlyTrend(filters: {
    year: number;
    regionId?: number;
    neighborhoodId?: number;
  }) {
    const rows: {
      month: number;
      invoiced: number;
      collected: number;
    }[] = [];

    for (let m = 1; m <= 12; m++) {
      const where: any = { year: filters.year, month: m };

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
          paidAt: {
            gte: new Date(filters.year, m - 1, 1),
            lte: new Date(filters.year, m, 0, 23, 59, 59),
          },
        },
        _sum: { amount: true },
      });

      rows.push({
        month: m,
        invoiced: invoices._sum.totalDue ?? 0,
        collected: payments._sum.amount ?? 0,
      });
    }

    return rows;
  }

  async regionsBreakdown(filters: { month?: number; year?: number }) {
    const regions = await this.prisma.region.findMany({
      select: { id: true, name: true },
    });

    const result: {
      regionId: number;
      regionName: string;
      totalInvoiced: number;
      totalCollected: number;
      totalOutstanding: number;
    }[] = [];

    for (const r of regions) {
      const where: any = {
        meter: { box: { neighborhood: { regionId: r.id } } },
      };

      if (filters.month && filters.year) {
        where.month = filters.month;
        where.year = filters.year;
      }

      const invoices = await this.prisma.invoice.aggregate({
        where,
        _sum: { totalDue: true, remainingBalance: true },
      });

      const payments = await this.prisma.payment.aggregate({
        where: {
          /*isReversed: false,*/
          invoice: {
            meter: { box: { neighborhood: { regionId: r.id } } },
          },
        },
        _sum: { amount: true },
      });

      result.push({
        regionId: r.id,
        regionName: r.name,
        totalInvoiced: invoices._sum.totalDue ?? 0,
        totalCollected: payments._sum.amount ?? 0,
        totalOutstanding: invoices._sum.remainingBalance ?? 0,
      });
    }

    return result;
  }

  async periodStatus(month: number, year: number) {
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
