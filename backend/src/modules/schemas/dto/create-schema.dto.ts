import {
  IsString,
  IsArray,
  IsOptional,
  ValidateNested,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FieldDefinition, CrossFieldRule } from '../../../common/types';

export class CreateSchemaDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  version: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsNotEmpty()
  documentType: string;

  @IsArray()
  fields: FieldDefinition[];

  @IsOptional()
  @IsArray()
  crossFieldRules?: CrossFieldRule[];
}
