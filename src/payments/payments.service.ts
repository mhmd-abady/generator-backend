import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto, PaymentReceiverType } from './dto/create-payment.dto';
import { PeriodCloseService } from 'src/period-close/period-close.service';
import { Prisma } from '@prisma/client';
import { ReversePaymentDto } from './dto/reverse-payment.dto';

type PaymentDateRange = {
  from?: string;
  to?: string;
};

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService, private periodClose: PeriodCloseService) {}

  private async ensureReceiver(
    receiverId: number,
    receiverType: PaymentReceiverType,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: receiverId },
    });

    if (!user) throw new NotFoundException('Receiver not found');

    if (
      (receiverType === PaymentReceiverType.COLLECTOR &&
        user.role !== 'COLLECTOR') ||
      (receiverType === PaymentReceiverType.EMPLOYEE &&
        user.role !== 'EMPLOYEE') ||
      (receiverType === PaymentReceiverType.OWNER && user.role !== 'ADMIN')
    ) {
      throw new BadRequestException('Receiver role mismatch');
    }

    return user;
  }

  private async ensureSubscriber(subscriberId: number) {
    const sub = await this.prisma.subscriber.findUnique({
      where: { id: subscriberId },
    });
    if (!sub) throw new NotFoundException('Subscriber not found');
    return sub;
  }

  async create(dto: CreatePaymentDto) {
  if (dto.amount <= 0)
    throw new BadRequestException('Amount must be greater than 0');

  await this.ensureSubscriber(dto.subscriberId);
  await this.ensureReceiver(dto.receiverId, dto.receiverType);

  return this.prisma.$transaction(async (tx) => {
    const invoices = await tx.invoice.findMany({
      where: {
        meter: { subscriberId: dto.subscriberId },
        status: { not: 'CANCELLED' },
        remainingBalance: { gt: 0 },
      },
      orderBy: [{ year: 'asc' }, { month: 'asc' }, { id: 'asc' }],
    });

    if (!invoices.length) {
      const creditPayment = await tx.payment.create({
        data: {
          amount: dto.amount,
          subscriberId: dto.subscriberId,
          receiverType: dto.receiverType,
          receiverId: dto.receiverId,
          invoiceId: null,
          isPrepayment: !!dto.isPrepayment,
        },
        include: {
          subscriber: true,
          receiver: true,
          invoice: true,
        },
      });

      return {
        ok: true,
        payment: creditPayment,
        invoice: null,
        applied: [],
        remainingUnallocated: dto.amount,
        creditOnly: true,
      };
    }

    const totalOutstanding = invoices.reduce(
      (sum, inv) => sum + inv.remainingBalance,
      0,
    );

    if (dto.amount - totalOutstanding > 1e-6) {
      throw new BadRequestException(
        `Payment exceeds total outstanding balance (${totalOutstanding})`,
      );
    }

    let remaining = dto.amount;
    const applied: Array<{
      invoiceId: number;
      amount: number;
      paymentId: number;
    }> = [];

    for (const inv of invoices) {
      if (remaining <= 0) break;

      const amountToApply = Math.min(remaining, inv.remainingBalance);
      if (amountToApply <= 0) continue;

      const payment = await tx.payment.create({
        data: {
          amount: amountToApply,
          subscriberId: dto.subscriberId,
          receiverType: dto.receiverType,
          receiverId: dto.receiverId,
          invoiceId: inv.id,
        },
      });

      const newAmountPaid = inv.amountPaid + amountToApply;
      const newRemaining = inv.totalDue - newAmountPaid;

      await tx.invoice.update({
        where: { id: inv.id },
        data: {
          amountPaid: newAmountPaid,
          remainingBalance: Math.max(newRemaining, 0),
          status: newRemaining <= 0 ? 'PAID' : 'PARTIALLY_PAID',
        },
      });

      applied.push({
        invoiceId: inv.id,
        amount: amountToApply,
        paymentId: payment.id,
      });

      remaining -= amountToApply;
    }

    // Backward-compatible shape for existing frontend:
    // return first applied payment + invoice snapshot, plus FIFO details.
    let paymentSummary: any = null;
    let invoiceSummary: any = null;
    if (applied.length > 0) {
      const firstApplied = applied[0];
      paymentSummary = await tx.payment.findUnique({
        where: { id: firstApplied.paymentId },
        include: { subscriber: true, receiver: true, invoice: true },
      });
      if (paymentSummary?.invoiceId) {
        invoiceSummary = await tx.invoice.findUnique({
          where: { id: paymentSummary.invoiceId },
        });
      }
    }

    return {
      ok: true,
      payment: paymentSummary,
      invoice: invoiceSummary,
      applied,
      remainingUnallocated: remaining,
    };
  });
}


  private buildPaidAtFilter(range?: PaymentDateRange) {
    if (!range?.from && !range?.to) return undefined;

    const paidAt: { gte?: Date; lte?: Date } = {};

    if (range.from) {
      const fromDate = new Date(range.from);
      if (Number.isNaN(fromDate.getTime())) {
        throw new BadRequestException('Invalid from date');
      }
      paidAt.gte = fromDate;
    }

    if (range.to) {
      const toDate = new Date(range.to);
      if (Number.isNaN(toDate.getTime())) {
        throw new BadRequestException('Invalid to date');
      }
      toDate.setHours(23, 59, 59, 999);
      paidAt.lte = toDate;
    }

    return paidAt;
  }

  findAll(range?: PaymentDateRange) {
    const paidAt = this.buildPaidAtFilter(range);
    return this.prisma.payment.findMany({
      where: paidAt ? { paidAt } : undefined,
      orderBy: { id: 'desc' },
      include: {
        subscriber: true,
        receiver: true,
        invoice: true,
      },
    });
  }
