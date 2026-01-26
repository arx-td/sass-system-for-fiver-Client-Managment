import { IsString, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

class SubmissionAttachmentDto {
  @IsString()
  url: string;

  @IsString()
  fileName: string;

  @IsString()
  @IsOptional()
  mimeType?: string;

  @IsOptional()
  size?: number;
}

export class SubmitTaskDto {
  @ApiPropertyOptional({ description: 'Submission note from developer' })
  @IsString()
  @IsOptional()
  note?: string;

  @ApiPropertyOptional({ description: 'Submission attachments (files, screenshots, etc.)' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubmissionAttachmentDto)
  @IsOptional()
  attachments?: SubmissionAttachmentDto[];
}
