import { Body, Controller, Get, Param, ParseIntPipe, Post, Delete, Patch } from '@nestjs/common';
import { RegionsService } from './regions.service';
import { CreateRegionDto } from './dto/create-regions.dto';
import { UpdateRegionDto } from './dto/update-region.dto';

@Controller('regions')
export class RegionsController {
  constructor(private service: RegionsService) {}

  @Post()
  create(@Body() dto: CreateRegionDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id')
update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRegionDto) {
  return this.service.update(id, dto);
}

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
