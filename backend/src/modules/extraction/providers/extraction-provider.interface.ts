import {
  DocumentModality,
  ExtractionSchema,
  BoundingBox,
} from '../../../common/types';

export interface ExtractionInput {
  documentId: string;
  buffer: Buffer;
  modality: DocumentModality;
  mimeType: string;
  schema: ExtractionSchema;
}

export interface ProviderRawField {
  value: any;
  confidence: number;
  rawSnippet: string;
  pageNumber: number;
  boundingBox?: BoundingBox;
}

export interface ProviderExtractionResult {
  providerName: string;
  rawText: string;
  fields: Record<string, ProviderRawField>;
}

export interface ExtractionProvider {
  name: string;
  canHandle(modality: DocumentModality): boolean;
  extract(input: ExtractionInput): Promise<ProviderExtractionResult>;
}
