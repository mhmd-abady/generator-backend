import { Controller, Get, Param, ParseIntPipe, Res, Query } from '@nestjs/common';
import { StatementsService } from './statements.service';
import type { Response } from 'express';

@Controller('statements')
export class StatementsController {
  constructor(private readonly service: StatementsService) {}

  // GET /statements/subscriber/1
  @Get('subscriber/:subscriberId')
getSubscriberStatement(
  @Param('subscriberId', ParseIntPipe) subscriberId: number,
  @Query('from') from?: string,
  @Query('to') to?: string,
) {
  return this.service.getSubscriberStatement(subscriberId, { from, to });
}

  @Get('subscriber/:subscriberId/pdf')
  async getSubscriberStatementPdf(
    @Param('subscriberId', ParseIntPipe) subscriberId: number,
    @Res() res: Response,
  ) {
    const pdfBuffer =
      await this.service.getSubscriberStatementPdf(subscriberId);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename=statement.pdf',
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }
}
