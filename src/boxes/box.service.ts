import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBoxDto } from './dto/create-box.dto';
import { UpdateBoxDto } from './dto/update-box.dto';

@Injectable()
export class BoxesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateBoxDto) {
    const neighborhood = await this.prisma.neighborhood.findUnique({
      where: { id: dto.neighborhoodId },
      select: { id: true, regionId: true },
    });
    if (!neighborhood) throw new NotFoundException('Neighborhood not found');

    try {
      return await this.prisma.box.create({
        data: {
          code: dto.code,
          neighborhoodId: dto.neighborhoodId,
          regionId: neighborhood.regionId,
        },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') {
        throw new BadRequestException(
          'Box code already exists in this region',
        );
      }
      throw new BadRequestException('Failed to create box');
    }
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
    const existing = await this.prisma.box.findUnique({
      where: { id },
      include: { neighborhood: true },
    });
    if (!existing) throw new NotFoundException('Box not found');

    let regionId = existing.regionId;
    let neighborhoodId = existing.neighborhoodId;

    if (dto.neighborhoodId) {
      const neighborhood = await this.prisma.neighborhood.findUnique({
        where: { id: dto.neighborhoodId },
        select: { id: true, regionId: true },
      });
      if (!neighborhood) throw new NotFoundException('Neighborhood not found');
      regionId = neighborhood.regionId;
      neighborhoodId = neighborhood.id;
    }

    try {
      return await this.prisma.box.update({
        where: { id },
        data: {
          ...(dto.code !== undefined ? { code: dto.code } : {}),
          neighborhoodId,
          regionId,
        },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') {
        throw new BadRequestException(
          'Box code already exists in this region',
        );
      }
      throw new BadRequestException('Failed to update box');
    }
  }

  async findByRegion(regionId: number) {
    return this.prisma.box.findMany({
      where: { regionId },
      include: { meters: true },
      orderBy: { id: 'asc' },
    });
  }
  
  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.box.delete({ where: { id } });
  }
}
