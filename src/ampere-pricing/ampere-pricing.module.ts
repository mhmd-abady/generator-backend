import { Module } from '@nestjs/common';
import { AmperePricingController } from './ampere-pricing.controller';
import { AmperePricingService } from './ampere-pricing.service';

@Module({
  controllers: [AmperePricingController],
  providers: [AmperePricingService],
  exports: [AmperePricingService],
})
export class AmperePricingModule {}
