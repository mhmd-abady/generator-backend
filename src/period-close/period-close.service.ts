import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ClosePeriodDto } from './dto/close-period.dto';

@Injectable()
export class PeriodCloseService {
  constructor(private readonly prisma: PrismaService) {}

  private periodValue(year: number, month: number) {
    return year * 12 + month; // stable ordering
  }

  async list() {
    return this.prisma.periodClose.findMany({
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      include: { closedByUser: { select: { id: true, username: true, role: true } } },
    });
  }

  async close(dto: ClosePeriodDto, closedByUserId: number) {
    const now = new Date();
    const nowValue = this.periodValue(now.getFullYear(), now.getMonth() + 1);
    const targetValue = this.periodValue(dto.year, dto.month);

    // ❌ No future closing
    if (targetValue > nowValue) {
      throw new BadRequestException('Cannot close a future period');
    }

    // ❌ Already closed?
    const exists = await this.prisma.periodClose.findUnique({
      where: { month_year: { month: dto.month, year: dto.year } },
    });
    if (exists) {
      throw new BadRequestException('Period already closed');
    }

    return this.prisma.periodClose.create({
      data: {
        month: dto.month,
        year: dto.year,
        closedBy: closedByUserId,
      },
      include: { closedByUser: { select: { id: true, username: true, role: true } } },
    });
  }

  /**
   * Best-practice helper: returns true if a given (month, year) is closed.
   * We treat a period as closed if there exists a close record for that exact month/year
   * OR if you want "close up to X" behavior later, we can change this to use latest closed.
   */
  async isClosed(month: number, year: number): Promise<boolean> {
    const c = await this.prisma.periodClose.findUnique({
      where: { month_year: { month, year } },
      select: { id: true },
    });
    return !!c;
  }

  async assertOpenOrThrow(month: number, year: number) {
    const closed = await this.isClosed(month, year);
    if (closed) throw new BadRequestException('Period is closed');
  }
}
