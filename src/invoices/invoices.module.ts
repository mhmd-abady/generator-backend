import { Module } from '@nestjs/common';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { PeriodCloseModule } from 'src/period-close/period-close.module';
import { ExchangeRateModule } from 'src/exchange-rate/exchange-rate.module';
import { InvoicePdfService } from './invoice-pdf.service';

@Module({
  imports: [PeriodCloseModule,ExchangeRateModule],
  controllers: [InvoicesController],
  providers: [InvoicesService,InvoicePdfService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
