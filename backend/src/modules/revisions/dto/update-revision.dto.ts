import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { RevisionStatus } from '@prisma/client';

export class UpdateRevisionDto {
  @ApiPropertyOptional({ description: 'Revision status' })
  @IsEnum(RevisionStatus)
  @IsOptional()
  status?: RevisionStatus;

  @ApiPropertyOptional({ description: 'Assigned Team Lead ID' })
  @IsString()
  @IsOptional()
  assignedTeamLeadId?: string;

  @ApiPropertyOptional({ description: 'Assigned Developer ID' })
  @IsString()
  @IsOptional()
  assignedDeveloperId?: string;
}
