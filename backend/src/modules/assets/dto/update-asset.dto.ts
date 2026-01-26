import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AssetType } from '@prisma/client';

export class UpdateAssetDto {
  @ApiPropertyOptional({ description: 'Asset name' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ enum: AssetType, description: 'Type of asset' })
  @IsEnum(AssetType)
  @IsOptional()
  assetType?: AssetType;

  @ApiPropertyOptional({ description: 'Asset description/requirements' })
  @IsString()
  @IsOptional()
  description?: string;
}
