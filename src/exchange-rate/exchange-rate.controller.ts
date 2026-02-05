import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ExchangeRateService } from './exchange-rate.service';

@Controller('exchange-rate')
export class ExchangeRateController {
  constructor(private service: ExchangeRateService) {}

  @Post()
  setRate(@Body() body: { usdToLbp: number; note?: string }) {
    return this.service.setRate(body.usdToLbp, body.note);
  }

  @Get('active')
  getActive() {
    return this.service.getActiveRate();
  }

  @Get('history')
  getHistory() {
    return this.service.getHistory();
  }

  @Put(':id')
  updateRate(
    @Param('id') id: string,
    @Body() body: { usdToLbp?: number; note?: string },
  ) {
    return this.service.updateRate(parseInt(id, 10), body.usdToLbp, body.note);
  }

  @Delete(':id')
  deleteRate(@Param('id') id: string) {
    return this.service.deleteRate(parseInt(id, 10));
  }
}
