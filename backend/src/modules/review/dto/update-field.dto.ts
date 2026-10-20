import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class UpdateFieldDto {
  @IsNotEmpty()
  newValue: any;

  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsOptional()
  @IsString()
  author?: string;
}

export class ReviewDecisionDto {
  @IsOptional()
  @IsString()
  reviewerId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
