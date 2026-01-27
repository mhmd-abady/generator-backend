import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReportsFilterDto } from './dto/reports-filter.dto';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // Helper: compute invoice age in days
  private ageInDays(from: Date, to: Date) {
    return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
  }

  async getAgingReport(filters: ReportsFilterDto) {
    const today = new Date();

    // Validate month/year pairing
    if ((filters.month && !filters.year) || (!filters.month && filters.year)) {
      throw new BadRequestException('month and year must be provided together');
    }

    // neighborhoodId implies region is optional (fine), but if both exist, we can keep it
    // You may later enforce consistency: neighborhood belongs to regionId, but not required now.

    // Build WHERE clause (best practice: keep it explicit)
    const whereInvoice: any = {
      remainingBalance: { gt: 0 },
    };

    // Month filter: since invoices are stored by (month, year)
    if (filters.month && filters.year) {
      whereInvoice.month = filters.month;
      whereInvoice.year = filters.year;
    }

    // Location filter: invoice -> meter -> box -> neighborhood -> region
    if (filters.neighborhoodId) {
      whereInvoice.meter = {
        box: { neighborhoodId: filters.neighborhoodId },
      };
    } else if (filters.regionId) {
      whereInvoice.meter = {
        box: { neighborhood: { regionId: filters.regionId } },
      };
    }

    // Query unpaid invoices
    const invoices = await this.prisma.invoice.findMany({
      where: whereInvoice,
      select: {
        remainingBalance: true,
        createdAt: true,
        meter: {
          select: {
            subscriber: { select: { id: true, fullName: true, phone: true } },
            box: {
              select: {
                neighborhood: {
                  select: {
                    id: true,
                    name: true,
                    region: { select: { id: true, name: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    // Group by subscriber (best practice: stable aggregation)
    const map = new Map<number, any>();

    for (const inv of invoices) {
      const sub = inv.meter.subscriber;

      const region = inv.meter.box.neighborhood.region;
      const neighborhood = inv.meter.box.neighborhood;

      const days = this.ageInDays(inv.createdAt, today);
      const amount = inv.remainingBalance;

      if (!map.has(sub.id)) {
        map.set(sub.id, {
          subscriber: sub,
          region,
          neighborhood,
          buckets: { '0_30': 0, '31_60': 0, '61_90': 0, '90_plus': 0 },
          totalOwed: 0,
          invoicesCount: 0,
        });
      }

      const row = map.get(sub.id);

      // Bucketing
      if (days <= 30) row.buckets['0_30'] += amount;
      else if (days <= 60) row.buckets['31_60'] += amount;
      else if (days <= 90) row.buckets['61_90'] += amount;
      else row.buckets['90_plus'] += amount;

      row.totalOwed += amount;
      row.invoicesCount += 1;
    }

    // Return list sorted by most owed (useful for owner)
    const list = Array.from(map.values()).sort(
      (a, b) => b.totalOwed - a.totalOwed,
    );

    // Useful totals for dashboard
    const totals = list.reduce(
      (acc, r) => {
        acc['0_30'] += r.buckets['0_30'];
        acc['31_60'] += r.buckets['31_60'];
        acc['61_90'] += r.buckets['61_90'];
        acc['90_plus'] += r.buckets['90_plus'];
        acc.totalOwed += r.totalOwed;
        acc.subscribers += 1;
        return acc;
      },
      { '0_30': 0, '31_60': 0, '61_90': 0, '90_plus': 0, totalOwed: 0, subscribers: 0 },
    );

    return {
      filters,
      totals,
      rows: list,
    };
  }


  async getPaymentsReport(filters: ReportsFilterDto) {
  // Validate month/year pairing
  if ((filters.month && !filters.year) || (!filters.month && filters.year)) {
    throw new BadRequestException('month and year must be provided together');
  }

  // Build WHERE for payments
  const wherePayment: any = {};

  // Date filter (by paidAt)
  if (filters.month && filters.year) {
    const from = new Date(filters.year, filters.month - 1, 1);
    const to = new Date(filters.year, filters.month, 0, 23, 59, 59);

    wherePayment.paidAt = { gte: from, lte: to };
  }

  // Collector filter
  if (filters.receiverId) {
    wherePayment.receiverId = filters.receiverId;
  }

  // Location filters (payment -> invoice -> meter -> box -> neighborhood -> region)
 if (filters.neighborhoodId) {
  wherePayment.OR = [
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
  wherePayment.OR = [
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


  // Query payments
  const payments = await this.prisma.payment.findMany({
    where: wherePayment,
    select: {
      id: true,
      amount: true,
      paidAt: true,
      subscriber: { select: { id: true, fullName: true, phone: true } },
      receiver: { select: { id: true, username: true } },
      invoice: {
        select: {
          id: true,
          month: true,
          year: true,
          meter: {
            select: {
              box: {
                select: {
                  neighborhood: {
                    select: {
                      id: true,
                      name: true,
                      region: { select: { id: true, name: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { paidAt: 'desc' },
  });

  // Totals (for dashboard)
  const totalReceived = payments.reduce((s, p) => s + p.amount, 0);

  return {
  filters,
  totalReceived,
  count: payments.length,
  rows: payments.map(p => ({
    ...p,
    invoice: p.invoice ?? null,
  })),
};
}

async getSummaryReport(filters: ReportsFilterDto) {
  // Validate month/year pairing
  if ((filters.month && !filters.year) || (!filters.month && filters.year)) {
    throw new BadRequestException('month and year must be provided together');
  }

  // ─────────────────────────────────────────
  // 1️⃣ Build invoice filter
  const whereInvoice: any = {};

  if (filters.month && filters.year) {
    whereInvoice.month = filters.month;
    whereInvoice.year = filters.year;
  }

  if (filters.neighborhoodId) {
    whereInvoice.meter = {
      box: { neighborhoodId: filters.neighborhoodId },
    };
  } else if (filters.regionId) {
    whereInvoice.meter = {
      box: { neighborhood: { regionId: filters.regionId } },
    };
  }

  // ─────────────────────────────────────────
  // 2️⃣ Fetch invoices
  const invoices = await this.prisma.invoice.findMany({
    where: whereInvoice,
    select: {
      totalDue: true,
      amountPaid: true,
      remainingBalance: true,
    },
  });

  // ─────────────────────────────────────────
  // 3️⃣ Aggregate invoice totals
  const totalInvoiced = invoices.reduce(
    (s, i) => s + i.totalDue,
    0,
  );

  const totalPaidFromInvoices = invoices.reduce(
    (s, i) => s + i.amountPaid,
    0,
  );

  const totalOutstanding = invoices.reduce(
    (s, i) => s + i.remainingBalance,
    0,
  );

  // ─────────────────────────────────────────
  // 4️⃣ Payments count (optional, informative)
  const wherePayment: any = {};

  if (filters.month && filters.year) {
    const from = new Date(filters.year, filters.month - 1, 1);
    const to = new Date(filters.year, filters.month, 0, 23, 59, 59);
    wherePayment.paidAt = { gte: from, lte: to };
  }

  if (filters.neighborhoodId) {
    wherePayment.invoice = {
      meter: { box: { neighborhoodId: filters.neighborhoodId } },
    };
  } else if (filters.regionId) {
    wherePayment.invoice = {
      meter: { box: { neighborhood: { regionId: filters.regionId } } },
    };
  }

  const paymentsCount = await this.prisma.payment.count({
    where: wherePayment,
  });

  return {
    filters,
    totals: {
      totalInvoiced,
      totalPaid: totalPaidFromInvoices,
      totalOutstanding,
    },
    counts: {
      invoices: invoices.length,
      payments: paymentsCount,
    },
  };
}

async getCollectionsSummary(filters: ReportsFilterDto) {
  // Validate month/year pairing
  if ((filters.month && !filters.year) || (!filters.month && filters.year)) {
    throw new BadRequestException('month and year must be provided together');
  }

  const wherePayment: any = {};

  // Date filter (by paidAt)
  if (filters.month && filters.year) {
    const from = new Date(filters.year, filters.month - 1, 1);
    const to = new Date(filters.year, filters.month, 0, 23, 59, 59);
    wherePayment.paidAt = { gte: from, lte: to };
  }

  // Location filters
  if (filters.neighborhoodId) {
    wherePayment.OR = [
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
    wherePayment.OR = [
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

  // Fetch payments
  const payments = await this.prisma.payment.findMany({
    where: wherePayment,
    select: {
      amount: true,
      receiverType: true,
      receiver: {
        select: {
          id: true,
          username: true,
          role: true,
        },
      },
    },
  });

  // Aggregate by receiver
  const map = new Map<string, any>();

  for (const p of payments) {
    const key = `${p.receiverType}-${p.receiver.id}`;

    if (!map.has(key)) {
      map.set(key, {
        receiverType: p.receiverType,
        receiverId: p.receiver.id,
        receiverName: p.receiver.username,
        role: p.receiver.role,
        totalCollected: 0,
        paymentsCount: 0,
      });
    }

    const row = map.get(key);
    row.totalCollected += p.amount;
    row.paymentsCount += 1;
  }

  return {
    filters,
    rows: Array.from(map.values()).sort(
      (a, b) => b.totalCollected - a.totalCollected,
    ),
  };
}

}
