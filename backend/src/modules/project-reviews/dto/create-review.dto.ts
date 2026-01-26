import {
  IsString,
  IsInt,
  IsOptional,
  Min,
  Max,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateReviewDto {
  @ApiProperty({ description: 'Project ID' })
  @IsString()
  @IsNotEmpty()
  projectId: string;

  @ApiProperty({ description: 'Developer ID being reviewed' })
  @IsString()
  @IsNotEmpty()
  developerId: string;

  @ApiProperty({ description: 'Overall rating (1-5)', minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiPropertyOptional({ description: 'Client feedback summary' })
  @IsString()
  @IsOptional()
  clientFeedback?: string;

  @ApiPropertyOptional({ description: 'Admin notes about performance' })
  @IsString()
  @IsOptional()
  adminNotes?: string;

  @ApiPropertyOptional({ description: 'Code quality score (1-5)', minimum: 1, maximum: 5 })
  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(5)
  codeQuality?: number;

  @ApiPropertyOptional({ description: 'Communication score (1-5)', minimum: 1, maximum: 5 })
  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(5)
  communicationScore?: number;

  @ApiPropertyOptional({ description: 'Delivery speed score (1-5)', minimum: 1, maximum: 5 })
  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(5)
  deliverySpeed?: number;

  @ApiPropertyOptional({ description: 'Problem solving score (1-5)', minimum: 1, maximum: 5 })
  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(5)
  problemSolving?: number;
}
