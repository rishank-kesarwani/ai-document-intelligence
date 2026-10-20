import { DocumentModality } from '../../../common/types';

export class DocumentEntity {
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
