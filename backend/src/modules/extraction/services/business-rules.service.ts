import { Injectable, Logger } from '@nestjs/common';
import {
  ExtractedField,
  ExtractionJobStatus,
  ExtractionSchema,
  FieldType,
  ValidationStatus,
} from '../../../common/types';

@Injectable()
export class BusinessRulesService {
  private readonly logger = new Logger(BusinessRulesService.name);

  validateFieldsAndRules(
    schema: ExtractionSchema,
    fields: ExtractedField[],
  ): {
    fields: ExtractedField[];
    overallStatus: ExtractionJobStatus;
    allValidationErrors: string[];
    overallConfidence: number;
  } {
    const allValidationErrors: string[] = [];
    const fieldsMap = new Map<string, ExtractedField>();

    for (const f of fields) {
      fieldsMap.set(f.key, f);
    }

    let confidenceSum = 0;
    let fieldCount = 0;

    // 1. Field-level validation
    for (const fieldDef of schema.fields) {
      const field = fieldsMap.get(fieldDef.key);
      if (!field) continue;

      fieldCount++;
      confidenceSum += field.confidence;

      const fieldErrors: string[] = [];

      // Check required
      if (fieldDef.required && (field.value === null || field.value === undefined || field.value === '')) {
        fieldErrors.push(`Field "${fieldDef.label}" is required but missing`);
      }

      // Check enums
      if (fieldDef.type === FieldType.ENUM && field.value && fieldDef.enumValues) {
        if (!fieldDef.enumValues.includes(String(field.value))) {
          fieldErrors.push(
            `Value "${field.value}" is not valid for enum [${fieldDef.enumValues.join(', ')}]`,
          );
        }
      }

      // Check date format
      if (fieldDef.type === FieldType.DATE && field.value) {
        const d = new Date(String(field.value));
        if (isNaN(d.getTime())) {
          fieldErrors.push(`Value "${field.value}" is not a valid date`);
        }
      }

      // Check custom rules
      if (fieldDef.rules && field.value !== null && field.value !== undefined) {
        for (const rule of fieldDef.rules) {
          if (rule.ruleType === 'regex') {
            const re = new RegExp(rule.expression);
            if (!re.test(String(field.value))) {
              fieldErrors.push(rule.errorMessage || `Field failed regex validation (${rule.expression})`);
            }
          } else if (rule.ruleType === 'range' && typeof field.value === 'number') {
            if (rule.expression.startsWith('min:')) {
              const minVal = parseFloat(rule.expression.split(':')[1]);
              if (field.value < minVal) {
                fieldErrors.push(rule.errorMessage || `Value must be at least ${minVal}`);
              }
            }
          }
        }
      }

      if (fieldErrors.length > 0) {
        field.validationStatus = ValidationStatus.INVALID;
        field.validationErrors = [...(field.validationErrors || []), ...fieldErrors];
        allValidationErrors.push(...fieldErrors);
      }
    }

    // 2. Cross-field rule validation
    if (schema.crossFieldRules) {
      for (const rule of schema.crossFieldRules) {
        if (rule.validator === 'math_sum') {
          // e.g. fields: ['subtotal', 'tax_amount', 'total_amount']
          // Expecting: fields[0] + fields[1] = fields[2]
          const [f1Key, f2Key, sumKey] = rule.fields;
          const v1 = Number(fieldsMap.get(f1Key)?.value || 0);
          const v2 = Number(fieldsMap.get(f2Key)?.value || 0);
          const expectedSum = Number(fieldsMap.get(sumKey)?.value || 0);

          if (Math.abs(v1 + v2 - expectedSum) > 0.02) {
            const err = `${rule.name}: Math check failed. ${f1Key} (${v1}) + ${f2Key} (${v2}) = ${(v1 + v2).toFixed(2)}, which does not match ${sumKey} (${expectedSum})`;
            allValidationErrors.push(err);

            // Mark the involved fields
            const fSum = fieldsMap.get(sumKey);
            if (fSum) {
              fSum.validationStatus = ValidationStatus.INVALID;
              fSum.validationErrors = [...(fSum.validationErrors || []), err];
            }
          }
        } else if (rule.validator === 'date_range') {
          // e.g. fields: ['invoice_date', 'due_date']
          const [startKey, endKey] = rule.fields;
          const startVal = fieldsMap.get(startKey)?.value;
          const endVal = fieldsMap.get(endKey)?.value;

          if (startVal && endVal) {
            const d1 = new Date(String(startVal));
            const d2 = new Date(String(endVal));
            if (!isNaN(d1.getTime()) && !isNaN(d2.getTime()) && d1 > d2) {
              const err = `${rule.name}: Date range invalid. ${startKey} (${startVal}) occurs after ${endKey} (${endVal})`;
              allValidationErrors.push(err);

              const fEnd = fieldsMap.get(endKey);
              if (fEnd) {
                fEnd.validationStatus = ValidationStatus.INVALID;
                fEnd.validationErrors = [...(fEnd.validationErrors || []), err];
              }
            }
          }
        }
      }
    }

    const overallConfidence = fieldCount > 0 ? parseFloat((confidenceSum / fieldCount).toFixed(2)) : 0;

    // Determine state
    let overallStatus: ExtractionJobStatus;
    if (allValidationErrors.length > 0 || overallConfidence < 0.85) {
      overallStatus = ExtractionJobStatus.NEEDS_REVIEW;
    } else {
      overallStatus = ExtractionJobStatus.COMPLETED;
    }

    return {
      fields: Array.from(fieldsMap.values()),
      overallStatus,
      allValidationErrors,
      overallConfidence,
    };
  }
}
