import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CollectorsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCollectorTasks(filters: {
    month: number;
    year: number;
    regionId?: number;
    neighborhoodId?: number;
    collectorId?: number;
  }) {
    const whereInvoice: any = {
      remainingBalance: { gt: 0 },
      month: filters.month,
      year: filters.year,
    };

    if (filters.neighborhoodId) {
      whereInvoice.meter = {
        box: { neighborhoodId: filters.neighborhoodId },
      };
    } else if (filters.regionId) {
      whereInvoice.meter = {
        box: { neighborhood: { regionId: filters.regionId } },
      };
    }

    const invoices = await this.prisma.invoice.findMany({
      where: whereInvoice,
      select: {
        remainingBalance: true,
        meter: {
          select: {
            subscriber: {
              select: {
                id: true,
                fullName: true,
                phone: true,
              },
            },
            box: {
              select: {
                neighborhood: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Group by neighborhood
    const map = new Map<number, any>();

    for (const inv of invoices) {
      const n = inv.meter.box.neighborhood;
      const s = inv.meter.subscriber;

      if (!map.has(n.id)) {
        map.set(n.id, {
          neighborhoodId: n.id,
          neighborhoodName: n.name,
          subscribers: [],
          totalToCollect: 0,
        });
      }

      const group = map.get(n.id);

      group.subscribers.push({
        subscriberId: s.id,
        name: s.fullName,
        phone: s.phone,
        amountDue: inv.remainingBalance,
      });

      group.totalToCollect += inv.remainingBalance;
    }

    return Array.from(map.values());
  }
}
