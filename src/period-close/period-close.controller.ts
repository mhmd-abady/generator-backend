import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { PeriodCloseService } from './period-close.service';
import { ClosePeriodDto } from './dto/close-period.dto';
import { Roles } from '../auth/roles/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('period-close')
export class PeriodCloseController {
  constructor(private readonly service: PeriodCloseService) {}

  @Roles(UserRole.ADMIN)
  @Get()
  list() {
    return this.service.list();
  }

  @Roles(UserRole.ADMIN)
  @Post()
  close(@Body() dto: ClosePeriodDto, @Req() req: any) {
    return this.service.close(dto, req.user.id);
  }
}
