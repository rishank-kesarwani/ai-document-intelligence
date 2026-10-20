import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DocumentsService } from '../documents/documents.service';
import { SchemasService } from '../schemas/schemas.service';
import { StorageService } from '../shared-services/storage.service';
import { NotificationService } from '../shared-services/notification.service';
import { DeterministicPdfProvider } from './providers/deterministic-pdf.provider';
import { OcrAdapterProvider } from './providers/ocr-adapter.provider';
import { EvidenceLinkerService } from './services/evidence-linker.service';
import { BusinessRulesService } from './services/business-rules.service';
import { ExtractionJobEntity } from './entities/extraction-job.entity';
import { TriggerExtractionDto } from './dto/trigger-extraction.dto';
import {
  DocumentModality,
  ExtractionJobStatus,
  TenantContext,
} from '../../common/types';

@Injectable()
export class ExtractionService {
  private readonly logger = new Logger(ExtractionService.name);
  private readonly jobs = new Map<string, ExtractionJobEntity>();

  constructor(
    private readonly documentsService: DocumentsService,
    private readonly schemasService: SchemasService,
    private readonly storageService: StorageService,
    private readonly notificationService: NotificationService,
    private readonly pdfProvider: DeterministicPdfProvider,
    private readonly ocrProvider: OcrAdapterProvider,
    private readonly evidenceLinker: EvidenceLinkerService,
    private readonly businessRules: BusinessRulesService,
  ) {}

  async triggerExtraction(
    dto: TriggerExtractionDto,
    tenantContext: TenantContext,
  ): Promise<ExtractionJobEntity> {
    // 1. Verify document exists and belongs to this tenant
    const doc = await this.documentsService.findById(dto.documentId, tenantContext.tenantId);

    // 2. Verify schema exists
    const schema = await this.schemasService.findById(dto.schemaId, tenantContext.tenantId);

    // 3. Initialize Job in QUEUED state
    const jobId = uuidv4();
    const now = new Date().toISOString();

    const job: ExtractionJobEntity = {
      id: jobId,
      tenantId: tenantContext.tenantId,
      documentId: doc.id,
      schemaId: schema.id,
      schemaVersion: schema.version,
      status: ExtractionJobStatus.QUEUED,
      fields: [],
      overallConfidence: 0,
      validationErrors: [],
      createdAt: now,
      canRetry: true,
      retryCount: 0,
      approvalExported: false,
    };

    this.jobs.set(job.id, job);

    // Execute extraction processing
    await this.processJob(job, doc, schema);

    return job;
  }

  private async processJob(
    job: ExtractionJobEntity,
    doc: any,
    schema: any,
  ): Promise<void> {
    job.status = ExtractionJobStatus.PROCESSING;
    job.startedAt = new Date().toISOString();

    try {
      const fileBuffer = await this.storageService.getFileBuffer(doc.storageKey);

      let provider;
      if (doc.modality === DocumentModality.PDF) {
        provider = this.pdfProvider;
      } else if (doc.modality === DocumentModality.IMAGE) {
        if (!this.ocrProvider.isAvailable()) {
          throw new BadRequestException(
            'Modality limitation: OCR extraction engine is not enabled. Cannot process image documents without active OCR.',
          );
        }
        provider = this.ocrProvider;
      } else {
        throw new BadRequestException(`Unsupported modality "${doc.modality}"`);
      }

      job.providerUsed = provider.name;

      // Extract raw fields
      const rawResult = await provider.extract({
        documentId: doc.id,
        buffer: fileBuffer,
        modality: doc.modality,
        mimeType: doc.mimeType,
        schema,
      });

      // Link evidence
      const linkedFields = this.evidenceLinker.linkEvidence(schema, rawResult);

      // Validate business and cross-field rules
      const ruleResult = this.businessRules.validateFieldsAndRules(schema, linkedFields);

      job.fields = ruleResult.fields;
      job.validationErrors = ruleResult.allValidationErrors;
      job.overallConfidence = ruleResult.overallConfidence;
      job.status = ruleResult.overallStatus;
      job.completedAt = new Date().toISOString();

      // Dispatch alert if needs review or completed
      const alertType =
        job.status === ExtractionJobStatus.NEEDS_REVIEW ? 'NEEDS_REVIEW' : 'JOB_COMPLETED';
      await this.notificationService.sendAlert({
        type: alertType,
        jobId: job.id,
        documentId: doc.id,
        tenantId: job.tenantId,
        message:
          job.status === ExtractionJobStatus.NEEDS_REVIEW
            ? `Extraction job requires human review: ${job.validationErrors.length} validation rule warning(s)`
            : `Extraction job completed with ${job.overallConfidence * 100}% confidence`,
        timestamp: new Date().toISOString(),
        idempotencyKey: `alert-${job.id}-${job.status}`,
      });
    } catch (err: any) {
      job.status = ExtractionJobStatus.FAILED;
      job.failureReason = err?.message || 'Unknown extraction error';
      job.completedAt = new Date().toISOString();
      job.canRetry = true;

      this.logger.error(`Job ${job.id} failed: ${job.failureReason}`);

      await this.notificationService.sendAlert({
        type: 'PROCESSING_FAILED',
        jobId: job.id,
        documentId: doc.id,
        tenantId: job.tenantId,
        message: `Extraction job failed: ${job.failureReason}`,
        timestamp: new Date().toISOString(),
        idempotencyKey: `alert-${job.id}-failed-retry-${job.retryCount}`,
      });
    }
  }

  async retryJob(id: string, tenantContext: TenantContext): Promise<ExtractionJobEntity> {
    const job = await this.getJobById(id, tenantContext.tenantId);

    if (
      job.status !== ExtractionJobStatus.FAILED &&
      job.status !== ExtractionJobStatus.NEEDS_REVIEW
    ) {
      throw new BadRequestException(
        `Job cannot be retried from current state: "${job.status}". Only failed or needs_review jobs can be retried.`,
      );
    }

    job.retryCount += 1;
    job.status = ExtractionJobStatus.QUEUED;
    job.failureReason = undefined;

    const doc = await this.documentsService.findById(job.documentId, tenantContext.tenantId);
    const schema = await this.schemasService.findById(job.schemaId, tenantContext.tenantId);

    await this.processJob(job, doc, schema);

    await this.notificationService.sendAlert({
      type: 'JOB_RETRIED',
      jobId: job.id,
      documentId: doc.id,
      tenantId: job.tenantId,
      message: `Extraction job retried (attempt #${job.retryCount})`,
      timestamp: new Date().toISOString(),
      idempotencyKey: `alert-${job.id}-retried-attempt-${job.retryCount}`,
    });

    return job;
  }

  async getJobById(id: string, tenantId: string): Promise<ExtractionJobEntity> {
    const job = this.jobs.get(id);
    if (!job) {
      throw new NotFoundException(`Extraction job "${id}" was not found`);
    }

    if (job.tenantId !== tenantId) {
      throw new ForbiddenException(`Access denied: Job does not belong to your tenant`);
    }

    return job;
  }

  async findAllJobs(tenantId: string): Promise<ExtractionJobEntity[]> {
    const list: ExtractionJobEntity[] = [];
    for (const job of this.jobs.values()) {
      if (job.tenantId === tenantId) {
        list.push(job);
      }
    }
    return list.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
  }

  // Helper for review module and SQL module
  getAllJobsForTenant(tenantId: string): ExtractionJobEntity[] {
    return Array.from(this.jobs.values()).filter((j) => j.tenantId === tenantId);
  }

  saveJob(job: ExtractionJobEntity): void {
    this.jobs.set(job.id, job);
  }
}
