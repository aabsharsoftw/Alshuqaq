import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AcceptLanguage } from '../common/decorators/accept-language.decorator';
import {
  AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { Lang } from '../common/i18n/localize';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch('me/preferences')
  @ApiOperation({
    summary: 'Update the current user preferences (e.g. preferred language)',
  })
  updatePreferences(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdatePreferencesDto,
  ) {
    return this.usersService.setPreferredLanguage(
      user.id,
      dto.preferredLanguage,
    );
  }

  @Get('me/saved')
  @ApiOperation({
    summary: "List the current user's saved listings (localized)",
  })
  findSaved(@CurrentUser() user: AuthUser, @AcceptLanguage() lang: Lang) {
    return this.usersService.findSavedListings(user.id, lang);
  }

  @Post('me/saved/:listingId')
  @HttpCode(200)
  @ApiOperation({ summary: 'Save a listing to the current user' })
  save(@CurrentUser() user: AuthUser, @Param('listingId') listingId: string) {
    return this.usersService.saveListing(user.id, listingId);
  }

  @Delete('me/saved/:listingId')
  @ApiOperation({ summary: 'Remove a listing from the current user' })
  unsave(@CurrentUser() user: AuthUser, @Param('listingId') listingId: string) {
    return this.usersService.unsaveListing(user.id, listingId);
  }
}
