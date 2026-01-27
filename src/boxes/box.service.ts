import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBoxDto } from './dto/create-box.dto';
import { UpdateBoxDto } from './dto/update-box.dto';

@Injectable()
export class BoxesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateBoxDto) {
    const neighborhood = await this.prisma.neighborhood.findUnique({
      where: { id: dto.neighborhoodId },
    });
    if (!neighborhood) throw new NotFoundException('Neighborhood not found');

    return this.prisma.box.create({
      data: { code: dto.code, neighborhoodId: dto.neighborhoodId },
    });
  }

  findAll() {
    return this.prisma.box.findMany({
      include: { neighborhood: { include: { region: true } }, meters: true },
      orderBy: { id: 'asc' },
    });
  }

  findByNeighborhood(neighborhoodId: number) {
    return this.prisma.box.findMany({
      where: { neighborhoodId },
      include: { meters: true },
      orderBy: { id: 'asc' },
    });
  }

  async findOne(id: number) {
    const box = await this.prisma.box.findUnique({
      where: { id },
      include: { neighborhood: { include: { region: true } }, meters: true },
    });
    if (!box) throw new NotFoundException('Box not found');
    return box;
  }

  async update(id: number, dto: UpdateBoxDto) {
    await this.findOne(id);

    if (dto.neighborhoodId) {
      const neighborhood = await this.prisma.neighborhood.findUnique({
        where: { id: dto.neighborhoodId },
      });
      if (!neighborhood) throw new NotFoundException('Neighborhood not found');
    }

    return this.prisma.box.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.box.delete({ where: { id } });
  }
}
