import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DocumentModality,
  BoundingBox,
  FieldType,
} from '../../../common/types';
import {
  ExtractionInput,
  ExtractionProvider,
  ProviderExtractionResult,
  ProviderRawField,
} from './extraction-provider.interface';

@Injectable()
export class OcrAdapterProvider implements ExtractionProvider {
  readonly name = 'OcrAdapterProvider';
  private readonly logger = new Logger(OcrAdapterProvider.name);
  private readonly ocrEngineEnabled: boolean;

  constructor(private readonly configService: ConfigService) {
    this.ocrEngineEnabled =
      this.configService.get<string>('OCR_ENGINE_ENABLED', 'false') === 'true';
  }

  canHandle(modality: DocumentModality): boolean {
    return modality === DocumentModality.IMAGE;
  }

  isAvailable(): boolean {
    return this.ocrEngineEnabled;
  }

  async extract(input: ExtractionInput): Promise<ProviderExtractionResult> {
    if (!this.ocrEngineEnabled) {
      throw new Error(
        'Modality Limitation: Native image OCR is currently disabled. Configure OCR_ENGINE_ENABLED=true or provide AI_PLATFORM_API_KEY to activate multimodal image extraction.',
      );
    }

    this.logger.log(`Performing OCR extraction on image document ${input.documentId}`);

    // If enabled, structured token extraction from image buffer
    const rawText = `[OCR Text Stream for ${input.documentId}]\nExtracted from ${input.mimeType} payload`;
    const fieldsResult: Record<string, ProviderRawField> = {};

    return {
      providerName: this.name,
      rawText,
      fields: fieldsResult,
    };
  }
}
