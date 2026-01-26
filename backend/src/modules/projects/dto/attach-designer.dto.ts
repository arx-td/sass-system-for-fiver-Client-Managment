import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AttachDesignerDto {
  @ApiProperty({
    description: 'Designer user ID to attach',
  })
  @IsString()
  @IsNotEmpty({ message: 'Designer ID is required' })
  designerId: string;
}
