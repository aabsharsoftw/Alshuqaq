import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Body,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ListingStatus, Role } from '@prisma/client';
import { AcceptLanguage } from '../common/decorators/accept-language.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { Lang } from '../common/i18n/localize';
import { EnquiriesService } from '../enquiries/enquiries.service';
import { ListingsService } from '../listings/listings.service';
import { UsersService } from '../users/users.service';
import { AdminListingsQueryDto } from './dto/admin-listings-query.dto';
import { RejectListingDto } from './dto/reject-listing.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly listingsService: ListingsService,
    private readonly usersService: UsersService,
    private readonly enquiriesService: EnquiriesService,
  ) {}

  @Get('listings')
  @ApiOperation({ summary: 'List all listings, optionally filtered by status' })
  listings(
    @Query() query: AdminListingsQueryDto,
    @AcceptLanguage() lang: Lang,
  ) {
    return this.listingsService.adminFindAll(
      query.status,
      query.page,
      query.limit,
      lang,
    );
  }

  @Patch('listings/:id/approve')
  @ApiOperation({ summary: 'Approve a listing (notifies the landlord)' })
  approveListing(@Param('id') id: string, @AcceptLanguage() lang: Lang) {
    return this.listingsService.setStatus(
      id,
      ListingStatus.APPROVED,
      undefined,
      lang,
    );
  }

  @Patch('listings/:id/reject')
  @ApiOperation({ summary: 'Reject a listing (notifies the landlord)' })
  rejectListing(
    @Param('id') id: string,
    @Body() dto: RejectListingDto,
    @AcceptLanguage() lang: Lang,
  ) {
    return this.listingsService.setStatus(
      id,
      ListingStatus.REJECTED,
      dto.reason,
      lang,
    );
  }

  @Get('landlords')
  @ApiOperation({ summary: 'List landlords with their approval (trust) status' })
  landlords() {
    return this.usersService.findLandlords();
  }

  @Patch('landlords/:id/approve')
  @ApiOperation({
    summary:
      'Approve (trust) a landlord. Their future listings are auto-approved.',
  })
  approveLandlord(@Param('id') id: string) {
    return this.usersService.setLandlordApproved(id, true);
  }

  @Get('enquiries')
  @ApiOperation({ summary: 'List all enquiries' })
  enquiries(@Query() pagination: PaginationDto) {
    return this.enquiriesService.findAll(pagination);
  }
}
