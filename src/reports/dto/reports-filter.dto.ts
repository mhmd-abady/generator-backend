import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';

export class ReportsFilterDto {
  // Optional: filter by month/year (monthly reports)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  @Type(() => Number)
  month?: number;

  @IsOptional()
  @IsInt()
  @Min(2000)
  @Type(() => Number)
  year?: number;

  // Optional: location filters
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  regionId?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  neighborhoodId?: number;

   // NEW (optional)
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  receiverId?: number;

  // Optional: date range filters (ISO date or datetime)
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
