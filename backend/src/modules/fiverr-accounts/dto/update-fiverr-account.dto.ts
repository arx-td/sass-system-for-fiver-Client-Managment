import { IsString, IsEmail, IsOptional, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateFiverrAccountDto {
  @ApiPropertyOptional({
    example: 'DEEPAXIS_Pro',
    description: 'Fiverr account name/username',
  })
  @IsString()
  @IsOptional()
  accountName?: string;

  @ApiPropertyOptional({
    example: 'newemail@deepaxis.com',
    description: 'Email associated with the Fiverr account',
  })
  @IsEmail({}, { message: 'Please provide a valid email' })
  @IsOptional()
  accountEmail?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Whether the account is active',
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
