import { Module } from '@nestjs/common';
import { ExtractionController } from './extraction.controller';
import { ExtractionService } from './extraction.service';
import { DeterministicPdfProvider } from './providers/deterministic-pdf.provider';
import { OcrAdapterProvider } from './providers/ocr-adapter.provider';
import { EvidenceLinkerService } from './services/evidence-linker.service';
import { BusinessRulesService } from './services/business-rules.service';
import { DocumentsModule } from '../documents/documents.module';
import { SchemasModule } from '../schemas/schemas.module';

@Module({
  imports: [DocumentsModule, SchemasModule],
  controllers: [ExtractionController],
  providers: [
    ExtractionService,
    DeterministicPdfProvider,
    OcrAdapterProvider,
    EvidenceLinkerService,
    BusinessRulesService,
  ],
  exports: [ExtractionService],
})
export class ExtractionModule {}
