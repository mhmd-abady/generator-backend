import { PartialType } from '@nestjs/mapped-types';
import { CreateAmperePricingDto } from './create-ampere-pricing.dto';

export class UpdateAmperePricingDto extends PartialType(CreateAmperePricingDto) {}
