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
import { ReadingsService } from './readings.service';
import { CreateReadingDto } from './dto/create-reading.dto';
import { UpdateReadingDto } from './dto/update-reading.dto';
import { BulkCreateReadingDto } from './dto/bulk-create-reading.dto';

@Controller('readings')
export class ReadingsController {
  constructor(private readonly service: ReadingsService) {}

  @Post()
  create(@Body() dto: CreateReadingDto) {
    return this.service.create(dto);
  }

  @Post('bulk')
bulkCreate(@Body() dto: BulkCreateReadingDto) {
  return this.service.bulkCreate(dto);
}

  @Get()
  findAll() {
    return this.service.findAll();
  }

 
  @Get('by-meter/:meterId')
  findByMeter(@Param('meterId', ParseIntPipe) meterId: number) {
    return this.service.findByMeter(meterId);
  }

/*  @Get('by-period')
findByPeriod(
  @Query('month', ParseIntPipe) month: number,
  @Query('year', ParseIntPipe) year: number,
  @Query('neighborhoodId') neighborhoodId?: string,
  @Query('boxId') boxId?: string,
) {
  return this.service.findMetersWithReadings({
    month,
    year,
    neighborhoodId: neighborhoodId ? Number(neighborhoodId) : undefined,
    boxId: boxId ? Number(boxId) : undefined,
  });
}*/
@Get('by-period')
findByPeriod(
  @Query('month', new ParseIntPipe({ optional: true })) month?: number,
  @Query('year', new ParseIntPipe({ optional: true })) year?: number,
  @Query('neighborhoodId') neighborhoodId?: string,
  @Query('boxId') boxId?: string,
  @Query('regionId') regionId?: string,
) {
  if (!month || !year) {
    throw new Error("month and year are required");
  }

  return this.service.findMetersWithReadings({
    month,
    year,
    neighborhoodId: neighborhoodId ? Number(neighborhoodId) : undefined,
    boxId: boxId ? Number(boxId) : undefined,
    regionId: regionId ? Number(regionId) : undefined,
  });
}

 @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateReadingDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }

  
}
