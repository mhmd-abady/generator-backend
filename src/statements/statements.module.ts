import { Module } from '@nestjs/common';
import { StatementsService } from './statements.service';
import { StatementsController } from './statements.controller';
import { StatementPdfService } from './statements-pdf.service';

@Module({
  controllers: [StatementsController],
  providers: [StatementsService, StatementPdfService],
})
export class StatementsModule {}
