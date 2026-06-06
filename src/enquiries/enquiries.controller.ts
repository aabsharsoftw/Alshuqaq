import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { PaginationDto } from '../common/dto/pagination.dto';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateEnquiryDto } from './dto/create-enquiry.dto';
import { EnquiriesService } from './enquiries.service';

@ApiTags('Enquiries')
@Controller()
export class EnquiriesController {
  constructor(private readonly enquiriesService: EnquiriesService) {}

  @Public()
  @Post('listings/:listingId/enquiries')
  @ApiOperation({ summary: 'Submit a contact enquiry for a listing (public)' })
  create(
    @Param('listingId') listingId: string,
    @Body() dto: CreateEnquiryDto,
  ) {
    return this.enquiriesService.create(listingId, dto);
  }

  @Get('enquiries')
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all enquiries (ADMIN)' })
  findAll(@Query() pagination: PaginationDto) {
    return this.enquiriesService.findAll(pagination);
  }
}
