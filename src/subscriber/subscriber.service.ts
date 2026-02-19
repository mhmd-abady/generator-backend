import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubscriberDto } from './dto/create-subscriber.dto';
import { UpdateSubscriberDto } from './dto/update-subscriber.dto';

@Injectable()
export class SubscribersService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreateSubscriberDto) {
    return this.prisma.subscriber.create({
      data: dto,
    });
  }

  findAll() {
    return (this.prisma as any).subscriber.findMany({
      orderBy: { id: 'asc' },
      include: {
        meters: {
          orderBy: [{ id: 'asc' }],
          include: {
            box: { include: { neighborhood: true, region: true } },
          },
        },
      },
    });
  }

  async findOne(id: number) {
    const subscriber = await (this.prisma as any).subscriber.findUnique({
        where: { id },
    include: {
      meters: {
        orderBy: [{ id: 'asc' }],
        include: {
          box: { include: { neighborhood: true, region: true } },
          invoices: {
            orderBy: [{ year: 'desc' }, { month: 'desc' }, { id: 'desc' }],
            take: 1,
          },
        },
      },
      payments: true,
    },
    });

    if (!subscriber) {
      throw new NotFoundException('Subscriber not found');
    }

    return subscriber;
  }

  async update(id: number, dto: UpdateSubscriberDto) {
    await this.findOne(id);

    return this.prisma.subscriber.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    return this.prisma.subscriber.delete({
      where: { id },
    });
  }

  async findByNeighborhood(neighborhoodId: number) {
  return (this.prisma as any).subscriber.findMany({
    where: {
      meters: { some: { box: { neighborhoodId } } },
    },
    include: {
      meters: {
        orderBy: [{ id: 'asc' }],
        include: {
          box: { include: { neighborhood: true, region: true } },
        },
      },
    },
    orderBy: { id: 'asc' },
  });
}

}
