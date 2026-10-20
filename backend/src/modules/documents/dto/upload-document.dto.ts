import { IsOptional, IsString, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UploadDocumentDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  retentionDays?: number;

  @IsOptional()
  @IsString()
  documentType?: string;
}

export class DeleteDocumentQueryDto {
  @IsOptional()
  @IsString()
  hard?: string; // 'true' for physical deletion
}
