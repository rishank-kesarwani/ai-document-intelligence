import { Module } from '@nestjs/common';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';
import { ExtractionModule } from '../extraction/extraction.module';
import { SchemasModule } from '../schemas/schemas.module';
import { BusinessRulesService } from '../extraction/services/business-rules.service';

@Module({
  imports: [ExtractionModule, SchemasModule],
  controllers: [ReviewController],
  providers: [ReviewService, BusinessRulesService],
  exports: [ReviewService],
})
export class ReviewModule {}
