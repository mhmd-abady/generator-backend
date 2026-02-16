import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateAmperePricingDto } from './dto/create-ampere-pricing.dto';
import { UpdateAmperePricingDto } from './dto/update-ampere-pricing.dto';

@Injectable()
export class AmperePricingService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAmperePricingDto) {
    try {
      return await (this.prisma as any).amperePricing.create({ data: dto });
    } catch (e: any) {
      if (e?.code === 'P2002') {
        throw new BadRequestException(
          `Ampere pricing for ${dto.ampere}A already exists`,
        );
      }
      throw new BadRequestException('Failed to create ampere pricing');
    }
  }

  findAll(params?: { activeOnly?: boolean }) {
    return (this.prisma as any).amperePricing.findMany({
      where: params?.activeOnly ? { isActive: true } : undefined,
      orderBy: [{ ampere: 'asc' }, { id: 'asc' }],
    });
  }

  async findByAmpere(ampere: number) {
    const row = await (this.prisma as any).amperePricing.findUnique({
      where: { ampere },
    });

    if (!row || !row.isActive) {
      throw new NotFoundException(`No active ampere pricing found for ${ampere}A`);
    }

    return row;
  }

  async findOne(id: number) {
    const row = await (this.prisma as any).amperePricing.findUnique({
      where: { id },
    });
    if (!row) throw new NotFoundException('Ampere pricing not found');
    return row;
  }

  async update(id: number, dto: UpdateAmperePricingDto) {
    await this.findOne(id);

    try {
      return await (this.prisma as any).amperePricing.update({
        where: { id },
        data: dto,
      });
    } catch (e: any) {
      if (e?.code === 'P2002') {
        throw new BadRequestException(
          `Ampere pricing for ${dto.ampere}A already exists`,
        );
      }
      throw new BadRequestException('Failed to update ampere pricing');
    }
  }

  async remove(id: number) {
    await this.findOne(id);
    return (this.prisma as any).amperePricing.delete({ where: { id } });
  }
}
