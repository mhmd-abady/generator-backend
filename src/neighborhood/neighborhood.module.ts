import { Module } from '@nestjs/common';
import { NeighborhoodsController } from './neighborhood.controller';
import { NeighborhoodsService } from './neighborhood.service';

@Module({
  controllers: [NeighborhoodsController],
  providers: [NeighborhoodsService],
  exports: [NeighborhoodsService],
})
export class NeighborhoodsModule {}
