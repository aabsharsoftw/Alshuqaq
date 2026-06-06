import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateEnquiryDto {
  @ApiProperty({ example: 'John Tenant' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: '+1234567890' })
  @IsString()
  @MinLength(5)
  @MaxLength(30)
  phone: string;

  @ApiPropertyOptional({
    example: 'john@example.com',
    description: 'If provided, a confirmation email is sent to the tenant.',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: 'Is this apartment still available?' })
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  message: string;
}
