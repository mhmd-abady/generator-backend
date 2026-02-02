import {
  Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post,
} from '@nestjs/common';
import { BoxesService } from './box.service';
import { CreateBoxDto } from './dto/create-box.dto';
import { UpdateBoxDto } from './dto/update-box.dto';

@Controller('boxes')
export class BoxesController {
  constructor(private readonly service: BoxesService) {}

  @Post()
  create(@Body() dto: CreateBoxDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('by-neighborhood/:neighborhoodId')
  findByNeighborhood(
    @Param('neighborhoodId', ParseIntPipe) neighborhoodId: number,
  ) {
    return this.service.findByNeighborhood(neighborhoodId);
  }
   @Get('by-region/:regionId')
  findByRegion(
    @Param('regionId', ParseIntPipe) regionId: number,
  ) {
    return this.service.findByRegion(regionId);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateBoxDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
