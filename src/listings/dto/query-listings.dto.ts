import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class QueryListingsDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Free-text search across location and title',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
