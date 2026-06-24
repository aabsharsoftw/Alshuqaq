import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateListingDto {
  @ApiProperty({ example: 'Spacious 2BHK near the park' })
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  title: string;

  @ApiProperty({ example: 25000, description: 'Monthly rent (whole units)' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  rent: number;

  @ApiProperty({ example: 'Bandra West, Mumbai' })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  location: string;

  @ApiProperty({ example: 'Bright apartment with balcony, 24/7 water...' })
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  description: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Save as draft (not submitted for review). Defaults to false.',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  isDraft?: boolean;
}
