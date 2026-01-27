import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNeighborhoodDto } from './dto/create-neighborhood.dto';
import { UpdateNeighborhoodDto } from './dto/update-neighborhood.dto';

@Injectable()
export class NeighborhoodsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateNeighborhoodDto) {
    const region = await this.prisma.region.findUnique({ where: { id: dto.regionId } });
    if (!region) throw new NotFoundException('Region not found');

    return this.prisma.neighborhood.create({
      data: { name: dto.name, regionId: dto.regionId },
    });
  }

  findAll() {
    return this.prisma.neighborhood.findMany({
      include: { region: true, boxes: true },
      orderBy: { id: 'asc' },
    });
  }

  findByRegion(regionId: number) {
    return this.prisma.neighborhood.findMany({
      where: { regionId },
      include: { boxes: true },
      orderBy: { id: 'asc' },
    });
  }

  async findOne(id: number) {
    const n = await this.prisma.neighborhood.findUnique({
      where: { id },
      include: { region: true, boxes: true },
    });
    if (!n) throw new NotFoundException('Neighborhood not found');
    return n;
  }

  async update(id: number, dto: UpdateNeighborhoodDto) {
    await this.findOne(id);

    if (dto.regionId) {
      const region = await this.prisma.region.findUnique({ where: { id: dto.regionId } });
      if (!region) throw new NotFoundException('Region not found');
    }

    return this.prisma.neighborhood.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.neighborhood.delete({ where: { id } });
  }
}
