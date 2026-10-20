import { Controller, Get, Res, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { StorageService } from '../shared-services/storage.service';

@Controller()
export class HealthController {
  constructor(
    private readonly configService: ConfigService,
    private readonly storageService: StorageService,
  ) {}

  @Get()
  getRoot() {
    return {
      service: 'AI Multimodal Document Intelligence Platform',
      version: '1.0.0',
      status: 'operational',
      environment: this.configService.get<string>('NODE_ENV', 'development'),
      endpoints: {
        apiPrefix: '/api/v1',
        liveness: '/health/liveness',
        readiness: '/health/readiness',
        capabilities: '/api/v1/capabilities',
        documents: '/api/v1/documents',
        schemas: '/api/v1/schemas',
        jobs: '/api/v1/jobs',
        review: '/api/v1/review',
        export: '/api/v1/export',
        sql: '/api/v1/sql',
      },
    };
  }

  @Get('health/liveness')
  getLiveness() {
    return {
      status: 'UP',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }

  @Get('health/readiness')
  getReadiness(@Res() res: Response) {
    const storageCheck = this.storageService.checkHealth();
    const isReady = storageCheck.isHealthy;

    const body = {
      status: isReady ? 'READY' : 'NOT_READY',
      timestamp: new Date().toISOString(),
      checks: {
        storage: {
          status: storageCheck.isHealthy ? 'UP' : 'DOWN',
          storagePath: storageCheck.storagePath,
          error: storageCheck.details || null,
        },
        memory: {
          status: 'UP',
          rssBytes: process.memoryUsage().rss,
          heapUsedBytes: process.memoryUsage().heapUsed,
        },
      },
    };

    return res.status(isReady ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE).json(body);
  }

  @Get('capabilities')
  getCapabilities() {
    const ocrEnabled = this.configService.get<string>('OCR_ENGINE_ENABLED', 'false') === 'true';
    const aiPlatformKey = this.configService.get<string>('AI_PLATFORM_API_KEY');
    const sqlEnabled = this.configService.get<string>('FEATURE_NL_SQL_ENABLED', 'true') === 'true';
    const notificationUrl = this.configService.get<string>('NOTIFICATION_SERVICE_URL');

    return {
      modalities: {
        pdf: {
          supported: true,
          engine: 'Deterministic PDF Layout & Token Extractor (pdf-parse)',
          evidenceCoordinates: true,
        },
        image: {
          supported: ocrEnabled || !!aiPlatformKey,
          engine: ocrEnabled
            ? 'OCR Adapter Engine'
            : aiPlatformKey
            ? 'External Multimodal Model'
            : 'Unconfigured (Modality Limitation: images require OCR_ENGINE_ENABLED=true or AI_PLATFORM_API_KEY)',
          evidenceCoordinates: ocrEnabled,
        },
      },
      externalAiPlatform: {
        configured: !!aiPlatformKey,
        provider: aiPlatformKey ? 'Configured External Multimodal AI' : 'Local Deterministic Fallback Engine',
      },
      naturalLanguageSql: {
        enabled: sqlEnabled,
        readOnlyOnly: true,
        astParserValidation: true,
        tenantIsolationEnforced: true,
        statementTimeoutMs: parseInt(this.configService.get<string>('SQL_STATEMENT_TIMEOUT_MS', '2000'), 10),
      },
      notificationService: {
        configured: !!notificationUrl,
        mode: notificationUrl ? 'External Webhook with Idempotency' : 'In-Memory / Logged (Mock Mode)',
      },
    };
  }
}
