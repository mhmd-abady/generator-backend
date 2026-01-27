import { Body, Controller, Get, Post } from '@nestjs/common';
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
}
