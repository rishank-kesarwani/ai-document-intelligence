import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { ExtractionSchemaEntity } from './entities/extraction-schema.entity';
import { CreateSchemaDto } from './dto/create-schema.dto';
import { FieldType } from '../../common/types';

@Injectable()
export class SchemasService {
  private readonly schemas = new Map<string, ExtractionSchemaEntity>();

  constructor() {
    this.seedDefaultSchemas();
  }

  private seedDefaultSchemas(): void {
    // 1. Invoice Schema
    const invoiceSchema: ExtractionSchemaEntity = {
      id: 'invoice-v1',
      name: 'Invoice & Accounts Payable',
      version: '1.0.0',
      description: 'Standard accounts payable invoice schema with cross-field math validation',
      documentType: 'invoice',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      fields: [
        {
          key: 'invoice_number',
          label: 'Invoice Number',
          type: FieldType.STRING,
          required: true,
          rules: [{ ruleType: 'regex', expression: '^[A-Za-z0-9-_/]+$', errorMessage: 'Must be alphanumeric string' }],
          description: 'Unique identifier for the invoice',
        },
        {
          key: 'vendor_name',
          label: 'Vendor Name',
          type: FieldType.STRING,
          required: true,
          description: 'Name of the issuing vendor or supplier',
        },
        {
          key: 'invoice_date',
          label: 'Invoice Date',
          type: FieldType.DATE,
          required: true,
          description: 'Date the invoice was issued (YYYY-MM-DD)',
        },
        {
          key: 'due_date',
          label: 'Due Date',
          type: FieldType.DATE,
          required: true,
          description: 'Payment due date (YYYY-MM-DD)',
        },
        {
          key: 'currency',
          label: 'Currency',
          type: FieldType.ENUM,
          required: true,
          enumValues: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'INR', 'JPY'],
          description: '3-letter ISO currency code',
        },
        {
          key: 'subtotal',
          label: 'Subtotal Amount',
          type: FieldType.NUMBER,
          required: true,
          rules: [{ ruleType: 'range', expression: 'min:0', errorMessage: 'Subtotal cannot be negative' }],
        },
        {
          key: 'tax_amount',
          label: 'Tax Amount',
          type: FieldType.NUMBER,
          required: true,
          rules: [{ ruleType: 'range', expression: 'min:0', errorMessage: 'Tax amount cannot be negative' }],
        },
        {
          key: 'total_amount',
          label: 'Total Amount',
          type: FieldType.NUMBER,
          required: true,
          rules: [{ ruleType: 'range', expression: 'min:0', errorMessage: 'Total amount must be greater than zero' }],
        },
        {
          key: 'payment_status',
          label: 'Payment Status',
          type: FieldType.ENUM,
          required: false,
          enumValues: ['PENDING_PAYMENT', 'PAID', 'OVERDUE', 'CANCELLED'],
        },
      ],
      crossFieldRules: [
        {
          id: 'rule-math-sum',
          name: 'Total Equals Subtotal Plus Tax',
          description: 'Validates that Subtotal + Tax equals the declared Total Amount',
          fields: ['subtotal', 'tax_amount', 'total_amount'],
          validator: 'math_sum',
          errorMessage: 'Math mismatch: subtotal + tax does not equal total_amount',
        },
        {
          id: 'rule-date-sequence',
          name: 'Due Date Chronology',
          description: 'Validates that the invoice due date is on or after the invoice date',
          fields: ['invoice_date', 'due_date'],
          validator: 'date_range',
          errorMessage: 'Due date cannot be before invoice date',
        },
      ],
    };

