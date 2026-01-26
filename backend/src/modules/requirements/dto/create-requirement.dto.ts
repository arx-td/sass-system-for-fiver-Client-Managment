import { IsString, IsOptional, IsArray, ValidateNested, IsNotEmpty, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

class RequirementContentDto {
  @ApiProperty({ description: 'Project overview' })
  @IsString()
  @IsNotEmpty()
  overview: string;

  @ApiPropertyOptional({ description: 'List of pages/sections' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  pages?: string[];

  @ApiPropertyOptional({ description: 'Functional requirements' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  functional?: string[];

  @ApiPropertyOptional({ description: 'Design notes and guidelines' })
  @IsString()
  @IsOptional()
  designNotes?: string;

  @ApiPropertyOptional({ description: 'Required plugins/integrations' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  plugins?: string[];

  @ApiPropertyOptional({ description: 'Items explicitly out of scope' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  outOfScope?: string[];
}

class AttachmentDto {
  @IsString()
  url: string;

  @IsString()
  fileName: string;

  @IsString()
  @IsOptional()
  mimeType?: string;

  @IsNumber()
  @IsOptional()
  size?: number;
}

export class CreateRequirementDto {
  @ApiProperty({ description: 'Requirement content' })
  @ValidateNested()
  @Type(() => RequirementContentDto)
  content: RequirementContentDto;

  @ApiPropertyOptional({ description: 'File attachments' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  @IsOptional()
  attachments?: AttachmentDto[];
}
