import { Module } from '@nestjs/common';
import { SqlController } from './sql.controller';
import { SqlService } from './sql.service';
import { SqlAstValidatorService } from './services/sql-ast-validator.service';
import { DocumentsModule } from '../documents/documents.module';
import { ExtractionModule } from '../extraction/extraction.module';

@Module({
  imports: [DocumentsModule, ExtractionModule],
  controllers: [SqlController],
  providers: [SqlService, SqlAstValidatorService],
  exports: [SqlService, SqlAstValidatorService],
})
export class SqlModule {}
