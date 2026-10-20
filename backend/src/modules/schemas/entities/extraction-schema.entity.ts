import {
  ExtractionSchema,
  FieldDefinition,
  CrossFieldRule,
} from '../../../common/types';

export class ExtractionSchemaEntity implements ExtractionSchema {
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
