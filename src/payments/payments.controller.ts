import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ReversePaymentDto } from './dto/reverse-payment.dto';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  @Post()
  create(@Body() dto: CreatePaymentDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }
  
@Post(':id/reverse')
  reversePayment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReversePaymentDto,
    @Req() req: any,
  ) {
    // best practice: rely on req.user set by auth guard
    // ensure your JWT payload includes userId
    const reversedById = Number(req.user?.id);
    return this.service.reversePayment(id, dto, reversedById);
  }

  @Get('by-subscriber/:subscriberId')
  findBySubscriber(
    @Param('subscriberId', ParseIntPipe) subscriberId: number,
  ) {
    return this.service.findBySubscriber(subscriberId);
  }

  @Get('by-invoice/:invoiceId')
  findByInvoice(
    @Param('invoiceId', ParseIntPipe) invoiceId: number,
  ) {
    return this.service.findByInvoice(invoiceId);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }
}
