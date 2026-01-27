import { Module } from '@nestjs/common';
import { PeriodCloseController } from './period-close.controller';
import { PeriodCloseService } from './period-close.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PeriodCloseController],
  providers: [PeriodCloseService],
  exports: [PeriodCloseService],
})
export class PeriodCloseModule {}