    // 2. Commercial Contract / NDA Schema
    const contractSchema: ExtractionSchemaEntity = {
      id: 'contract-v1',
      name: 'Commercial Contract & NDA',
      version: '1.0.0',
      description: 'Contract terms, party names, jurisdiction, liability caps, and date validity',
      documentType: 'contract',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      fields: [
        {
          key: 'agreement_title',
          label: 'Agreement Title',
          type: FieldType.STRING,
          required: true,
          description: 'Title of the legal agreement',
        },
        {
          key: 'parties',
          label: 'Contracting Parties',
          type: FieldType.STRING,
          required: true,
          description: 'Names of the signatory entities',
        },
        {
          key: 'effective_date',
          label: 'Effective Date',
          type: FieldType.DATE,
          required: true,
          description: 'Agreement start date (YYYY-MM-DD)',
        },
        {
          key: 'expiration_date',
          label: 'Expiration Date',
          type: FieldType.DATE,
          required: true,
          description: 'Agreement end or termination date (YYYY-MM-DD)',
        },
        {
          key: 'governing_law',
          label: 'Governing Law',
          type: FieldType.STRING,
          required: true,
          description: 'State or country jurisdiction governing the agreement',
        },
        {
          key: 'liability_cap',
          label: 'Liability Cap ($)',
          type: FieldType.NUMBER,
          required: false,
          rules: [{ ruleType: 'range', expression: 'min:0', errorMessage: 'Liability cap cannot be negative' }],
        },
      ],
      crossFieldRules: [
        {
          id: 'rule-contract-dates',
          name: 'Effective Date Prior to Expiration',
          description: 'Validates that effective_date is on or before expiration_date',
          fields: ['effective_date', 'expiration_date'],
          validator: 'date_range',
          errorMessage: 'Contract expiration date must be after effective date',
        },
      ],
    };

    // 3. W-9 Tax Form Schema
    const taxFormSchema: ExtractionSchemaEntity = {
      id: 'tax-form-w9',
      name: 'W-9 Taxpayer Identification Form',
      version: '1.0.0',
      description: 'IRS Form W-9 taxpayer certification, entity classification, and masked EIN',
      documentType: 'tax_form',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      fields: [
        {
          key: 'taxpayer_name',
          label: 'Taxpayer Name',
          type: FieldType.STRING,
          required: true,
          description: 'Name as shown on federal income tax return',
        },
        {
          key: 'business_name',
          label: 'Business / Disregarded Entity Name',
          type: FieldType.STRING,
          required: false,
        },
        {
          key: 'tax_classification',
          label: 'Tax Classification',
          type: FieldType.ENUM,
          required: true,
          enumValues: [
            'Individual/Sole proprietor',
            'C Corporation',
            'S Corporation',
            'Partnership',
            'Trust/estate',
            'Limited Liability Company',
            'Other',
          ],
        },
        {
          key: 'tax_id_ein',
          label: 'Taxpayer ID / EIN',
          type: FieldType.STRING,
          required: true,
          description: 'Employer Identification Number or Social Security Number',
        },
        {
          key: 'address',
          label: 'Address',
          type: FieldType.STRING,
          required: true,
        },
        {
          key: 'certification_date',
          label: 'Certification Date',
          type: FieldType.DATE,
          required: true,
        },
      ],
    };

    this.schemas.set(invoiceSchema.id, invoiceSchema);
    this.schemas.set(contractSchema.id, contractSchema);
    this.schemas.set(taxFormSchema.id, taxFormSchema);
  }

  async findAll(tenantId?: string): Promise<ExtractionSchemaEntity[]> {
    const list: ExtractionSchemaEntity[] = [];
    for (const schema of this.schemas.values()) {
      if (!schema.tenantId || schema.tenantId === tenantId) {
        list.push(schema);
      }
    }
    return list;
  }

  async findById(id: string, tenantId?: string): Promise<ExtractionSchemaEntity> {
    const schema = this.schemas.get(id);
    if (!schema) {
      throw new NotFoundException(`Extraction schema "${id}" not found`);
    }
    if (schema.tenantId && tenantId && schema.tenantId !== tenantId) {
      throw new NotFoundException(`Extraction schema "${id}" not found for this tenant`);
    }
    return schema;
  }

  async create(dto: CreateSchemaDto, tenantId?: string): Promise<ExtractionSchemaEntity> {
    if (this.schemas.has(dto.id)) {
      throw new ConflictException(`Schema with ID "${dto.id}" already exists`);
    }

    const now = new Date().toISOString();
    const newSchema: ExtractionSchemaEntity = {
      ...dto,
      tenantId,
      createdAt: now,
      updatedAt: now,
    };

    this.schemas.set(newSchema.id, newSchema);
    return newSchema;
  }
}
