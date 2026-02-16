import {
  IsInt,
  IsNumber,
  IsOptional,
  Min,
  Max,
} from 'class-validator';

export class CreateTariffDto {
  @IsOptional()
  @IsInt()
  regionId?: number;

  @IsOptional()
  @IsInt()
  neighborhoodId?: number;

  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @IsInt()
  @Min(2000)
  year: number;

  @IsNumber()
  @Min(0)
  kwhRate: number;
}
