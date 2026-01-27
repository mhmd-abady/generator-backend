import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';

@Injectable()
export class InvoicePdfService {
  generateInvoice(invoice: any): Buffer {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const buffers: Buffer[] = [];

    doc.on('data', buffers.push.bind(buffers));

    doc.fontSize(18).text('Electricity Invoice', { align: 'center' });
    doc.moveDown();

    doc.fontSize(12).text(`Subscriber: ${invoice.meter.subscriber.fullName}`);
    doc.text(`Phone: ${invoice.meter.subscriber.phone}`);
    doc.text(`Period: ${invoice.month}/${invoice.year}`);
    doc.moveDown();

    doc.fontSize(11).text(`Previous Balance: ${invoice.previousBalance} $`);
    doc.text(`Ampere Fee: ${invoice.ampereFee} $`);

    if (invoice.fixesAmount > 0) {
      doc.moveDown(0.5);
      doc.text(`Fixes: ${invoice.fixesAmount} $`);
      if (invoice.fixesNote) {
        doc.fontSize(9).text(`• ${invoice.fixesNote}`);
      }
    }

    doc.moveDown();
    doc.fontSize(13).text(`TOTAL: ${invoice.totalDue} $`, { align: 'right' });

    doc.end();
    return Buffer.concat(buffers);
  }
}
