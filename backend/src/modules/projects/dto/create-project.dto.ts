import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsOptional,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectComplexity, ProjectPriority } from '@prisma/client';

export class CreateProjectDto {
  @ApiProperty({
    example: 'E-commerce Website Redesign',
    description: 'Internal project name',
  })
  @IsString()
  @IsNotEmpty({ message: 'Project name is required' })
  internalName: string;

  @ApiProperty({
    description: 'Fiverr account ID this project belongs to',
  })
  @IsString()
  @IsNotEmpty({ message: 'Fiverr account is required' })
  fiverrAccountId: string;

  @ApiProperty({
    example: 'WordPress Development',
    description: 'Type of project',
  })
  @IsString()
  @IsNotEmpty({ message: 'Project type is required' })
  projectType: string;

  @ApiProperty({
    enum: ProjectComplexity,
    example: ProjectComplexity.MEDIUM,
    description: 'Project complexity level',
  })
  @IsEnum(ProjectComplexity, { message: 'Invalid complexity level' })
  @IsNotEmpty()
  complexity: ProjectComplexity;

  @ApiPropertyOptional({
    enum: ProjectPriority,
    example: ProjectPriority.MEDIUM,
    description: 'Project priority',
  })
  @IsEnum(ProjectPriority, { message: 'Invalid priority' })
  @IsOptional()
  priority?: ProjectPriority;

  @ApiPropertyOptional({
    example: '2024-02-15',
    description: 'Internal deadline',
  })
  @IsDateString()
  @IsOptional()
  internalDeadline?: string;

  @ApiPropertyOptional({
    example: '2024-02-20',
    description: 'Fiverr delivery deadline',
  })
  @IsDateString()
  @IsOptional()
  fiverrDeadline?: string;

  @ApiPropertyOptional({
    example: '500',
    description: 'Project budget (Admin only, encrypted)',
  })
  @IsString()
  @IsOptional()
  budget?: string;

  @ApiPropertyOptional({
    example: 'https://zoom.us/j/123456789',
    description: 'Meeting link for client calls',
  })
  @IsString()
  @IsOptional()
  meetingLink?: string;

  @ApiPropertyOptional({
    example: 'https://staging.example.com',
    description: 'Staging/development site link',
  })
  @IsString()
  @IsOptional()
  stagingLink?: string;

  @ApiPropertyOptional({
    example: 'staging123',
    description: 'Password for staging site access',
  })
  @IsString()
  @IsOptional()
  stagingPassword?: string;

  @ApiPropertyOptional({
    example: 'client@example.com',
    description: 'Client email address',
  })
  @IsString()
  @IsOptional()
  clientEmail?: string;

  @ApiPropertyOptional({
    example: 'client_username',
    description: 'Client username (Fiverr/platform username)',
  })
  @IsString()
  @IsOptional()
  clientUsername?: string;

  @ApiPropertyOptional({
    description: 'Manager ID to assign',
  })
  @IsString()
  @IsOptional()
  managerId?: string;

  @ApiPropertyOptional({
    description: 'Designer ID to attach',
  })
  @IsString()
  @IsOptional()
  designerId?: string;
}
