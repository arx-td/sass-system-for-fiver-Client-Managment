import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignTeamLeadDto {
  @ApiProperty({
    description: 'Team Lead user ID to assign',
  })
  @IsString()
  @IsNotEmpty({ message: 'Team Lead ID is required' })
  teamLeadId: string;
}
