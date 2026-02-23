import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('overview')
  overview(
    @Query('month') month?: number,
    @Query('year') year?: number,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('regionId') regionId?: number,
    @Query('neighborhoodId') neighborhoodId?: number,
  ) {
    return this.service.overview({
      month: month ? Number(month) : undefined,
      year: year ? Number(year) : undefined,
      from,
      to,
      regionId: regionId ? Number(regionId) : undefined,
      neighborhoodId: neighborhoodId ? Number(neighborhoodId) : undefined,
    });
  }

 @Get('trends/monthly')
monthlyTrend(
  @Query('year') year?: string,
  @Query('from') from?: string,
  @Query('to') to?: string,
  @Query('regionId') regionId?: string,
  @Query('neighborhoodId') neighborhoodId?: string,
) {
  return this.service.monthlyTrend({
    year: year ? Number(year) : undefined,
    from,
    to,
    regionId: regionId ? Number(regionId) : undefined,
    neighborhoodId: neighborhoodId ? Number(neighborhoodId) : undefined,
  });
}

  @Get('breakdown/regions')
  regionsBreakdown(
    @Query('month') month?: number,
    @Query('year') year?: number,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('regionId') regionId?: number,
    @Query('neighborhoodId') neighborhoodId?: number,
  ) {
    return this.service.regionsBreakdown({
      month: month ? Number(month) : undefined,
      year: year ? Number(year) : undefined,
      from,
      to,
      regionId: regionId ? Number(regionId) : undefined,
      neighborhoodId: neighborhoodId ? Number(neighborhoodId) : undefined,
    });
  }

  @Get('period-status')
  periodStatus(
    @Query('month') month?: number,
    @Query('year') year?: number,
  ) {
    return this.service.periodStatus(
      month ? Number(month) : undefined,
      year ? Number(year) : undefined,
    );
  }
}
