import { IsString, IsOptional, IsNotEmpty, IsEnum, IsArray, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AssetType } from '@prisma/client';
import { Type } from 'class-transformer';

class AttachmentDto {
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

export class RequestAssetDto {
  @ApiProperty({ description: 'Asset name', example: 'Company Logo' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: AssetType, description: 'Type of asset' })
  @IsEnum(AssetType)
  assetType: AssetType;

  @ApiPropertyOptional({ description: 'Asset description/requirements' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Reference attachments (images, PDFs, etc.)' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  @IsOptional()
  attachments?: AttachmentDto[];
}
