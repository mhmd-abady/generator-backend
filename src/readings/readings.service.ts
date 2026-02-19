import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReadingDto } from './dto/create-reading.dto';
import { UpdateReadingDto } from './dto/update-reading.dto';
import { PeriodCloseService } from 'src/period-close/period-close.service';
import { BulkCreateReadingDto } from './dto/bulk-create-reading.dto';

@Injectable()
export class ReadingsService {
  constructor(private readonly prisma: PrismaService,private periodClose: PeriodCloseService) {}

  private async resolveAmpereFee(
    meterAmpere: number | null | undefined,
  ): Promise<number> {
    if (!meterAmpere || meterAmpere <= 0) return 0;

    const pricing = await (this.prisma as any).amperePricing.findUnique({
      where: { ampere: meterAmpere },
    });

    if (pricing?.isActive) {
      return pricing.price;
    }

    throw new BadRequestException(
      `No active ampere pricing found for ${meterAmpere}A`,
    );
  }

  private async ensureMeterExists(meterId: number) {
    const meter = await (this.prisma as any).meter.findUnique({
      where: { id: meterId },
    });
    if (!meter) throw new NotFoundException('Meter not found');
    return meter;
  }

  private async ensureMeterActive(meterId: number) {
    const meter = await this.ensureMeterExists(meterId);
    if (meter.status !== 'ACTIVE') {
      throw new BadRequestException('Meter is inactive');
    }
    return meter;
  }

async create(dto: CreateReadingDto) {
  await this.ensureMeterActive(dto.meterId);
  await this.periodClose.assertOpenOrThrow(dto.month, dto.year);

  //  Get most recent reading strictly before the target month/year
  const last = await this.prisma.meterReading.findFirst({
    where: {
      meterId: dto.meterId,
      OR: [
        { year: { lt: dto.year } },
        { year: dto.year, month: { lt: dto.month } },
      ],
    },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
  });

  const previousReading = last?.currentReading ?? 0;

  if (dto.currentReading < previousReading) {
    throw new BadRequestException(
      'Current reading cannot be less than previous',
    );
  }

  // Prevent duplicates
  const exists = await this.prisma.meterReading.findUnique({
    where: {
      meterId_month_year: {
        meterId: dto.meterId,
        month: dto.month,
        year: dto.year,
      },
    },
  });

  if (exists) {
    throw new BadRequestException(
      'Reading already exists for this meter/month',
    );
  }

  const consumptionKwh = dto.currentReading - previousReading;

  // Create reading
  return this.prisma.meterReading.create({
    data: {
      meterId: dto.meterId,
      month: dto.month,
      year: dto.year,
      previousReading,
      currentReading: dto.currentReading,
      consumptionKwh,
    },
    include: {
      meter: {
        include: {
          box: { include: { neighborhood: { include: { region: true } } } },
        },
      },
    },
  });
}


  async bulkCreate(dto: BulkCreateReadingDto) {
  const { month, year, rows } = dto;

  // Period check (once)
  await this.periodClose.assertOpenOrThrow(month, year);

  if (!rows.length) {
    throw new BadRequestException('No readings provided');
  }

  return this.prisma.$transaction(async (tx) => {
    const created: any[] = [];

    for (const row of rows) {
      //  Ensure meter exists
      const meter = await (tx as any).meter.findUnique({
        where: { id: row.meterId },
      });
      if (!meter) {
        throw new NotFoundException(
          `Meter ${row.meterId} not found`,
        );
      }
      if (meter.status !== 'ACTIVE') {
        throw new BadRequestException(`Meter ${row.meterId} is inactive`);
      }

      //  Prevent duplicates
      const exists = await tx.meterReading.findUnique({
        where: {
          meterId_month_year: {
            meterId: row.meterId,
            month,
            year,
          },
        },
      });
      if (exists) {
        throw new BadRequestException(
          `Reading already exists for meter ${row.meterId}`,
        );
      }

      //  Get most recent reading strictly before the target month/year
      const last = await tx.meterReading.findFirst({
        where: {
          meterId: row.meterId,
          OR: [
            { year: { lt: year } },
            { year, month: { lt: month } },
          ],
        },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
      });

      const previousReading = last?.currentReading ?? 0;

      if (row.currentReading < previousReading) {
        throw new BadRequestException(
          `Current reading cannot be less than previous for meter ${row.meterId}`,
        );
      }

      const consumptionKwh =
        row.currentReading - previousReading;

      // Create reading
      const reading = await tx.meterReading.create({
        data: {
          meterId: row.meterId,
          month,
          year,
          previousReading,
          currentReading: row.currentReading,
          consumptionKwh,
        },
      });

      created.push(reading);
    }

    return created;
  });
}

  findAll() {
    return this.prisma.meterReading.findMany({
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      include: {
        meter: {
          include: {
            box: { include: { neighborhood: { include: { region: true } } } },
          },
        },
      },
    });
  }

  async findOne(id: number) {
    const reading = await this.prisma.meterReading.findUnique({
      where: { id },
      include: {
        meter: {
          include: {
            box: { include: { neighborhood: { include: { region: true } } } },
          },
        },
        invoice: true,
      },
    });
    if (!reading) throw new NotFoundException('Reading not found');
    return reading;
  }

