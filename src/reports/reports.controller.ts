import { Controller, Get, Query,Res } from '@nestjs/common';
import { ReportsService } from './reports.service';

import { ReportsFilterDto } from './dto/reports-filter.dto';
import { PdfExportService } from './exporters/pdf-export.service';
import { ExcelExportService } from './exporters/excel-export.service';
import type { Response } from 'express';

@Controller('reports')
export class ReportsController {
  constructor(private readonly service: ReportsService,   private readonly pdf: PdfExportService,
    private readonly excel: ExcelExportService,) {}

  // Examples:
  // /reports/aging
  // /reports/aging?month=1&year=2025
  // /reports/aging?regionId=2
  // /reports/aging?neighborhoodId=5
  @Get('aging')
  getAging(@Query() query: ReportsFilterDto) {
    return this.service.getAgingReport(query);
  }

  // GET /reports/payments
// Examples:
// /reports/payments
// /reports/payments?month=1&year=2025
// /reports/payments?regionId=2
// /reports/payments?collectorId=4
@Get('payments')
getPayments(@Query() query: ReportsFilterDto) {
  return this.service.getPaymentsReport(query);
}

// GET /reports/summary
// Examples:
// /reports/summary
// /reports/summary?month=1&year=2025
// /reports/summary?regionId=2
// /reports/summary?neighborhoodId=5
@Get('summary')
getSummary(@Query() query: ReportsFilterDto) {
  return this.service.getSummaryReport(query);
}


  @Get('aging/export')
  async exportAging(
    @Query() query: ReportsFilterDto & { format: 'pdf' | 'excel' },
    @Res() res: Response,
  ) {
    const data = await this.service.getAgingReport(query);

    const headers = [
      'Subscriber',
      'Region',
      'Neighborhood',
      'Prev Balance',
      '0-30',
      '31-60',
      '61-90',
      '90+',
      'Total',
    ];

    const rows = data.rows.map((r) => [
      r.subscriber.fullName,
      r.region.name,
      r.neighborhood.name,
      r.totalPreviousBalance,
      r.buckets['0_30'],
      r.buckets['31_60'],
      r.buckets['61_90'],
      r.buckets['90_plus'],
      r.totalOwed,
    ]);

    if (query.format === 'pdf') {
      const buffer = this.pdf.generate('Aging Report', headers, rows);
      res.setHeader('Content-Type', 'application/pdf');
      return res.end(buffer);
    }

    const buffer = await this.excel.generate('Aging Report', headers, rows);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename=aging.xlsx');
    return res.end(buffer);
  }

  @Get('payments/export')
async exportPayments(
  @Query() query: ReportsFilterDto & { format: 'pdf' | 'excel' },
  @Res() res: Response,
) {
  const data = await this.service.getPaymentsReport(query);

  const headers = [
    'Subscriber',
    'Phone',
    'Receiver',
    'Amount',
    'Paid At',
    'Region',
    'Neighborhood',
  ];

  const rows = data.rows.map((p) => [
    p.subscriber.fullName ?? '-',
    p.subscriber.phone ?? '-',
    p.receiver?.username ?? '-',
    p.amount,
    p.paidAt.toISOString().split('T')[0],
    p.invoice?.meter.box.neighborhood.region.name,
    p.invoice?.meter.box.neighborhood.name,
  ]);

  if (query.format === 'pdf') {
    const buffer = this.pdf.generate('Payments Report', headers, rows);
    res.setHeader('Content-Type', 'application/pdf');
    return res.end(buffer);
  }

  const buffer = await this.excel.generate('Payments Report', headers, rows);
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader('Content-Disposition', 'attachment; filename=payments.xlsx');
  return res.end(buffer);
}

@Get('summary/export')
async exportSummary(
  @Query() query: ReportsFilterDto & { format: 'pdf' | 'excel' },
  @Res() res: Response,
) {
  const data = await this.service.getSummaryReport(query);

  const headers = [
    'Total Invoiced',
    'Total Paid',
    'Total Outstanding',
    'Invoices Count',
    'Payments Count',
  ];

  const rows = [[
    data.totals.totalInvoiced,
    data.totals.totalPaid,
    data.totals.totalOutstanding,
    data.counts.invoices,
    data.counts.payments,
  ]];

  if (query.format === 'pdf') {
    const buffer = this.pdf.generate('Summary Report', headers, rows);
    res.setHeader('Content-Type', 'application/pdf');
    return res.end(buffer);
  }

  const buffer = await this.excel.generate('Summary Report', headers, rows);
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader('Content-Disposition', 'attachment; filename=summary.xlsx');
  return res.end(buffer);
}

@Get('collections-summary')
getCollectionsSummary(@Query() query: ReportsFilterDto) {
  return this.service.getCollectionsSummary(query);
}

}
