import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, Min } from 'class-validator';

export enum PaymentReceiverType {
  COLLECTOR = 'COLLECTOR',
  EMPLOYEE = 'EMPLOYEE',
  OWNER = 'OWNER',
}

export class CreatePaymentDto {
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsInt()
  subscriberId: number;

  @IsEnum(PaymentReceiverType)
  receiverType: PaymentReceiverType;

  @IsInt()
  receiverId: number;

  @IsOptional()
  @IsInt()
  invoiceId?: number;

  // Allow storing payment as credit when no unpaid invoices exist
  @IsOptional()
  @IsBoolean()
  isPrepayment?: boolean;
}
