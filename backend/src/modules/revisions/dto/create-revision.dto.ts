import { IsString, IsOptional, IsArray, IsBoolean, IsNotEmpty, ValidateNested, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class AttachmentDto {
  @ApiProperty({ description: 'File URL' })
  @IsString()
  url: string;

  @ApiProperty({ description: 'File name' })
  @IsString()
  fileName: string;

  @ApiPropertyOptional({ description: 'MIME type' })
  @IsString()
  @IsOptional()
  mimeType?: string;

  @ApiPropertyOptional({ description: 'File size in bytes' })
  @IsNumber()
  @IsOptional()
  size?: number;
}

export class CreateRevisionDto {
  @ApiProperty({ description: 'Revision description/request' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({ description: 'Attachments with file details' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  @IsOptional()
  attachments?: AttachmentDto[];

  @ApiPropertyOptional({ description: 'Is this a paid revision?', default: false })
  @IsBoolean()
  @IsOptional()
  isPaid?: boolean;
}
