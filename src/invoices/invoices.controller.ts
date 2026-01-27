import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Body,
} from '@nestjs/common';
import { InvoicesService } from './invoices.service';

@Controller('invoices')
export class InvoicesController {
  constructor(private readonly service: InvoicesService) {}

  // Create invoice from a reading
  @Post('from-reading/:readingId')
  createFromReading(@Param('readingId', ParseIntPipe) readingId: number) {
    return this.service.createFromReading(readingId);
  }

  @Post(':id/fixes')
  addFixes(
    @Param('id', ParseIntPipe) invoiceId: number,
    @Body()
    body: {
      fixesAmount: number;
      fixesNote?: string;
    },
  ) {
    return this.service.addFixesToInvoice(
      invoiceId,
      body.fixesAmount,
      body.fixesNote,
    );
  }

  @Get()
  findAll(
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Query('status') status?: string,
    @Query('subscriberId') subscriberId?: string,
    @Query('regionId') regionId?: string,
    @Query('neighborhoodId') neighborhoodId?: string,
  ) {
    return this.service.findAll({
      year: year !== undefined ? Number(year) : undefined,
      month: month !== undefined ? Number(month) : undefined,
      status,
      subscriberId:
        subscriberId !== undefined ? Number(subscriberId) : undefined,
      regionId: regionId !== undefined ? Number(regionId) : undefined,
      neighborhoodId:
        neighborhoodId !== undefined ? Number(neighborhoodId) : undefined,
    });
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Get(':id/pdf')
  async printInvoice(@Param('id', ParseIntPipe) id: number) {
    return this.service.generateInvoicePdf(id);
  }
}
