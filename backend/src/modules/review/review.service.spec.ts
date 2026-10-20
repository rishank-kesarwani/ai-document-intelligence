import { Test, TestingModule } from '@nestjs/testing';
import { ReviewService } from './review.service';
import { ExtractionService } from '../extraction/extraction.service';
import { SchemasService } from '../schemas/schemas.service';
import { BusinessRulesService } from '../extraction/services/business-rules.service';
import { NotificationService } from '../shared-services/notification.service';
import {
  ExtractionJobStatus,
  ValidationStatus,
  TenantContext,
  FieldType,
} from '../../common/types';

describe('ReviewService Human Correction and Audit Trail', () => {
  let reviewService: ReviewService;
  let extractionService: ExtractionService;

  const mockTenant: TenantContext = {
    tenantId: 'tenant-audit-1',
    isDemo: false,
    isSqlAuthorized: true,
  };

  const mockJob = {
    id: 'job-review-123',
    tenantId: 'tenant-audit-1',
    documentId: 'doc-123',
    schemaId: 'invoice-v1',
    schemaVersion: '1.0.0',
    status: ExtractionJobStatus.NEEDS_REVIEW,
    overallConfidence: 0.9,
    validationErrors: ['Math mismatch'],
    createdAt: new Date().toISOString(),
    canRetry: true,
    retryCount: 0,
    fields: [
      {
        key: 'total_amount',
        label: 'Total Amount',
        type: FieldType.NUMBER,
        value: 1250, // Erroneous value needing human review
        confidence: 0.9,
        validationStatus: ValidationStatus.INVALID,
        validationErrors: ['Math mismatch'],
      },
      {
        key: 'subtotal',
        label: 'Subtotal',
        type: FieldType.NUMBER,
        value: 1000,
        confidence: 0.95,
        validationStatus: ValidationStatus.VALID,
      },
      {
        key: 'tax_amount',
        label: 'Tax',
        type: FieldType.NUMBER,
        value: 100,
        confidence: 0.95,
        validationStatus: ValidationStatus.VALID,
      },
    ],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewService,
        BusinessRulesService,
        {
          provide: ExtractionService,
          useValue: {
            getJobById: jest.fn().mockResolvedValue({ ...mockJob }),
            saveJob: jest.fn(),
          },
        },
        {
          provide: SchemasService,
          useValue: {
            findById: jest.fn().mockResolvedValue({
              id: 'invoice-v1',
              fields: [
                { key: 'total_amount', label: 'Total Amount', type: FieldType.NUMBER, required: true },
                { key: 'subtotal', label: 'Subtotal', type: FieldType.NUMBER, required: true },
                { key: 'tax_amount', label: 'Tax', type: FieldType.NUMBER, required: true },
              ],
              crossFieldRules: [
                {
                  id: 'math',
                  name: 'Sum Check',
                  validator: 'math_sum',
                  fields: ['subtotal', 'tax_amount', 'total_amount'],
                  errorMessage: 'Subtotal + tax must equal total',
                },
              ],
            }),
          },
        },
        {
          provide: NotificationService,
          useValue: {
            sendAlert: jest.fn().mockResolvedValue({ success: true }),
          },
        },
      ],
    }).compile();

    reviewService = module.get<ReviewService>(ReviewService);
    extractionService = module.get<ExtractionService>(ExtractionService);
  });

  it('should update field value and record complete audit trail', async () => {
    const res = await reviewService.updateField(
      'job-review-123',
      'total_amount',
      {
        newValue: 1100, // Corrected human value (1000 + 100 = 1100)
        reason: 'Corrected OCR misread of total from 1250 to 1100',
        author: 'auditor@tenant.com',
      },
      mockTenant,
    );

    expect(res.success).toBe(true);
    expect(res.auditRecord.previousValue).toBe(1250);
    expect(res.auditRecord.newValue).toBe(1100);
    expect(res.auditRecord.reason).toContain('Corrected OCR misread');
    expect(res.auditRecord.author).toBe('auditor@tenant.com');

    // Rule re-evaluation should resolve the validation error!
    expect(res.job.validationErrors.length).toBe(0);
    expect(res.job.status).toBe(ExtractionJobStatus.COMPLETED);
  });

  it('should approve job and create approval decision', async () => {
    const approvedJob = await reviewService.approveJob(
      'job-review-123',
      {
        reviewerId: 'lead-compliance-officer',
        notes: 'Verified all receipts and approved',
      },
      mockTenant,
    );

    expect(approvedJob.status).toBe(ExtractionJobStatus.APPROVED);
    expect(approvedJob.decision?.reviewerId).toBe('lead-compliance-officer');
    expect(approvedJob.decision?.decisionNotes).toContain('Verified all receipts');
  });

  it('should reject job with reason', async () => {
    const rejectedJob = await reviewService.rejectJob(
      'job-review-123',
      {
        reviewerId: 'lead-compliance-officer',
        notes: 'Document is illegible and unverified',
      },
      mockTenant,
    );

    expect(rejectedJob.status).toBe(ExtractionJobStatus.REJECTED);
    expect(rejectedJob.decision?.status).toBe(ExtractionJobStatus.REJECTED);
  });
});
