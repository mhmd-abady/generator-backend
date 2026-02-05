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
        id: true,
        month: true,
        year: true,
        status: true,
        totalDue: true,
        amountPaid: true,
        remainingBalance: true,
        previousBalance: true,
        fixesAmount: true,
        ampereFee: true,
        kwhRate: true,
        exchangeRate: true,
        meter: {
          select: {
            id: true,
            number: true,
            ampere: true,
            subscriber: {
              select: {
                id: true,
                fullName: true,
                phone: true,
                address: true,
              },
            },
            box: {
              select: {
                id: true,
                code: true,
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
        reading: {
          select: {
            id: true,
            previousReading: true,
            currentReading: true,
            consumptionKwh: true,
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
          totalPreviousBalance: 0,
        });
      }

      const group = map.get(n.id);

      group.subscribers.push({
        subscriberId: s.id,
        name: s.fullName,
        phone: s.phone,
        address: s.address,
        amountDue: inv.remainingBalance,
        previousBalance: inv.previousBalance,
        invoice: {
          id: inv.id,
          month: inv.month,
          year: inv.year,
          status: inv.status,
          totalDue: inv.totalDue,
          amountPaid: inv.amountPaid,
          remainingBalance: inv.remainingBalance,
          previousBalance: inv.previousBalance,
          fixesAmount: inv.fixesAmount,
          ampereFee: inv.ampereFee,
          kwhRate: inv.kwhRate,
          exchangeRate: inv.exchangeRate,
          consumptionKwh: inv.reading?.consumptionKwh ?? null,
          previousReading: inv.reading?.previousReading ?? null,
          currentReading: inv.reading?.currentReading ?? null,
          meterNumber: inv.meter.number,
          meterAmpere: inv.meter.ampere,
          boxCode: inv.meter.box.code,
          neighborhoodId: inv.meter.box.neighborhood.id,
          neighborhoodName: inv.meter.box.neighborhood.name,
          regionId: inv.meter.box.neighborhood.region.id,
          regionName: inv.meter.box.neighborhood.region.name,
        },
      });

      group.totalToCollect += inv.remainingBalance;
      group.totalPreviousBalance =
        (group.totalPreviousBalance ?? 0) + inv.previousBalance;
    }

    return Array.from(map.values());
  }
}
