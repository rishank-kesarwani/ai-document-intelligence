import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SharedServicesModule } from './modules/shared-services/shared-services.module';
import { HealthModule } from './modules/health/health.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { SchemasModule } from './modules/schemas/schemas.module';
import { ExtractionModule } from './modules/extraction/extraction.module';
import { ReviewModule } from './modules/review/review.module';
import { ExportModule } from './modules/export/export.module';
import { SqlModule } from './modules/sql/sql.module';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
    }),
    SharedServicesModule,
    HealthModule,
    DocumentsModule,
    SchemasModule,
    ExtractionModule,
    ReviewModule,
    ExportModule,
    SqlModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
