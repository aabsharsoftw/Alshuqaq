import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectListingDto {
  @ApiPropertyOptional({
    example: 'Images are unclear, please re-upload.',
    description: 'Optional reason included in the email to the landlord.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
