import {
  IsString,
  IsEnum,
  IsOptional,
  IsDateString,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectComplexity, ProjectPriority, ProjectStatus } from '@prisma/client';

export class UpdateProjectDto {
  @ApiPropertyOptional({
    example: 'Updated Project Name',
    description: 'Internal project name',
  })
  @IsString()
  @IsOptional()
  internalName?: string;

  @ApiPropertyOptional({
    example: 'WooCommerce Development',
    description: 'Type of project',
  })
  @IsString()
  @IsOptional()
  projectType?: string;

  @ApiPropertyOptional({
    enum: ProjectComplexity,
    description: 'Project complexity level',
  })
  @IsEnum(ProjectComplexity, { message: 'Invalid complexity level' })
  @IsOptional()
  complexity?: ProjectComplexity;

  @ApiPropertyOptional({
    enum: ProjectPriority,
    description: 'Project priority',
  })
  @IsEnum(ProjectPriority, { message: 'Invalid priority' })
  @IsOptional()
  priority?: ProjectPriority;

  @ApiPropertyOptional({
    enum: ProjectStatus,
    description: 'Project status',
  })
  @IsEnum(ProjectStatus, { message: 'Invalid status' })
  @IsOptional()
  status?: ProjectStatus;

  @ApiPropertyOptional({
    description: 'Internal deadline',
  })
  @IsDateString()
  @IsOptional()
  internalDeadline?: string;

  @ApiPropertyOptional({
    description: 'Fiverr delivery deadline',
  })
  @IsDateString()
  @IsOptional()
  fiverrDeadline?: string;

  @ApiPropertyOptional({
    description: 'Project budget (Admin only)',
  })
  @IsString()
  @IsOptional()
  budget?: string;

  @ApiPropertyOptional({
    description: 'Meeting link',
  })
  @IsString()
  @IsOptional()
  meetingLink?: string;

  @ApiPropertyOptional({
    description: 'Domain link for completed project',
  })
  @IsString()
  @IsOptional()
  domainLink?: string;

  @ApiPropertyOptional({
    description: 'Staging/development site link',
  })
  @IsString()
  @IsOptional()
  stagingLink?: string;

  @ApiPropertyOptional({
    description: 'Password for staging site access',
  })
  @IsString()
  @IsOptional()
  stagingPassword?: string;

  @ApiPropertyOptional({
    description: 'Client email address',
  })
  @IsString()
  @IsOptional()
  clientEmail?: string;

  @ApiPropertyOptional({
    description: 'Client username (Fiverr/platform username)',
  })
  @IsString()
  @IsOptional()
  clientUsername?: string;

  @ApiPropertyOptional({
    description: 'Designer ID to assign to project',
  })
  @IsString()
  @IsOptional()
  designerId?: string;
}
