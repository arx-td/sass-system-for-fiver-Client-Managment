import { IsString, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

class RejectionAttachmentDto {
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

export class RejectTaskDto {
  @ApiPropertyOptional({ description: 'Rejection note / feedback from Team Lead' })
  @IsString()
  @IsOptional()
  note?: string;

  @ApiPropertyOptional({ description: 'Reference attachments (images, PDFs, etc.)' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RejectionAttachmentDto)
  @IsOptional()
  attachments?: RejectionAttachmentDto[];
}
