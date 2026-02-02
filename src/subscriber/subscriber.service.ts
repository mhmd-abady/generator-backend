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
    return this.prisma.subscriber.findMany({
      orderBy: { id: 'asc' },
      include: {
        meter: true,
      },
    });
  }

  async findOne(id: number) {
    const subscriber = await this.prisma.subscriber.findUnique({
        where: { id },
    include: {
      meter: {
        include: {
          box: {
            include: {
              neighborhood: true,
            },
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
  return this.prisma.subscriber.findMany({
    where: {
      meter: {
        box: {
          neighborhoodId,
        },
      },
    },
    include: {
      meter: {
        include: {
          box: true,
        },
      },
    },
    orderBy: { id: 'asc' },
  });
}

}
