import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTariffDto } from './dto/create-tariff.dto';
import { UpdateTariffDto } from './dto/update-tariff.dto';
@Injectable()
export class TariffsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────
  async create(dto: CreateTariffDto) {
    // ❌ forbid mixed scope
    if (dto.regionId && dto.neighborhoodId) {
      throw new BadRequestException(
        'Tariff cannot be scoped to both region and neighborhood',
      );
    }

    try {
      const data = {
        month: dto.month,
        year: dto.year,
        kwhRate: dto.kwhRate,
        regionId: dto.regionId ?? null,
        neighborhoodId: dto.neighborhoodId ?? null,
      };

      return await this.prisma.tariff.create({
        data: data as any,
      });
    } catch (e: any) {
      if (e?.code === 'P2002') {
        throw new BadRequestException(
          'Tariff already exists for this scope and period',
        );
      }
      throw new BadRequestException('Failed to create tariff');
    }
  }

  async findByScopeAndPeriod(params: {
  month: number;
  year: number;
  regionId?: number;
  neighborhoodId?: number;
}) {
  const { month, year, regionId, neighborhoodId } = params;

  // ❌ forbid mixed scope
  if (regionId && neighborhoodId) {
    throw new BadRequestException(
      'Provide either regionId or neighborhoodId, not both',
    );
  }

  const tariff = await this.prisma.tariff.findFirst({
    where: {
      month,
      year,
      regionId: regionId ?? null,
      neighborhoodId: neighborhoodId ?? null,
    },
    include: { region: true, neighborhood: true },
  });

  if (!tariff) {
    throw new NotFoundException('Tariff not found for this scope and period');
  }

  return tariff;
}


  // ─────────────────────────────────────────────
  findAll() {
    return this.prisma.tariff.findMany({
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      include: {
        region: true,
        neighborhood: true,
      },
    });
  }

  // ─────────────────────────────────────────────
  async findOne(id: number) {
    const tariff = await this.prisma.tariff.findUnique({
      where: { id },
      include: { region: true, neighborhood: true },
    });

    if (!tariff) throw new NotFoundException('Tariff not found');
    return tariff;
  }

  // ─────────────────────────────────────────────
  async update(id: number, dto: UpdateTariffDto) {
    await this.findOne(id);

    if (dto.regionId && dto.neighborhoodId) {
      throw new BadRequestException(
        'Tariff cannot be scoped to both region and neighborhood',
      );
    }

    try {
      return await this.prisma.tariff.update({
        where: { id },
        data: dto,
      });
    } catch (e: any) {
      if (e?.code === 'P2002') {
        throw new BadRequestException(
          'Tariff already exists for this scope and period',
        );
      }
      throw new BadRequestException('Failed to update tariff');
    }
  }

  // ─────────────────────────────────────────────
  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.tariff.delete({ where: { id } });
  }

  // ─────────────────────────────────────────────
  // ⭐ IMPORTANT: TARIFF RESOLUTION (used by invoices)
 async resolveTariff(params: {
  neighborhoodId: number;
  regionId: number;
  month: number;
  year: number;
}) {
  const { neighborhoodId, regionId, month, year } = params;

  const periodValue = year * 12 + month;

  const findLatest = (where: any) =>
    this.prisma.tariff.findFirst({
      where: {
        ...where,
        AND: [
          {
            OR: [
              { year: { lt: year } },
              { year, month: { lte: month } },
            ],
          },
        ],
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });

  // 1️⃣ Neighborhood
  const neighborhoodTariff = await findLatest({ neighborhoodId });
  if (neighborhoodTariff) return neighborhoodTariff;

  // 2️⃣ Region
  const regionTariff = await findLatest({ regionId });
  if (regionTariff) return regionTariff;

  // 3️⃣ Global
  const globalTariff = await findLatest({
    regionId: null,
    neighborhoodId: null,
  });
  if (globalTariff) return globalTariff;

  throw new NotFoundException('No tariff found for this or previous periods');
}

}