async reversePayment(
  paymentId: number,
  dto: ReversePaymentDto,
  reversedById: number,
) {
  if (!reversedById || Number.isNaN(reversedById)) {
    throw new BadRequestException('Invalid user context');
  }

  const reason = dto.reason.trim();
  const requestedAmount = dto.amount;

  return this.prisma.$transaction(async (tx) => {
    const original = await tx.payment.findUnique({
      where: { id: paymentId },
    });

    if (!original) throw new NotFoundException('Payment not found');

    const alreadyReversal = await tx.payment_reversal.findFirst({
      where: { reversalPaymentId: original.id },
    });

    if (alreadyReversal) {
      throw new BadRequestException('Cannot reverse a reversal payment');
    }

    // Sum amounts already reversed for this original payment
    const existingReversals = await tx.payment_reversal.findMany({
      where: { originalPaymentId: original.id },
      include: { reversalPayment: true },
    });
    const totalReversed = existingReversals.reduce(
      (sum, rev) => sum + Math.abs(rev.reversalPayment.amount),
      0,
    );
    const availableToReverse = original.amount - totalReversed;

    if (availableToReverse <= 0) {
      throw new BadRequestException('Payment already fully reversed');
    }

    const amountToReverse =
      requestedAmount !== undefined ? requestedAmount : availableToReverse;

    if (amountToReverse <= 0) {
      throw new BadRequestException('Reversal amount must be greater than 0');
    }

    if (amountToReverse - availableToReverse > 1e-6) {
      throw new BadRequestException(
        `Reversal amount exceeds remaining reversible amount (${availableToReverse})`,
      );
    }

    const reversalAmount = -Math.abs(amountToReverse);

    const reversalPayment = await tx.payment.create({
      data: {
        amount: reversalAmount,
        paidAt: new Date(),

        subscriberId: original.subscriberId,
        invoiceId: original.invoiceId,
        isPrepayment: original.isPrepayment,

        /*receiverType: PaymentReceiverType.OWNER,
        receiverId: reversedById,*/

        //`keep original receiver
    receiverType: original.receiverType,
    receiverId: reversedById,
      },
    });

    await tx.payment.update({
      where: { id: original.id },
      data: {
        isReversed: amountToReverse >= availableToReverse,
        reversedAt: new Date(),
        reversedById,
      },
    });

    await tx.payment_reversal.create({
      data: {
        originalPaymentId: original.id,
        reversalPaymentId: reversalPayment.id,
        reason,
        reversedById,
      },
    });

    if (original.invoiceId) {
      await this.recomputeInvoiceBalance(tx, original.invoiceId);
    }

    return {
      ok: true,
      originalPaymentId: original.id,
      reversalPaymentId: reversalPayment.id,
    };
  });
}
  // --- Helpers ---
  private async recomputeInvoiceBalance(
    tx: Prisma.TransactionClient,
    invoiceId: number,
  ) {
    const invoice = await tx.invoice.findUnique({
      where: { id: invoiceId },
      select: { totalDue: true },
    });

    if (!invoice) return;

    const agg = await tx.payment.aggregate({
      where: { invoiceId },
      _sum: { amount: true },
    });

    const reversalAgg = await tx.payment.aggregate({
      where: { invoiceId, reversedFrom: { isNot: null } },
      _sum: { amount: true },
    });

    const paid = agg._sum.amount ?? 0;
    const reversedAbs = Math.abs(reversalAgg._sum.amount ?? 0);
    const remaining = invoice.totalDue - paid;

    let status: any;
    if (remaining <= 0) {
      status = 'PAID';
    } else if (reversedAbs > 0) {
      status = paid <= 0 ? 'REVERSED_FULL' : 'REVERSED_PARTIAL';
    } else if (paid > 0) {
      status = 'PARTIALLY_PAID';
    } else {
      status = 'ISSUED';
    }

    await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        amountPaid: paid,
        remainingBalance: Math.max(remaining, 0),
        status,
      },
    });
  }

  async findOne(id: number) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        subscriber: true,
        receiver: true,
        invoice: true,
      },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }

  findBySubscriber(subscriberId: number, range?: PaymentDateRange) {
    const paidAt = this.buildPaidAtFilter(range);
    return this.prisma.payment.findMany({
      where: { subscriberId, ...(paidAt ? { paidAt } : {}) },
      orderBy: { id: 'desc' },
      include: { invoice: true, receiver: true },
    });
  }

  findByInvoice(invoiceId: number) {
    return this.prisma.payment.findMany({
      where: { invoiceId },
      orderBy: { id: 'desc' },
      include: { subscriber: true, receiver: true },
    });
  }
}
