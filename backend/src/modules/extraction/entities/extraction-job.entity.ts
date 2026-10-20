import {
  ExtractionJobStatus,
  ExtractedField,
  ReviewDecision,
} from '../../../common/types';

export class ExtractionJobEntity {
  id: string;
  tenantId: string;
  documentId: string;
  schemaId: string;
  schemaVersion: string;
  status: ExtractionJobStatus;
  fields: ExtractedField[];
  overallConfidence: number;
  validationErrors: string[];
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  canRetry: boolean;
  retryCount: number;
  failureReason?: string;
  providerUsed?: string;
  decision?: ReviewDecision;
  approvalExported?: boolean;
}
