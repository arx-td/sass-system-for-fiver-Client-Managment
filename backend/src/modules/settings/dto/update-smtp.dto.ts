import {
  IsString,
  IsNumber,
  IsBoolean,
  IsEmail,
  IsOptional,
  ValidateNested,
  IsIn,
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

  @ApiPropertyOptional({ example: 'noreply@deepaxis.com' })
  @IsEmail()
  @IsOptional()
  from: string;

  @ApiPropertyOptional({ example: 'gmail', description: 'Email provider: gmail, sendgrid, mailgun, resend, custom' })
  @IsString()
  @IsOptional()
  @IsIn(['gmail', 'sendgrid', 'mailgun', 'resend', 'custom'])
  provider?: string;
}

export class TestSmtpDto {
  @ApiProperty({ example: 'test@example.com', description: 'Email to send test to' })
  @IsEmail()
  testEmail: string;
}
