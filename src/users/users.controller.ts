import { Body, Controller, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
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
}
