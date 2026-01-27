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
import { TariffsService } from './tariffs.service';
import { CreateTariffDto } from './dto/create-tariff.dto';
import { UpdateTariffDto } from './dto/update-tariff.dto';

@Controller('tariffs')
export class TariffsController {
  constructor(private readonly service: TariffsService) {}

  @Post()
  create(@Body() dto: CreateTariffDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  // ✅ Put this BEFORE :id to avoid route conflicts
  // Example:
  // /tariffs/by-period/2025/12            -> global
  // /tariffs/by-period/2025/12?regionId=1 -> region scoped
  // /tariffs/by-period/2025/12?neighborhoodId=2 -> neighborhood scoped
  @Get('by-period/:year/:month')
  findByPeriod(
    @Param('year', ParseIntPipe) year: number,
    @Param('month', ParseIntPipe) month: number,
    @Query('regionId') regionId?: string,
    @Query('neighborhoodId') neighborhoodId?: string,
  ) {
    return this.service.findByScopeAndPeriod({
      year,
      month,
      regionId: regionId !== undefined ? Number(regionId) : undefined,
      neighborhoodId:
        neighborhoodId !== undefined ? Number(neighborhoodId) : undefined,
    });
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTariffDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
