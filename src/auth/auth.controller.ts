import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from './jwt/public.decorator';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { Roles } from './roles/roles.decorator';
import { UserRole } from '@prisma/client';
import { RolesGuard } from './roles/roles.guard';
import { Throttle } from '@nestjs/throttler';
import { ChangePasswordDto } from './dto/change-password.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LogoutDto } from './dto/logout.dto';


@Controller('auth')
export class AuthController {
  constructor(private service: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60 } })
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.service.login(dto);
  }

  @Roles(UserRole.ADMIN)
  @Post('create-user')
  createUser(@Body() dto: CreateUserDto, @Req() req: any) {
    return this.service.createUser(dto, req.user);
  }

  @Post('change-password')
  changePassword(@Req() req: any, @Body() dto: ChangePasswordDto) {
    return this.service.changePassword(req.user.userId, dto);
  }

  @Public()
  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.service.refresh(dto.refreshToken);
  }

  @Public()
  @Post('logout')
  async logout(@Body() dto: LogoutDto) {
    return this.service.logout(dto.refreshToken);
  }
}
