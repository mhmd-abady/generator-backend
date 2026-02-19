import { PartialType } from '@nestjs/mapped-types';
import { CreateMeterDto } from './create-meter.dto';
import { IsIn, IsOptional } from 'class-validator';

export class UpdateMeterDto extends PartialType(CreateMeterDto) {
  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE', 'BROKEN', 'REPLACED', 'DISCONNECTED'])
  status?: string;
}
