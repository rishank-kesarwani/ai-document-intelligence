import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class TriggerExtractionDto {
  @IsString()
  @IsNotEmpty()
  documentId: string;

  @IsString()
  @IsNotEmpty()
  schemaId: string;

  @IsOptional()
  @IsString()
  preferredProvider?: string;
}

export class RetryJobDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
