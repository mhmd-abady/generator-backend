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
import { MetersService } from './meters.service';
import { CreateMeterDto } from './dto/create-meter.dto';
import { UpdateMeterDto } from './dto/update-meter.dto';

@Controller('meters')
export class MetersController {
  constructor(private readonly service: MetersService) {}

  @Post()
  create(@Body() dto: CreateMeterDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('by-filters')
  findByFilters(
    @Query('neighborhoodId') neighborhoodId?: string,
    @Query('regionId') regionId?: string,
  ) {
    return this.service.findByFilters({
      ...(neighborhoodId ? { neighborhoodId: Number(neighborhoodId) } : {}),
      ...(regionId ? { regionId: Number(regionId) } : {}),
    });
  }
   // filters
  @Get('by-box/:boxId')
  findByBox(@Param('boxId', ParseIntPipe) boxId: number) {
    return this.service.findByBox(boxId);
  }

  @Get('by-subscriber/:subscriberId')
  findBySubscriber(
    @Param('subscriberId', ParseIntPipe) subscriberId: number,
  ) {
    return this.service.findBySubscriber(subscriberId);
  }


  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMeterDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }

 
  
}
