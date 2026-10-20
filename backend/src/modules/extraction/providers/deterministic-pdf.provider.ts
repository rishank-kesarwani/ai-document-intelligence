import { Injectable, Logger } from '@nestjs/common';
import * as pdfParse from 'pdf-parse';
import {
  DocumentModality,
  FieldType,
  BoundingBox,
} from '../../../common/types';
import {
  ExtractionInput,
  ExtractionProvider,
  ProviderExtractionResult,
  ProviderRawField,
} from './extraction-provider.interface';

@Injectable()
export class DeterministicPdfProvider implements ExtractionProvider {
  readonly name = 'DeterministicPdfProvider';
  private readonly logger = new Logger(DeterministicPdfProvider.name);

  canHandle(modality: DocumentModality): boolean {
    return modality === DocumentModality.PDF;
  }

  async extract(input: ExtractionInput): Promise<ProviderExtractionResult> {
    let rawText = '';
    let pageCount = 1;

    try {
      const parsed = await (pdfParse as any)(input.buffer);
      rawText = parsed.text || '';
      pageCount = parsed.numpages || 1;
    } catch (err: any) {
      this.logger.warn(`pdf-parse failed on buffer: ${err?.message}. Falling back to string decode.`);
      rawText = input.buffer.toString('utf8');
    }

    const lines = rawText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const fieldsResult: Record<string, ProviderRawField> = {};

    for (const field of input.schema.fields) {
      const extracted = this.extractFieldFromLines(field, lines);
      if (extracted) {
        fieldsResult[field.key] = extracted;
      }
    }

    return {
      providerName: this.name,
      rawText,
      fields: fieldsResult,
    };
  }

  private extractFieldFromLines(
    fieldDef: { key: string; label: string; type: FieldType },
    lines: string[],
  ): ProviderRawField | null {
    const key = fieldDef.key.toLowerCase();
    const label = fieldDef.label.toLowerCase();

    // Map common aliases
    const aliases = [
      label,
      key.replace(/_/g, ' '),
      key,
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lower = line.toLowerCase();

      // Check for alias occurrence
      const matchAlias = aliases.find((alias) => lower.includes(alias));
      if (matchAlias) {
        // Extract value portion after delimiter (':', '-', '=', etc.)
        let valuePart = line;
        const colonIdx = line.indexOf(':');
        if (colonIdx !== -1) {
          valuePart = line.substring(colonIdx + 1).trim();
        } else {
          // If no colon, see if value is in line or next line
          valuePart = line.replace(new RegExp(matchAlias, 'i'), '').trim();
        }

        const parsedValue = this.parseValueByType(valuePart, fieldDef.type);

        if (parsedValue !== null && parsedValue !== undefined && parsedValue !== '') {
          const totalLines = Math.max(lines.length, 1);
          const yMin = Math.max(0, Math.min(1, i / totalLines));
          const yMax = Math.max(0, Math.min(1, (i + 1) / totalLines));

          // Compute contextual snippet (line before, match line, line after)
          const startIdx = Math.max(0, i - 1);
          const endIdx = Math.min(lines.length - 1, i + 1);
          const snippet = lines.slice(startIdx, endIdx + 1).join(' | ');

          const boundingBox: BoundingBox = {
            xMin: 0.08,
            yMin: parseFloat(yMin.toFixed(3)),
            xMax: 0.92,
            yMax: parseFloat(yMax.toFixed(3)),
          };

          return {
            value: parsedValue,
            confidence: 0.94,
            rawSnippet: snippet,
            pageNumber: 1,
            boundingBox,
          };
        }
      }
    }

    // Secondary fallback heuristics based on patterns
    return this.fallbackPatternExtraction(fieldDef, lines);
  }

  private fallbackPatternExtraction(
    fieldDef: { key: string; label: string; type: FieldType },
    lines: string[],
  ): ProviderRawField | null {
    const key = fieldDef.key.toLowerCase();

    if (fieldDef.type === FieldType.DATE) {
      const dateRegex = /\b(\d{4}-\d{2}-\d{2})\b/;
      for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(dateRegex);
        if (m) {
          return {
            value: m[1],
            confidence: 0.75,
            rawSnippet: lines[i],
            pageNumber: 1,
            boundingBox: { xMin: 0.1, yMin: i / lines.length, xMax: 0.8, yMax: (i + 1) / lines.length },
          };
        }
      }
    }

    if (fieldDef.type === FieldType.NUMBER) {
      const amountRegex = /\$?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)/;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(key.substring(0, 4))) {
          const m = lines[i].match(amountRegex);
          if (m) {
            const num = parseFloat(m[1].replace(/,/g, ''));
            return {
              value: num,
              confidence: 0.78,
              rawSnippet: lines[i],
              pageNumber: 1,
              boundingBox: { xMin: 0.1, yMin: i / lines.length, xMax: 0.8, yMax: (i + 1) / lines.length },
            };
          }
        }
      }
    }

    return null;
  }

  private parseValueByType(raw: string, type: FieldType): any {
    if (!raw) return null;
    const clean = raw.trim();

    if (type === FieldType.NUMBER) {
      // Remove currency symbols, commas, spaces
      const stripped = clean.replace(/[\$,\s]/g, '');
      const num = parseFloat(stripped);
      return isNaN(num) ? null : num;
    }

    if (type === FieldType.BOOLEAN) {
      if (/^(true|yes|1|y)$/i.test(clean)) return true;
      if (/^(false|no|0|n)$/i.test(clean)) return false;
      return null;
    }

    if (type === FieldType.DATE) {
      // Match ISO date YYYY-MM-DD
      const isoMatch = clean.match(/\b\d{4}-\d{2}-\d{2}\b/);
      if (isoMatch) return isoMatch[0];
      return clean;
    }

    return clean;
  }
}
