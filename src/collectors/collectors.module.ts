import { Module } from '@nestjs/common';
import { CollectorsController } from './collectors.controller';
import { CollectorsService } from './collectors.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ReportsModule } from '../reports/reports.module';

@Module({
  imports: [PrismaModule, ReportsModule],
  controllers: [CollectorsController],
  providers: [CollectorsService],
  exports: [CollectorsService],
})
export class CollectorsModule {}
