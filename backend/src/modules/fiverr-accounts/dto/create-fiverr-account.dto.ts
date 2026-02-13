import { IsNotEmpty, IsString, IsEmail, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFiverrAccountDto {
  @ApiProperty({
    example: 'DEEPAXIS_Main',
    description: 'Fiverr account name/username',
  })
  @IsString()
  @IsNotEmpty({ message: 'Account name is required' })
  accountName: string;

  @ApiPropertyOptional({
    example: 'account@deepaxis.com',
    description: 'Email associated with the Fiverr account',
  })
  @IsEmail({}, { message: 'Please provide a valid email' })
  @IsOptional()
  accountEmail?: string;
}
