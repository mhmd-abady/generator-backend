import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ExchangeRateService {
  constructor(private prisma: PrismaService) {}

  async setRate(usdToLbp: number, note?: string) {
    if (usdToLbp <= 0) {
      throw new BadRequestException('Exchange rate must be greater than zero');
    }

    return this.prisma.$transaction(async (tx) => {
      // deactivate old active rate
      await tx.exchangeRate.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });

      // create new active rate
      return tx.exchangeRate.create({
        data: {
          usdToLbp,
          note,
          isActive: true,
        },
      });
    });
  }

  async getActiveRate() {
    const rate = await this.prisma.exchangeRate.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!rate) {
      throw new BadRequestException('No active exchange rate found');
    }

    return rate;
  }

  async getHistory() {
    return this.prisma.exchangeRate.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateRate(id: number, usdToLbp?: number, note?: string) {
    const rate = await this.prisma.exchangeRate.findUnique({
      where: { id },
    });

    if (!rate) {
      throw new BadRequestException(`Exchange rate with id ${id} not found`);
    }

    if (usdToLbp !== undefined && usdToLbp <= 0) {
      throw new BadRequestException('Exchange rate must be greater than zero');
    }

    return this.prisma.exchangeRate.update({
      where: { id },
      data: {
        ...(usdToLbp !== undefined && { usdToLbp }),
        ...(note !== undefined && { note }),
      },
    });
  }

  async deleteRate(id: number) {
    const rate = await this.prisma.exchangeRate.findUnique({
      where: { id },
    });

    if (!rate) {
      throw new BadRequestException(`Exchange rate with id ${id} not found`);
    }

    if (rate.isActive) {
      throw new BadRequestException('Cannot delete the active exchange rate');
    }

    return this.prisma.exchangeRate.delete({
      where: { id },
    });
  }
}
