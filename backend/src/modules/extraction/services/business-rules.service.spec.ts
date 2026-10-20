import { BusinessRulesService } from './business-rules.service';
import {
  ExtractionSchema,
  FieldType,
  ValidationStatus,
  ExtractionJobStatus,
  ExtractedField,
} from '../../../common/types';

describe('BusinessRulesService & Cross-Field Validation', () => {
  let service: BusinessRulesService;

  const invoiceSchema: ExtractionSchema = {
    id: 'invoice-v1',
    name: 'Invoice Schema',
    version: '1.0.0',
    description: 'Invoice with math checks',
    documentType: 'invoice',
    createdAt: '',
    updatedAt: '',
    fields: [
      { key: 'invoice_number', label: 'Invoice Number', type: FieldType.STRING, required: true },
      { key: 'subtotal', label: 'Subtotal', type: FieldType.NUMBER, required: true },
      { key: 'tax_amount', label: 'Tax', type: FieldType.NUMBER, required: true },
      { key: 'total_amount', label: 'Total', type: FieldType.NUMBER, required: true },
      { key: 'invoice_date', label: 'Invoice Date', type: FieldType.DATE, required: true },
      { key: 'due_date', label: 'Due Date', type: FieldType.DATE, required: true },
    ],
    crossFieldRules: [
      {
        id: 'math-sum',
        name: 'Math Sum Check',
        description: 'subtotal + tax === total',
        fields: ['subtotal', 'tax_amount', 'total_amount'],
        validator: 'math_sum',
        errorMessage: 'Subtotal + tax must equal total',
      },
      {
        id: 'date-chrono',
        name: 'Date Chronology Check',
        description: 'invoice_date <= due_date',
        fields: ['invoice_date', 'due_date'],
        validator: 'date_range',
        errorMessage: 'Due date cannot precede invoice date',
      },
    ],
  };

  beforeEach(() => {
    service = new BusinessRulesService();
  });

  it('should validate correctly when math and chronology rules pass', () => {
    const fields: ExtractedField[] = [
      { key: 'invoice_number', label: 'Invoice Number', type: FieldType.STRING, value: 'INV-101', confidence: 0.95, validationStatus: ValidationStatus.VALID },
      { key: 'subtotal', label: 'Subtotal', type: FieldType.NUMBER, value: 1000, confidence: 0.95, validationStatus: ValidationStatus.VALID },
      { key: 'tax_amount', label: 'Tax', type: FieldType.NUMBER, value: 100, confidence: 0.95, validationStatus: ValidationStatus.VALID },
      { key: 'total_amount', label: 'Total', type: FieldType.NUMBER, value: 1100, confidence: 0.95, validationStatus: ValidationStatus.VALID },
      { key: 'invoice_date', label: 'Invoice Date', type: FieldType.DATE, value: '2026-10-01', confidence: 0.95, validationStatus: ValidationStatus.VALID },
      { key: 'due_date', label: 'Due Date', type: FieldType.DATE, value: '2026-10-31', confidence: 0.95, validationStatus: ValidationStatus.VALID },
    ];

    const result = service.validateFieldsAndRules(invoiceSchema, fields);
    expect(result.allValidationErrors.length).toBe(0);
    expect(result.overallStatus).toBe(ExtractionJobStatus.COMPLETED);
    expect(result.overallConfidence).toBe(0.95);
  });

  it('should flag math mismatch as validation error and set status to NEEDS_REVIEW', () => {
    const fields: ExtractedField[] = [
      { key: 'invoice_number', label: 'Invoice Number', type: FieldType.STRING, value: 'INV-102', confidence: 0.95, validationStatus: ValidationStatus.VALID },
      { key: 'subtotal', label: 'Subtotal', type: FieldType.NUMBER, value: 1000, confidence: 0.95, validationStatus: ValidationStatus.VALID },
      { key: 'tax_amount', label: 'Tax', type: FieldType.NUMBER, value: 100, confidence: 0.95, validationStatus: ValidationStatus.VALID },
      { key: 'total_amount', label: 'Total', type: FieldType.NUMBER, value: 1250, confidence: 0.95, validationStatus: ValidationStatus.VALID }, // Mismatch: 1000+100 != 1250
      { key: 'invoice_date', label: 'Invoice Date', type: FieldType.DATE, value: '2026-10-01', confidence: 0.95, validationStatus: ValidationStatus.VALID },
      { key: 'due_date', label: 'Due Date', type: FieldType.DATE, value: '2026-10-31', confidence: 0.95, validationStatus: ValidationStatus.VALID },
    ];

    const result = service.validateFieldsAndRules(invoiceSchema, fields);
    expect(result.allValidationErrors.length).toBeGreaterThan(0);
    expect(result.overallStatus).toBe(ExtractionJobStatus.NEEDS_REVIEW);

    const totalField = result.fields.find((f) => f.key === 'total_amount');
    expect(totalField?.validationStatus).toBe(ValidationStatus.INVALID);
  });

  it('should flag date chronology inversion as validation error and set status to NEEDS_REVIEW', () => {
    const fields: ExtractedField[] = [
      { key: 'invoice_number', label: 'Invoice Number', type: FieldType.STRING, value: 'INV-103', confidence: 0.95, validationStatus: ValidationStatus.VALID },
      { key: 'subtotal', label: 'Subtotal', type: FieldType.NUMBER, value: 500, confidence: 0.95, validationStatus: ValidationStatus.VALID },
      { key: 'tax_amount', label: 'Tax', type: FieldType.NUMBER, value: 50, confidence: 0.95, validationStatus: ValidationStatus.VALID },
      { key: 'total_amount', label: 'Total', type: FieldType.NUMBER, value: 550, confidence: 0.95, validationStatus: ValidationStatus.VALID },
      { key: 'invoice_date', label: 'Invoice Date', type: FieldType.DATE, value: '2026-11-15', confidence: 0.95, validationStatus: ValidationStatus.VALID },
      { key: 'due_date', label: 'Due Date', type: FieldType.DATE, value: '2026-10-01', confidence: 0.95, validationStatus: ValidationStatus.VALID }, // Inverted: due before invoice
    ];

    const result = service.validateFieldsAndRules(invoiceSchema, fields);
    expect(result.allValidationErrors.length).toBeGreaterThan(0);
    expect(result.overallStatus).toBe(ExtractionJobStatus.NEEDS_REVIEW);
  });
});
