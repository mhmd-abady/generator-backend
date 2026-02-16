import { IsBoolean, IsInt, IsNumber, IsOptional, Min } from 'class-validator';

export class CreateAmperePricingDto {
  @IsInt()
  @Min(0)
  ampere: number;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
