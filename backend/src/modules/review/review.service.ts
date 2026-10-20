import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { ExtractionService } from '../extraction/extraction.service';
import { SchemasService } from '../schemas/schemas.service';
import { BusinessRulesService } from '../extraction/services/business-rules.service';
import { NotificationService } from '../shared-services/notification.service';
import { UpdateFieldDto, ReviewDecisionDto } from './dto/update-field.dto';
import {
  AuditRecord,
  ExtractionJobStatus,
  TenantContext,
  ValidationStatus,
} from '../../common/types';

@Injectable()
export class ReviewService {
  private readonly logger = new Logger(ReviewService.name);
  private readonly auditRecords = new Map<string, AuditRecord[]>();

  constructor(
    private readonly extractionService: ExtractionService,
    private readonly schemasService: SchemasService,
    private readonly businessRules: BusinessRulesService,
    private readonly notificationService: NotificationService,
  ) {}

  async updateField(
    jobId: string,
    fieldKey: string,
    dto: UpdateFieldDto,
    tenantContext: TenantContext,
  ) {
    const job = await this.extractionService.getJobById(jobId, tenantContext.tenantId);

    const field = job.fields.find((f) => f.key === fieldKey);
    if (!field) {
      throw new NotFoundException(`Field "${fieldKey}" not found in job ${jobId}`);
    }

    const previousValue = field.value;
    if (field.originalValue === undefined) {
      field.originalValue = previousValue;
    }

    field.value = dto.newValue;
    field.isEdited = true;
    field.validationErrors = []; // Reset field errors to revalidate

    // Record audit entry
    const auditRecord: AuditRecord = {
      id: uuidv4(),
      jobId,
      fieldKey,
      previousValue,
      newValue: dto.newValue,
      reason: dto.reason,
      author: dto.author || `reviewer@${tenantContext.tenantId}`,
      timestamp: new Date().toISOString(),
    };

    const existingTrail = this.auditRecords.get(jobId) || [];
    existingTrail.push(auditRecord);
    this.auditRecords.set(jobId, existingTrail);

    // Re-evaluate schema and cross-field validation rules
    const schema = await this.schemasService.findById(job.schemaId, tenantContext.tenantId);
    const ruleResult = this.businessRules.validateFieldsAndRules(schema, job.fields);

    job.fields = ruleResult.fields;
    job.validationErrors = ruleResult.allValidationErrors;

    // If human fixed all errors, status can move to COMPLETED if not already approved
    if (
      job.status === ExtractionJobStatus.NEEDS_REVIEW &&
      ruleResult.allValidationErrors.length === 0
    ) {
      job.status = ExtractionJobStatus.COMPLETED;
    }

    this.extractionService.saveJob(job);

    this.logger.log(
      `Field ${fieldKey} updated in job ${jobId} by ${auditRecord.author}. Reason: ${auditRecord.reason}`,
    );

    return {
      success: true,
      job,
      auditRecord,
    };
  }

  async approveJob(
    jobId: string,
    dto: ReviewDecisionDto,
    tenantContext: TenantContext,
  ) {
    const job = await this.extractionService.getJobById(jobId, tenantContext.tenantId);

    if (
      job.status === ExtractionJobStatus.APPROVED ||
      job.status === ExtractionJobStatus.FAILED
    ) {
      throw new BadRequestException(
        `Cannot approve job in state: ${job.status}`,
      );
    }

    const reviewerId = dto.reviewerId || `reviewer@${tenantContext.tenantId}`;
    const timestamp = new Date().toISOString();

    job.status = ExtractionJobStatus.APPROVED;
    job.decision = {
      status: ExtractionJobStatus.APPROVED,
      reviewerId,
      decisionNotes: dto.notes || 'Human review completed and approved',
      timestamp,
    };

    this.extractionService.saveJob(job);

    await this.notificationService.sendAlert({
      type: 'JOB_COMPLETED',
      jobId: job.id,
      documentId: job.documentId,
      tenantId: job.tenantId,
      message: `Job ${job.id} approved by ${reviewerId}`,
      timestamp,
      idempotencyKey: `alert-${job.id}-approved`,
    });

    return job;
  }

  async rejectJob(
    jobId: string,
    dto: ReviewDecisionDto,
    tenantContext: TenantContext,
  ) {
    const job = await this.extractionService.getJobById(jobId, tenantContext.tenantId);

    const reviewerId = dto.reviewerId || `reviewer@${tenantContext.tenantId}`;
    const timestamp = new Date().toISOString();

    job.status = ExtractionJobStatus.REJECTED;
    job.decision = {
      status: ExtractionJobStatus.REJECTED,
      reviewerId,
      decisionNotes: dto.notes || 'Document extraction rejected by human reviewer',
      timestamp,
    };

    this.extractionService.saveJob(job);

    return job;
  }

  async getAuditTrail(jobId: string, tenantContext: TenantContext): Promise<AuditRecord[]> {
    // Check job ownership
    await this.extractionService.getJobById(jobId, tenantContext.tenantId);
    return this.auditRecords.get(jobId) || [];
  }
}
