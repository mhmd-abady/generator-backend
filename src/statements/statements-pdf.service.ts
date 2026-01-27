import { Injectable } from '@nestjs/common';
//import * as PDFDocument from 'pdfkit';
import PDFDocument from 'pdfkit'; // depending on tsconfig, still wrong

@Injectable()
export class StatementPdfService {
 generateSubscriberStatementPdf(data: {
  subscriber: {
    fullName: string;
    phone: string;
  };
  statement: {
    date: Date;
    type: 'INVOICE' | 'PAYMENT';
    reference: string;
    debitUsd: number;
    creditUsd: number;
    balanceUsd: number;
    debitLbp: number;
    creditLbp: number;
    balanceLbp: number;
  }[];
  finalBalanceUsd: number;
  finalBalanceLbp: number;
}): Buffer {

    const doc = new PDFDocument({ margin: 40, size: 'A4' });

    const buffers: Buffer[] = [];
    doc.on('data', buffers.push.bind(buffers));

    // ───────────── Header ─────────────
    doc.fontSize(18).text('كشف حساب مشترك', { align: 'center' });
    doc.moveDown();

    doc.fontSize(12)
      .text(`الاسم: ${data.subscriber.fullName}`)
      .text(`الهاتف: ${data.subscriber.phone}`)
      .moveDown();

    // ───────────── Table Header ─────────────
    doc.fontSize(11).text(
      'التاريخ        العملية        المرجع                 عليه        له        الرصيد',
    );
    doc.moveDown(0.5);

    // خط فاصل
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.5);

    // ───────────── Rows ─────────────
    data.statement.forEach((row) => {
      const date = row.date.toISOString().split('T')[0];

      doc.fontSize(10).text(
        `${date}    ${row.type === 'INVOICE' ? 'فاتورة' : 'دفعة'}    ${
          row.reference
        }    ${row.debitUsd || '-'}    ${row.creditUsd || '-'}    ${row.balanceUsd}`,
      );
    });

    doc.moveDown();

    // ───────────── Footer ─────────────
    doc.fontSize(12).text(
      `الرصيد النهائي: ${data.finalBalanceUsd}`,
      { align: 'right' },
    );

    doc.end();

    return Buffer.concat(buffers);
  }
}
