export enum DocumentModality {
  PDF = 'pdf',
  IMAGE = 'image',
}

export enum ExtractionJobStatus {
  QUEUED = 'queued',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  NEEDS_REVIEW = 'needs_review',
  FAILED = 'failed',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum ValidationStatus {
  VALID = 'valid',
  INVALID = 'invalid',
  WARNING = 'warning',
}

export enum EvidenceStatus {
  VERIFIED = 'verified',
  UNVERIFIED = 'unverified',
  MISSING = 'missing',
}

export enum FieldType {
  STRING = 'string',
  NUMBER = 'number',
  DATE = 'date',
  BOOLEAN = 'boolean',
  ENUM = 'enum',
  ARRAY = 'array',
}

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
  type: FieldType;
  value: any;
  rawText?: string;
  confidence: number;
  evidence?: FieldEvidence;
  validationStatus: ValidationStatus;
  validationErrors?: string[];
  isEdited?: boolean;
  originalValue?: any;
}

export interface ValidationRule {
  ruleType: 'regex' | 'range' | 'crossField' | 'custom';
  expression: string;
  errorMessage: string;
}

export interface FieldDefinition {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  enumValues?: string[];
  rules?: ValidationRule[];
  description?: string;
}

export interface CrossFieldRule {
  id: string;
  name: string;
  description: string;
  fields: string[];
  // e.g. "subtotal + tax === total" or "effective_date <= expiration_date"
  validator: 'math_sum' | 'date_range' | 'custom_eval';
  parameters?: Record<string, any>;
  errorMessage: string;
}

export interface ExtractionSchema {
  id: string;
  name: string;
  version: string;
  description: string;
  documentType: string;
  fields: FieldDefinition[];
  crossFieldRules?: CrossFieldRule[];
  tenantId?: string;
  createdAt: string;
  updatedAt: string;
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

export interface ReviewDecision {
  status: ExtractionJobStatus.APPROVED | ExtractionJobStatus.REJECTED;
  reviewerId: string;
  decisionNotes?: string;
  timestamp: string;
}

export interface TenantContext {
  tenantId: string;
  isDemo: boolean;
  isSqlAuthorized: boolean;
}
