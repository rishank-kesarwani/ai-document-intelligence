import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class SqlQueryDto {
  @IsString()
  @IsNotEmpty()
  naturalLanguageQuery: string;

  @IsOptional()
  @IsString()
  explicitSql?: string;

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

export class SqlExplainDto {
  @IsString()
  @IsNotEmpty()
  query: string;

  @IsOptional()
  @IsBoolean()
  isNaturalLanguage?: boolean;
}
