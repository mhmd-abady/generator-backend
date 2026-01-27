import {
  IsArray,
  IsInt,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class BulkReadingRowDto {
  @IsInt()
  meterId: number;

  @IsInt()
  @Min(0)
  currentReading: number;
}

export class BulkCreateReadingDto {
  @IsInt()
  @Min(1)
  month: number;

  @IsInt()
  @Min(2000)
  year: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkReadingRowDto)
  rows: BulkReadingRowDto[];
}
