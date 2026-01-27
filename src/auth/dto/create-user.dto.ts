import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';
import { UserRole } from '@prisma/client';

export class CreateUserDto {
  @IsString()
  username: string;

  @IsEmail()
  email: string; 

  @IsString()
  @MinLength(6) // strong baseline
  password: string;

  @IsEnum(UserRole)
  role: UserRole; // EMPLOYEE or COLLECTOR (ADMIN optional if you allow)
}
