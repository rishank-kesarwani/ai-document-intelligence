export type DocumentModality = 'pdf' | 'image';

export type JobStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'needs_review'
  | 'failed'
  | 'approved'
  | 'rejected';

export type ValidationStatus = 'valid' | 'invalid' | 'warning';

export interface BoundingBox {
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
}

export interface FieldEvidence {
  pageNumber: number;
  snippet: string;
  boundingBox?: BoundingBox;
  textMatchScore?: number;
}

export interface ExtractedField {
  key: string;
  label: string;
  type: string;
  value: any;
  rawText?: string;
  confidence: number;
  evidence?: FieldEvidence;
  validationStatus: ValidationStatus;
  validationErrors?: string[];
  isEdited?: boolean;
  originalValue?: any;
}

export interface DocumentEntity {
  id: string;
  tenantId: string;
  originalFilename: string;
  storageKey: string;
  modality: DocumentModality;
  mimeType: string;
  byteSize: number;
  pageCount: number;
  uploadedAt: string;
  isDemo: boolean;
  retentionExpiresAt?: string;
  isDeleted: boolean;
  metadata?: Record<string, any>;
}

export interface ExtractionSchema {
  id: string;
  name: string;
  version: string;
  description: string;
  documentType: string;
  fields: Array<{
    key: string;
    label: string;
    type: string;
    required: boolean;
    enumValues?: string[];
    description?: string;
  }>;
  crossFieldRules?: Array<{
    id: string;
    name: string;
    description: string;
    fields: string[];
    validator: string;
    errorMessage: string;
  }>;
}

export interface ExtractionJob {
  id: string;
  tenantId: string;
  documentId: string;
  schemaId: string;
  schemaVersion: string;
  status: JobStatus;
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
  decision?: {
    status: string;
    reviewerId: string;
    decisionNotes?: string;
    timestamp: string;
  };
  approvalExported?: boolean;
}

export interface AuditRecord {
  id: string;
  jobId: string;
  fieldKey: string;
  previousValue: any;
  newValue: any;
  reason: string;
  author: string;
  timestamp: string;
}

export interface SystemCapabilities {
  modalities: {
    pdf: { supported: boolean; engine: string; evidenceCoordinates: boolean };
    image: { supported: boolean; engine: string; evidenceCoordinates: boolean };
  };
  externalAiPlatform: { configured: boolean; provider: string };
  naturalLanguageSql: {
    enabled: boolean;
    readOnlyOnly: boolean;
    astParserValidation: boolean;
    tenantIsolationEnforced: boolean;
    statementTimeoutMs: number;
  };
  notificationService: { configured: boolean; mode: string };
}

export interface SqlExplainResult {
  naturalLanguageQuery: string;
  generatedSql: string;
  explanation: string;
  tablesQueried: string[];
  rowLimitEnforced: number;
  timeoutLimitMs: number;
  safetyAudit: {
    singleStatement: boolean;
    readOnlySelect: boolean;
    tenantFilterEnforced: boolean;
    disallowedFunctionsChecked: boolean;
    parameterBound: boolean;
  };
}

export interface SqlQueryResult {
  columns: string[];
  rows: Record<string, any>[];
  rowCount: number;
  executionTimeMs: number;
  statement: string;
  isDryRun: boolean;
  tenantId: string;
}
