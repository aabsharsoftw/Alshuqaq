import { ApiPropertyOptional } from '@nestjs/swagger';
import { ListingStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class AdminListingsQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: ListingStatus,
    description: 'Filter by status. Omit for all.',
  })
  @IsOptional()
  @IsEnum(ListingStatus)
  status?: ListingStatus;

  // Admin listings default to a larger page size.
  limit: number = 20;
}
