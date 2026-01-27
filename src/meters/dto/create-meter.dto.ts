import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateMeterDto {
  @IsString()
  number: string; // رقم العداد (unique)

  @IsInt()
  boxId: number; // العلبة

  @IsInt()
  subscriberId: number; // المشترك

  @IsOptional()
  @IsInt()
  @Min(0)
  ampere?: number; // أمبير ثابت (اختياري)
}
