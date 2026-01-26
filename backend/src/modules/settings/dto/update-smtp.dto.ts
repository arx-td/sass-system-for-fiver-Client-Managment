import {
  IsString,
  IsNumber,
  IsBoolean,
  IsEmail,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class SmtpAuthDto {
  @ApiProperty({ example: 'smtp_user' })
  @IsString()
  user: string;

  @ApiProperty({ example: 'smtp_password' })
  @IsString()
  pass: string;
}

export class UpdateSmtpDto {
  @ApiProperty({ example: 'smtp.mailtrap.io' })
  @IsString()
  host: string;

  @ApiProperty({ example: 2525 })
  @IsNumber()
  port: number;

  @ApiProperty({ example: false })
  @IsBoolean()
  secure: boolean;

  @ApiProperty({ type: SmtpAuthDto })
  @ValidateNested()
  @Type(() => SmtpAuthDto)
  auth: SmtpAuthDto;

  @ApiProperty({ example: 'noreply@codereve.com' })
  @IsEmail()
  from: string;
}

export class TestSmtpDto {
  @ApiProperty({ example: 'test@example.com', description: 'Email to send test to' })
  @IsEmail()
  testEmail: string;
}
