import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

@Injectable()
export class ExcelExportService {
  async generate(
    sheetName: string,
    headers: string[],
    rows: any[][],
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(sheetName);

    // Header row
    sheet.addRow(headers);
    sheet.getRow(1).font = { bold: true };

    // Data rows
    rows.forEach((r) => sheet.addRow(r));

    // Auto-size columns
    sheet.columns.forEach((col) => {
      col.width = 18;
    });

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }
}
