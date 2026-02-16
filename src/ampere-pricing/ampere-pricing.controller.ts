import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AmperePricingService } from './ampere-pricing.service';
import { CreateAmperePricingDto } from './dto/create-ampere-pricing.dto';
import { UpdateAmperePricingDto } from './dto/update-ampere-pricing.dto';

@Controller('ampere-pricing')
export class AmperePricingController {
  constructor(private readonly service: AmperePricingService) {}

  @Post()
  create(@Body() dto: CreateAmperePricingDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(@Query('activeOnly') activeOnly?: string) {
    return this.service.findAll({ activeOnly: activeOnly === 'true' });
  }

  @Get('by-ampere/:ampere')
  findByAmpere(@Param('ampere', ParseIntPipe) ampere: number) {
    return this.service.findByAmpere(ampere);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAmperePricingDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
