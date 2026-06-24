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
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
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
  @Post('otp/resend')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Resend the registration OTP for a pending signup',
    description:
      'Issues a fresh code (valid 10 minutes) and invalidates the previous ' +
      'one. Only works while a signup is still awaiting verification.',
  })
  resendOtp(@Body() dto: ResendOtpDto) {
    return this.authService.resendRegistrationOtp(dto.email);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Log in with email and password' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Request a password-reset code',
    description:
      'Emails a one-time reset code if an account exists. Always returns the ' +
      'same response so registered emails cannot be enumerated.',
  })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Reset the password using the emailed code',
    description:
      'Verifies the code from POST /auth/forgot-password and sets the new ' +
      'password. The code is single-use and expires after 10 minutes.',
  })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('logout')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Log out the current user',
    description:
      'JWTs are stateless, so this is a client-side token discard. The ' +
      'endpoint confirms the action and exists for client convenience.',
  })
  logout() {
    return { message: 'Logged out successfully.' };
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
