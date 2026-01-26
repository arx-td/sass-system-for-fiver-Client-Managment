import { IsOptional, IsEnum, IsString, IsInt, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ProjectStatus, ProjectPriority, ProjectComplexity } from '@prisma/client';

export class QueryProjectsDto {
  @ApiPropertyOptional({
    enum: ProjectStatus,
    description: 'Filter by status',
  })
  @IsEnum(ProjectStatus)
  @IsOptional()
  status?: ProjectStatus;

  @ApiPropertyOptional({
    enum: ProjectPriority,
    description: 'Filter by priority',
  })
  @IsEnum(ProjectPriority)
  @IsOptional()
  priority?: ProjectPriority;

  @ApiPropertyOptional({
    enum: ProjectComplexity,
    description: 'Filter by complexity',
  })
  @IsEnum(ProjectComplexity)
  @IsOptional()
  complexity?: ProjectComplexity;

  @ApiPropertyOptional({
    description: 'Filter by Fiverr account ID',
  })
  @IsString()
  @IsOptional()
  fiverrAccountId?: string;

  @ApiPropertyOptional({
    description: 'Filter by manager ID',
  })
  @IsString()
  @IsOptional()
  managerId?: string;

  @ApiPropertyOptional({
    description: 'Filter by team lead ID',
  })
  @IsString()
  @IsOptional()
  teamLeadId?: string;

  @ApiPropertyOptional({
    description: 'Search by project name',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    default: 1,
    description: 'Page number',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({
    default: 10,
    description: 'Items per page',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 10;
}
