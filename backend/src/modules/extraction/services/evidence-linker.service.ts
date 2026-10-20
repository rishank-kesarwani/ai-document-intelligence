import { Injectable } from '@nestjs/common';
import {
  ExtractedField,
  ExtractionSchema,
  ValidationStatus,
} from '../../../common/types';
import { ProviderExtractionResult } from '../providers/extraction-provider.interface';

@Injectable()
export class EvidenceLinkerService {
  linkEvidence(
    schema: ExtractionSchema,
    providerResult: ProviderExtractionResult,
  ): ExtractedField[] {
    const extractedFields: ExtractedField[] = [];

    for (const fieldDef of schema.fields) {
      const rawMatch = providerResult.fields[fieldDef.key];

      if (rawMatch && rawMatch.value !== undefined && rawMatch.value !== null) {
        extractedFields.push({
          key: fieldDef.key,
          label: fieldDef.label,
          type: fieldDef.type,
          value: rawMatch.value,
          rawText: rawMatch.rawSnippet,
          confidence: parseFloat(rawMatch.confidence.toFixed(2)),
          evidence: {
            pageNumber: rawMatch.pageNumber,
            snippet: rawMatch.rawSnippet,
            boundingBox: rawMatch.boundingBox,
            textMatchScore: rawMatch.confidence,
          },
          validationStatus: ValidationStatus.VALID,
          validationErrors: [],
          isEdited: false,
        });
      } else {
        // Field not extracted or missing in source document
        extractedFields.push({
          key: fieldDef.key,
          label: fieldDef.label,
          type: fieldDef.type,
          value: null,
          confidence: 0.0,
          evidence: undefined,
          validationStatus: fieldDef.required ? ValidationStatus.INVALID : ValidationStatus.VALID,
          validationErrors: fieldDef.required ? [`Required field "${fieldDef.label}" was not detected`] : [],
          isEdited: false,
        });
      }
    }

    return extractedFields;
  }
}
