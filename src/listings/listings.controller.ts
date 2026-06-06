import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseFilePipe,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import {
  AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateListingDto } from './dto/create-listing.dto';
import { QueryListingsDto } from './dto/query-listings.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { ListingsService } from './listings.service';

const MAX_IMAGES = 10;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB

@ApiTags('Listings')
@Controller('listings')
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}

  @Post()
  @Roles(Role.LANDLORD)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Create a listing (LANDLORD). Auto-approved for trusted landlords',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['title', 'rent', 'location', 'description', 'images'],
      properties: {
        title: { type: 'string' },
        rent: { type: 'number' },
        location: { type: 'string' },
        description: { type: 'string' },
        images: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  @UseInterceptors(
    FilesInterceptor('images', MAX_IMAGES, {
      limits: { fileSize: MAX_IMAGE_SIZE },
    }),
  )
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateListingDto,
    @UploadedFiles(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_IMAGE_SIZE }),
          new FileTypeValidator({ fileType: /^image\/(jpeg|png|webp)$/ }),
        ],
        fileIsRequired: true,
      }),
    )
    files: Express.Multer.File[],
  ) {
    return this.listingsService.create(user, dto, files);
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'Browse approved listings (public feed)' })
  findAll(@Query() query: QueryListingsDto) {
    return this.listingsService.findPublic(query);
  }

  @Get('mine')
  @Roles(Role.LANDLORD)
  @ApiBearerAuth()
  @ApiOperation({ summary: "List the current landlord's own listings" })
  findMine(@CurrentUser() user: AuthUser) {
    return this.listingsService.findMine(user.id);
  }

  @Public()
  @Get(':idOrNumber')
  @ApiOperation({
    summary: 'Get an approved listing by UUID or listing number',
  })
  findOne(@Param('idOrNumber') idOrNumber: string) {
    return this.listingsService.findOnePublic(idOrNumber);
  }

  @Patch(':id')
  @Roles(Role.LANDLORD, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Edit a listing (owner landlord or admin). Location is editable',
  })
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateListingDto,
  ) {
    return this.listingsService.update(id, user, dto);
  }

  @Delete(':id')
  @Roles(Role.LANDLORD, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a listing (owner landlord or admin)' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.listingsService.remove(id, user);
  }
}
