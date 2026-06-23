import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { LangCode } from '../../common/i18n/localize';

export class UpdatePreferencesDto {
  @ApiProperty({ enum: LangCode, example: LangCode.AR })
  @IsEnum(LangCode)
  preferredLanguage: LangCode;
}
