import { IsInt, IsString } from 'class-validator';

export class CreateNeighborhoodDto {
  @IsString()
  name: string;

  @IsInt()
  regionId: number;
}
