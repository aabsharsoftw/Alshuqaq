import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { LangCode } from '../../common/i18n/localize';

/** Public self-signup is limited to TENANT or LANDLORD. Admins are seeded. */
export enum SignupRole {
  TENANT = 'TENANT',
  LANDLORD = 'LANDLORD',
}

export class SignupDto {
  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'StrongPass123', minLength: 6 })
  @IsString()
  @MinLength(6)
  @MaxLength(72) // bcrypt max input length
  password: string;

  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: '+1234567890' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiProperty({ enum: SignupRole, default: SignupRole.TENANT })
  @IsEnum(SignupRole)
  role: SignupRole;

  @ApiPropertyOptional({ enum: LangCode, default: LangCode.EN })
  @IsOptional()
  @IsEnum(LangCode)
  preferredLanguage?: LangCode;
}
