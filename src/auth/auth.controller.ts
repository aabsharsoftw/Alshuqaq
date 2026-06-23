import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Public()
  @Post('signup')
  @ApiOperation({
    summary: 'Register a new TENANT or LANDLORD account',
    description:
      'Returns a JWT access token. Tenants receive a welcome email. ' +
      'Logout is handled client-side by discarding the token.',
  })
  signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Log in with email and password' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the current authenticated user profile' })
  @ApiOkResponse({ description: 'The current user.' })
  async me(@CurrentUser() user: AuthUser) {
    const fresh = await this.usersService.findById(user.id);
    return {
      id: fresh!.id,
      email: fresh!.email,
      name: fresh!.name,
      phone: fresh!.phone,
      role: fresh!.role,
      landlordApproved: fresh!.landlordApproved,
      preferredLanguage: fresh!.preferredLanguage,
      createdAt: fresh!.createdAt,
    };
  }
}
