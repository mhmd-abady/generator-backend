import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRegionDto } from './dto/create-regions.dto';
import { UpdateRegionDto } from './dto/update-region.dto';

@Injectable()
export class RegionsService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreateRegionDto) {
    return this.prisma.region.create({ data: dto });
  }

  findAll() {
    return this.prisma.region.findMany({
      include: { neighborhoods: true },
      orderBy: { id: 'asc' },
    });
  }

  async findOne(id: number) {
    const region = await this.prisma.region.findUnique({
      where: { id },
      include: { neighborhoods: true },
    });
    if (!region) throw new NotFoundException('Region not found');
    return region;
  }

  async update(id: number, dto: UpdateRegionDto) {
  const exists = await this.prisma.region.findUnique({ where: { id } });
  if (!exists) throw new NotFoundException('Region not found');

  return this.prisma.region.update({
    where: { id },
    data: dto,
  });
}

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.region.delete({ where: { id } });
  }
}
