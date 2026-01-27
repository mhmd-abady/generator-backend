import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PeriodCloseModule } from '../period-close/period-close.module';

@Module({
  imports: [PrismaModule, PeriodCloseModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
