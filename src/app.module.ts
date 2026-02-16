import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RegionsModule } from './regions/regions.module';
import { NeighborhoodsModule } from './neighborhood/neighborhood.module';
import { BoxesModule } from './boxes/box.module';
import { MetersModule } from './meters/meters.module';
import { SubscribersModule } from './subscriber/subscriber.module';
import { PrismaModule } from './prisma/prisma.module';
import { TariffsModule } from './tariffs/tariffs.module';
import { ReadingsModule } from './readings/readings.module';
import { InvoicesModule } from './invoices/invoices.module';
import { PaymentsModule } from './payments/payments.module';
import { StatementsModule } from './statements/statements.module';
import { ReportsModule } from './reports/reports.module';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { PeriodCloseModule } from './period-close/period-close.module';
import { ExchangeRateModule } from './exchange-rate/exchange-rate.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { CollectorsModule } from './collectors/collectors.module';
import { AmperePricingModule } from './ampere-pricing/ampere-pricing.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot({
   throttlers: [
    {
      ttl: 60,
      limit: 100,
    },
  ],
    }),
    AuthModule,
    PrismaModule,
    SubscribersModule,
    MetersModule,
    BoxesModule,
    NeighborhoodsModule,
    RegionsModule,
    TariffsModule,
    ReadingsModule,
    InvoicesModule,
    PaymentsModule,
    StatementsModule,
    ReportsModule,
    PeriodCloseModule,
    ExchangeRateModule,
    DashboardModule,
    CollectorsModule,
    AmperePricingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
