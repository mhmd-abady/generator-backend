import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class ReportsFilterDto {
  // Optional: filter by month/year (monthly reports)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @IsOptional()
  @IsInt()
  @Min(2000)
  year?: number;

  // Optional: location filters
  @IsOptional()
  @IsInt()
  regionId?: number;

  @IsOptional()
  @IsInt()
  neighborhoodId?: number;

   // NEW (optional)
  @IsOptional()
  @IsInt()
  receiverId?: number;
}