  async update(id: number, dto: UpdateReadingDto) {
  const reading = await this.prisma.meterReading.findUnique({
    where: { id },
    include: {
      invoice: true,
      meter: {
        include: {
          box: { include: { neighborhood: { include: { region: true } } } },
        },
      },
    },
  });

  if (!reading) {
    throw new NotFoundException('Reading not found');
  }

  const prev = dto.previousReading ?? reading.previousReading;
  const curr = dto.currentReading ?? reading.currentReading;

  if (curr < prev) {
    throw new BadRequestException('Current reading cannot be less than previous');
  }

  const consumptionKwh = curr - prev;

  //  Update reading
  const updatedReading = await this.prisma.meterReading.update({
    where: { id },
    data: {
      previousReading: prev,
      currentReading: curr,
      consumptionKwh,
    },
    include: { invoice: true },
  });

  // If no invoice → done
  if (!updatedReading.invoice) {
    return updatedReading;
  }

  // Resolve latest tariff up to this period (neighborhood -> region -> global)
  const neighborhoodId = reading.meter.box.neighborhoodId;
  const regionId = reading.meter.box.neighborhood.regionId;

  const findLatest = (where: any) =>
    this.prisma.tariff.findFirst({
      where: {
        ...where,
        OR: [
          { year: { lt: reading.year } },
          { year: reading.year, month: { lte: reading.month } },
        ],
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { id: 'desc' }],
    });

  const tariff =
    (await findLatest({ neighborhoodId })) ??
    (await findLatest({ regionId })) ??
    (await findLatest({ regionId: null, neighborhoodId: null }));

  if (!tariff) {
    throw new BadRequestException('No tariff found for this or previous periods');
  }

  // Recalculate invoice
  const kwhCost = consumptionKwh * tariff.kwhRate;
  const ampere = reading.meter.ampere ?? 0;
  const ampereFee = await this.resolveAmpereFee(ampere);

  const newTotal =
    updatedReading.invoice.previousBalance +
    kwhCost +
    ampereFee +
    updatedReading.invoice.fixesAmount;

  // Recompute paid and reversal totals to set an accurate status
  const paidAgg = await this.prisma.payment.aggregate({
    where: { invoiceId: updatedReading.invoice.id },
    _sum: { amount: true },
  });

  const reversalAgg = await this.prisma.payment.aggregate({
    where: {
      invoiceId: updatedReading.invoice.id,
      reversedFrom: { isNot: null },
    },
    _sum: { amount: true },
  });

  const paid = paidAgg._sum.amount ?? 0;
  const reversedAbs = Math.abs(reversalAgg._sum.amount ?? 0);
  const newRemaining = newTotal - paid;

  let status: any;
  if (newRemaining <= 0) {
    status = 'PAID';
  } else if (reversedAbs > 0) {
    status = paid <= 0 ? 'REVERSED_FULL' : 'REVERSED_PARTIAL';
  } else if (paid > 0) {
    status = 'PARTIALLY_PAID';
  } else {
    status = 'ISSUED';
  }

  // Update invoice with NEW tariff
  console.log('Updating invoice with new tariff rates', {
    kwhRate: tariff.kwhRate,
    ampereFee,
    newTotal,
    newRemaining,
  });
  
  await this.prisma.invoice.update({
    where: { id: updatedReading.invoice.id },
    data: {
      kwhRate: tariff.kwhRate,
      ampereFee,
      totalDue: newTotal,
      amountPaid: paid,
      remainingBalance: Math.max(newRemaining, 0),
      status,
    },
  });

  return updatedReading;
}

  async remove(id: number) {
    const reading = await this.findOne(id);

    if (reading.invoice) {
      throw new BadRequestException('Cannot delete reading with an invoice');
    }

    return this.prisma.meterReading.delete({ where: { id } });
  }

  // helpers
  findByMeter(meterId: number) {
    return this.prisma.meterReading.findMany({
      where: { meterId },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      include: {
        meter: {
          include: {
            box: { include: { neighborhood: { include: { region: true } } } },
          },
        },
      },
    });
  }

  // readings.service.ts
async findMetersWithReadings(params: {
  month: number;
  year: number;
  neighborhoodId?: number;
  boxId?: number;
  regionId?: number;
}) {
  const { month, year, neighborhoodId, boxId, regionId } = params;

  const meters = await this.prisma.meter.findMany({
    where: {
      box: {
        ...(neighborhoodId ? { neighborhoodId } : {}),
        ...(regionId ? { neighborhood: { regionId } } : {}),
      },
      ...(boxId ? { boxId } : {}),
    },
    include: {
      subscriber: true,
      box: { include: { neighborhood: { include: { region: true } } } },
      readings: { where: { month, year }, take: 1 },
    },
  });

  const meterIds = meters.map((m) => m.id);
  if (!meterIds.length) return meters;

  // For meters with no reading in the selected month/year, preload the latest
  // previous reading to provide a non-zero draft baseline in the UI.
  const latestPreviousByMeter = await this.prisma.meterReading.findMany({
    where: {
      meterId: { in: meterIds },
      OR: [{ year: { lt: year } }, { year, month: { lt: month } }],
    },
    orderBy: [{ meterId: 'asc' }, { year: 'desc' }, { month: 'desc' }],
    distinct: ['meterId'],
  });

  const latestMap = new Map(
    latestPreviousByMeter.map((r) => [r.meterId, r.currentReading]),
  );

  return meters.map((meter) => {
    if (meter.readings.length > 0) return meter;

    const carry = latestMap.get(meter.id) ?? 0;

    return {
      ...meter,
      readings: [
        {
          id: 0,
          meterId: meter.id,
          month,
          year,
          previousReading: carry,
          currentReading: carry,
          consumptionKwh: 0,
          createdAt: new Date(0),
        },
      ],
    };
  });
}


}
