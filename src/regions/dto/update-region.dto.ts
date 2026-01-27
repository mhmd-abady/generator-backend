import { PartialType } from '@nestjs/mapped-types';
import { CreateRegionDto } from './create-regions.dto';

export class UpdateRegionDto extends PartialType(CreateRegionDto) {}