import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StatementPdfService } from './statements-pdf.service';

@Injectable()
export class StatementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfService: StatementPdfService,
  ) {}

async getSubscriberStatement(
  subscriberId: number,
  params?: { from?: string; to?: string },
) {
  const subscriber = await this.prisma.subscriber.findUnique({
    where: { id: subscriberId },
  });
  if (!subscriber) {
    throw new NotFoundException('Subscriber not found');
  }

  const fromDate = params?.from ? new Date(params.from) : undefined;
  const toDate = params?.to ? new Date(params.to) : undefined;

  // 1️⃣ Calculate opening balance (before "from")
  let openingBalance = 0;

if (fromDate) {
  const lastInvoiceBefore = await this.prisma.invoice.findFirst({
    where: {
      meter: { subscriberId },
      createdAt: { lt: fromDate },
    },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
    select: { remainingBalance: true },
  });

  openingBalance = lastInvoiceBefore?.remainingBalance ?? 0;
}
  /*let openingBalance = 0;

  if (fromDate) {
    const invoicesBefore = await this.prisma.invoice.findMany({
      where: {
        meter: { subscriberId },
        createdAt: { lt: fromDate },
      },
      select: { totalDue: true },
    });

    const paymentsBefore = await this.prisma.payment.findMany({
      where: {
        subscriberId,
        paidAt: { lt: fromDate },
      },
      select: { amount: true },
    });

    openingBalance =
      invoicesBefore.reduce((s, i) => s + i.totalDue, 0) -
      paymentsBefore.reduce((s, p) => s + p.amount, 0);
  }*/

  // 2️⃣ Fetch invoices inside range
  const invoices = await this.prisma.invoice.findMany({
    where: {
      meter: { subscriberId },
      ...(fromDate || toDate
        ? {
            createdAt: {
              ...(fromDate ? { gte: fromDate } : {}),
              ...(toDate ? { lte: toDate } : {}),
            },
          }
        : {}),
    },
    select: {
      id: true,
      totalDue: true,
      createdAt: true,
      month: true,
      year: true,
      exchangeRate: true,
    },
  });

  // 3️⃣ Fetch payments inside range
  const payments = await this.prisma.payment.findMany({
    where: {
      subscriberId,
      ...(fromDate || toDate
        ? {
            paidAt: {
              ...(fromDate ? { gte: fromDate } : {}),
              ...(toDate ? { lte: toDate } : {}),
            },
          }
        : {}),
    },
    select: {
      id: true,
      amount: true,
      paidAt: true,
      invoice: { select: { exchangeRate: true } },
    },
  });

  // 4️⃣ Merge into timeline
  const rows: {
    date: Date;
    type: 'INVOICE' | 'PAYMENT';
    reference: string;
    debitUsd: number;
  creditUsd: number;
  debitLbp: number;
  creditLbp: number;
  }[] = [];

  for (const inv of invoices) {
    const rate = inv.exchangeRate ?? 1;
    rows.push({
      date: inv.createdAt,
      type: 'INVOICE',
      reference: `Invoice #${inv.id} (${inv.month}/${inv.year})`,
      debitUsd: inv.totalDue,
    creditUsd: 0,
    debitLbp: inv.totalDue * rate,
    creditLbp: 0,
    });
  }

  for (const pay of payments) {
    const rate = pay.invoice?.exchangeRate ?? 1;
    rows.push({
      date: pay.paidAt,
      type: 'PAYMENT',
      reference: `Payment #${pay.id}`,
      debitUsd: 0,
    creditUsd: pay.amount,
    debitLbp: 0,
    creditLbp: pay.amount * rate,
    });
  }

  rows.sort((a, b) => a.date.getTime() - b.date.getTime());

  // 5️⃣ Running balance (starting from opening balance)
 let balanceUsd = openingBalance;
let balanceLbp = 0;

const statement = rows.map((row) => {
  balanceUsd += row.debitUsd;
  balanceUsd -= row.creditUsd;

  balanceLbp += row.debitLbp;
  balanceLbp -= row.creditLbp;

  return { ...row, balanceUsd, balanceLbp };
});

return {
  subscriber: {
    id: subscriber.id,
    fullName: subscriber.fullName,
    phone: subscriber.phone,
  },
  openingBalanceUsd: openingBalance,
  statement,
  finalBalanceUsd: balanceUsd,
  finalBalanceLbp: balanceLbp,
};
}


  async getSubscriberStatementPdf(subscriberId: number): Promise<Buffer> {
  const statementData = await this.getSubscriberStatement(subscriberId);
  return this.pdfService.generateSubscriberStatementPdf(statementData);
}

}
