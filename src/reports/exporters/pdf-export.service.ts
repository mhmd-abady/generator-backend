import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';

@Injectable()
export class PdfExportService {
  generate(title: string, headers: string[], rows: any[][]): Buffer {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const buffers: Buffer[] = [];

    doc.on('data', buffers.push.bind(buffers));

    // Title
    doc.fontSize(18).text(title, { align: 'center' });
    doc.moveDown();

    // Header row
    doc.fontSize(11).text(headers.join(' | '));
    doc.moveDown(0.5);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.5);

    // Data rows
    rows.forEach((row) => {
      doc.fontSize(10).text(row.join(' | '));
    });

    doc.end();

    return Buffer.concat(buffers);
  }
}
