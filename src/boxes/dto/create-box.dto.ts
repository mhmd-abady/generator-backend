import { IsInt, IsString } from 'class-validator';

export class CreateBoxDto {
  @IsString()
  code: string;

  @IsInt()
  neighborhoodId: number;
}
