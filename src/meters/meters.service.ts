import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMeterDto } from './dto/create-meter.dto';
import { UpdateMeterDto } from './dto/update-meter.dto';

@Injectable()
export class MetersService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureBoxExists(boxId: number) {
    const box = await this.prisma.box.findUnique({ where: { id: boxId } });
    if (!box) throw new NotFoundException('Box not found');
    return box;
  }

  private async ensureSubscriberExists(subscriberId: number) {
    const sub = await this.prisma.subscriber.findUnique({
      where: { id: subscriberId },
      include: { meter: true },
    });
    if (!sub) throw new NotFoundException('Subscriber not found');
    if (sub.meter) {
      throw new BadRequestException('Subscriber already has a meter');
    }
    return sub;
  }

  async create(dto: CreateMeterDto) {
    await this.ensureBoxExists(dto.boxId);
    await this.ensureSubscriberExists(dto.subscriberId);

    try {
      return await this.prisma.meter.create({
        data: {
          number: dto.number,
          ampere: dto.ampere,
          boxId: dto.boxId,
          subscriberId: dto.subscriberId,
        },
        include: {
          box: { include: { neighborhood: { include: { region: true } } } },
          subscriber: true,
        },
      });
    } catch (e: any) {
      // Unique violation on meter.number (Postgres)
      if (e?.code === 'P2002') {
        throw new BadRequestException('Meter number already exists');
      }
      throw new BadRequestException('Failed to create meter');
    }
  }

  findAll() {
    return this.prisma.meter.findMany({
      orderBy: { id: 'asc' },
      include: {
        subscriber: true,
        box: { include: { neighborhood: { include: { region: true } } } },
      },
    });
  }

  async findOne(id: number) {
    const meter = await this.prisma.meter.findUnique({
      where: { id },
      include: {
        subscriber: true,
        box: { include: { neighborhood: { include: { region: true } } } },
        readings: true,
        invoices: true,
      },
    });
    if (!meter) throw new NotFoundException('Meter not found');
    return meter;
  }

  async update(id: number, dto: UpdateMeterDto) {
    await this.findOne(id);

    if (dto.boxId) await this.ensureBoxExists(dto.boxId);
    if (dto.subscriberId) {
      const sub = await this.prisma.subscriber.findUnique({
        where: { id: dto.subscriberId },
        include: { meter: true },
      });
      if (!sub) throw new NotFoundException('Subscriber not found');
      if (sub.meter && sub.meter.id !== id) {
        throw new BadRequestException('Subscriber already has a meter');
      }
    }

    try {
      return await this.prisma.meter.update({
        where: { id },
        data: {
          ...(dto.number !== undefined ? { number: dto.number } : {}),
          ...(dto.ampere !== undefined ? { ampere: dto.ampere } : {}),
          ...(dto.boxId !== undefined ? { boxId: dto.boxId } : {}),
          ...(dto.subscriberId !== undefined
            ? { subscriberId: dto.subscriberId }
            : {}),
        },
        include: {
          subscriber: true,
          box: { include: { neighborhood: { include: { region: true } } } },
        },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') {
        throw new BadRequestException('Meter number already exists');
      }
      throw new BadRequestException('Failed to update meter');
    }
  }

  async remove(id: number) {
    const meter = await this.findOne(id);

    // secure rule: do not delete if it has financial history
    if (meter.invoices.length > 0 || meter.readings.length > 0) {
      throw new BadRequestException(
        'Cannot delete meter with readings or invoices',
      );
    }

    return this.prisma.meter.delete({ where: { id } });
  }

  // Useful filters (best practice)
  findByBox(boxId: number) {
    return this.prisma.meter.findMany({
      where: { boxId },
      orderBy: { id: 'asc' },
      include: { subscriber: true, box: { select: { code: true } } },
    });
  }

  findBySubscriber(subscriberId: number) {
    return this.prisma.meter.findUnique({
      where: { subscriberId },
      include: { box: { include: { neighborhood: true } }, subscriber: true },
    });
  }

  async findByFilters(filters: {
    neighborhoodId?: number;
    regionId?: number;
  }) {
    const where: any = {};

    if (filters.neighborhoodId) {
      where.box = { neighborhoodId: filters.neighborhoodId };
    } else if (filters.regionId) {
      where.box = { neighborhood: { regionId: filters.regionId } };
    }

    return this.prisma.meter.findMany({
      where,
      orderBy: { id: 'asc' },
      include: {
        subscriber: true,
        box: { include: { neighborhood: { include: { region: true } } } },
      },
    });
  }
}
