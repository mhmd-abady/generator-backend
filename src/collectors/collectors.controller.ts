import { Controller, Get, Query, Res } from '@nestjs/common';
import { CollectorsService } from './collectors.service';
import type { Response } from 'express';
import { PdfExportService } from 'src/reports/exporters/pdf-export.service';
import { ExcelExportService } from 'src/reports/exporters/excel-export.service';

@Controller('collectors')
export class CollectorsController {
  constructor(
    private readonly service: CollectorsService,
    private readonly pdf: PdfExportService,
    private readonly excel: ExcelExportService,
  ) {}

  @Get('tasks')
  getTasks(
    @Query('month') month: number,
    @Query('year') year: number,
    @Query('regionId') regionId?: number,
    @Query('neighborhoodId') neighborhoodId?: number,
    @Query('collectorId') collectorId?: number,
  ) {
    return this.service.getCollectorTasks({
      month: Number(month),
      year: Number(year),
      regionId: regionId ? Number(regionId) : undefined,
      neighborhoodId: neighborhoodId ? Number(neighborhoodId) : undefined,
      collectorId: collectorId ? Number(collectorId) : undefined,
    });
  }

  @Get('tasks/export/pdf')
  async exportTasksPdf(
    @Query('month') month: number,
    @Query('year') year: number,
    @Res() res: Response,
    @Query('regionId') regionId?: number,
    @Query('neighborhoodId') neighborhoodId?: number,
  ) {
    const data = await this.service.getCollectorTasks({
      month: Number(month),
      year: Number(year),
      regionId: regionId ? Number(regionId) : undefined,
      neighborhoodId: neighborhoodId ? Number(neighborhoodId) : undefined,
    });

    const headers = ['Neighborhood', 'Subscriber', 'Phone', 'Amount Due'];

    const rows: any[] = [];

    for (const group of data) {
      for (const sub of group.subscribers) {
        rows.push([group.neighborhoodName, sub.name, sub.phone, sub.amountDue]);
      }
    }

    const buffer = this.pdf.generate(
      `Collector Tasks (${month}/${year})`,
      headers,
      rows,
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      'inline; filename=collector-tasks.pdf',
    );

    return res.end(buffer);
  }

  @Get('tasks/export/excel')
async exportTasksExcel(
  @Query('month') month: number,
  @Query('year') year: number,
  @Res() res: Response,
  @Query('regionId') regionId?: number,
  @Query('neighborhoodId') neighborhoodId?: number,
) {
  const data = await this.service.getCollectorTasks({
    month: Number(month),
    year: Number(year),
    regionId: regionId ? Number(regionId) : undefined,
    neighborhoodId: neighborhoodId ? Number(neighborhoodId) : undefined,
  });

  const headers = [
    'Neighborhood',
    'Subscriber',
    'Phone',
    'Amount Due',
  ];

  const rows: any[] = [];
  for (const group of data) {
    for (const sub of group.subscribers) {
      rows.push([
        group.neighborhoodName,
        sub.name,
        sub.phone,
        sub.amountDue,
      ]);
    }
  }

  const buffer = await this.excel.generate(
    `Collector Tasks ${month}-${year}`,
    headers,
    rows,
  );

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader(
    'Content-Disposition',
    'attachment; filename=collector-tasks.xlsx',
  );
  return res.end(buffer);
}

}
