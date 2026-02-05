import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { PdfExportService } from './exporters/pdf-export.service';
import { ExcelExportService } from './exporters/excel-export.service';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService, PdfExportService, ExcelExportService],
  exports: [PdfExportService, ExcelExportService],
})
export class ReportsModule {}
