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
import { VerifyOtpDto } from './dto/verify-otp.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Public()
  @Post('signup')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Start registration for a new TENANT or LANDLORD account',
    description:
      'Step 1 of 2. Emails a 6-digit verification code (valid 10 minutes) and ' +
      'stores the details until verified. No account is created yet — call ' +
      'POST /auth/verify-otp with the code to finish.',
  })
  signup(@Body() dto: SignupDto) {
    return this.authService.requestRegistrationOtp(dto);
  }

  @Public()
  @Post('verify-otp')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Verify the email OTP and create the account',
    description:
      'Step 2 of 2. On success the account is created and a JWT access token ' +
      'is returned. Tenants receive a welcome email.',
  })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyRegistrationOtp(dto);
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
