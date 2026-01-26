import { IsString, IsOptional, IsInt, IsDateString, IsNotEmpty, Min, Max, IsArray, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

class TaskAttachmentDto {
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

export class CreateTaskDto {
  @ApiProperty({ description: 'Task title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ description: 'Task description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Developer ID to assign' })
  @IsString()
  @IsNotEmpty()
  assignedToId: string;

  @ApiPropertyOptional({ description: 'Task priority (0-10)', default: 0 })
  @IsInt()
  @Min(0)
  @Max(10)
  @IsOptional()
  priority?: number;

  @ApiPropertyOptional({ description: 'Due date' })
  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Task attachments (images, PDFs, Word docs)' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskAttachmentDto)
  @IsOptional()
  attachments?: TaskAttachmentDto[];
}
