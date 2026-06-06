import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsString, MaxLength, Min, MinLength } from 'class-validator';

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
}
