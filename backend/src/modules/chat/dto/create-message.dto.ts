import { IsString, IsOptional, IsArray, IsNotEmpty, ValidateNested, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
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

class MentionDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsString()
  role: string;
}

export class CreateMessageDto {
  @ApiProperty({ description: 'Message content' })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({ description: 'File attachments' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  @IsOptional()
  attachments?: AttachmentDto[];

  @ApiPropertyOptional({
    description: 'Message priority (HIGH = important)',
    enum: ['NORMAL', 'HIGH'],
    default: 'NORMAL',
  })
  @IsString()
  @IsIn(['NORMAL', 'HIGH'])
  @IsOptional()
  priority?: 'NORMAL' | 'HIGH';

  @ApiPropertyOptional({
    description: 'Roles that can see this message',
    default: ['ADMIN', 'MANAGER'],
  })
  @IsArray()
  @IsOptional()
  visibleToRoles?: UserRole[];

  @ApiPropertyOptional({ description: 'Mentioned users in the message' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MentionDto)
  @IsOptional()
  mentions?: MentionDto[];
}
