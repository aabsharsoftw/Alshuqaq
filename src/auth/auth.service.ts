import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Language, Role, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { toLanguageEnum } from '../common/i18n/localize';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SignupDto } from './dto/signup.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { JwtPayload } from './jwt.strategy';

const BCRYPT_ROUNDS = 10;
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Step 1 of registration: validate the details, stash them in a pending
   * RegistrationOtp row, and email a one-time code. No User is created yet.
   */
  async requestRegistrationOtp(dto: SignupDto) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('An account with this email already exists.');
    }

    const code = this.generateOtp();
    const [codeHash, passwordHash] = await Promise.all([
      bcrypt.hash(code, BCRYPT_ROUNDS),
      bcrypt.hash(dto.password, BCRYPT_ROUNDS),
    ]);

    const data = {
      codeHash,
      passwordHash,
      name: dto.name,
      phone: dto.phone,
      role: dto.role as Role,
      preferredLanguage: (dto.preferredLanguage
        ? toLanguageEnum(dto.preferredLanguage)
        : 'EN') as Language,
      attempts: 0,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    };

    // Upsert so re-requesting a code overwrites the prior pending attempt.
    await this.prisma.registrationOtp.upsert({
      where: { email: dto.email },
      update: data,
      create: { email: dto.email, ...data },
    });

    await this.mailService.sendRegistrationOtp(dto.email, dto.name, code);

    return {
      message: 'A verification code has been sent to your email.',
      email: dto.email,
    };
  }

  /**
   * Step 2 of registration: verify the emailed code and create the User.
   */
  async verifyRegistrationOtp(dto: VerifyOtpDto) {
    const pending = await this.prisma.registrationOtp.findUnique({
      where: { email: dto.email },
    });
    if (!pending || pending.expiresAt < new Date()) {
      throw new UnauthorizedException(
        'The verification code is invalid or has expired.',
      );
    }
    if (pending.attempts >= OTP_MAX_ATTEMPTS) {
      await this.prisma.registrationOtp.delete({ where: { email: dto.email } });
      throw new UnauthorizedException(
        'Too many incorrect attempts. Please request a new code.',
      );
    }

    const valid = await bcrypt.compare(dto.code, pending.codeHash);
    if (!valid) {
      await this.prisma.registrationOtp.update({
        where: { email: dto.email },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException('The verification code is incorrect.');
    }

    // Guard against the email being taken between request and verification.
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      await this.prisma.registrationOtp.delete({ where: { email: dto.email } });
      throw new ConflictException('An account with this email already exists.');
    }

    const user = await this.usersService.create({
      email: dto.email,
      password: pending.passwordHash,
      name: pending.name,
      phone: pending.phone,
      role: pending.role,
      preferredLanguage: pending.preferredLanguage,
    });
    await this.prisma.registrationOtp.delete({ where: { email: dto.email } });

    // Welcome email for tenants (best-effort, non-blocking).
    if (user.role === Role.TENANT) {
      this.mailService.sendTenantWelcome(user.email, user.name);
    }

    return this.buildAuthResponse(user);
  }

  /**
   * Re-issues a registration code for a still-pending signup, replacing the
   * previous code and resetting the attempt counter and expiry.
   */
  async resendRegistrationOtp(email: string) {
    const pending = await this.prisma.registrationOtp.findUnique({
      where: { email },
    });
    if (!pending) {
      throw new NotFoundException(
        'No pending registration found for this email. Please sign up first.',
      );
    }

    const code = this.generateOtp();
    const codeHash = await bcrypt.hash(code, BCRYPT_ROUNDS);
    await this.prisma.registrationOtp.update({
      where: { email },
      data: {
        codeHash,
        attempts: 0,
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    });

    await this.mailService.sendRegistrationOtp(email, pending.name, code);

    return {
      message: 'A new verification code has been sent to your email.',
      email,
    };
  }

  /**
   * Starts a password reset: if an account exists, stash a one-time code and
   * email it. The response is identical whether or not the email is registered,
   * so it can't be used to probe which addresses have accounts.
   */
  async forgotPassword(email: string) {
    const genericResponse = {
      message:
        'If an account exists for this email, a reset code has been sent.',
    };

    const user = await this.usersService.findByEmail(email);
    if (!user) {
      return genericResponse;
    }

    const code = this.generateOtp();
    const codeHash = await bcrypt.hash(code, BCRYPT_ROUNDS);
    const data = {
      codeHash,
      attempts: 0,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    };
    await this.prisma.passwordResetOtp.upsert({
      where: { email },
      update: data,
      create: { email, ...data },
    });

    await this.mailService.sendPasswordReset(email, user.name, code);

    return genericResponse;
  }

  /**
   * Completes a password reset: verifies the emailed code, sets the new
   * password, and clears the pending reset row.
   */
  async resetPassword(dto: ResetPasswordDto) {
    const pending = await this.prisma.passwordResetOtp.findUnique({
      where: { email: dto.email },
    });
    if (!pending || pending.expiresAt < new Date()) {
      throw new UnauthorizedException(
        'The reset code is invalid or has expired.',
      );
    }
    if (pending.attempts >= OTP_MAX_ATTEMPTS) {
      await this.prisma.passwordResetOtp.delete({ where: { email: dto.email } });
      throw new UnauthorizedException(
        'Too many incorrect attempts. Please request a new code.',
      );
    }

    const valid = await bcrypt.compare(dto.code, pending.codeHash);
    if (!valid) {
      await this.prisma.passwordResetOtp.update({
        where: { email: dto.email },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException('The reset code is incorrect.');
    }

    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      await this.prisma.passwordResetOtp.delete({ where: { email: dto.email } });
      throw new UnauthorizedException(
        'The reset code is invalid or has expired.',
      );
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { password: passwordHash },
    });
    await this.prisma.passwordResetOtp.delete({ where: { email: dto.email } });

    return { message: 'Your password has been reset. You can now log in.' };
  }

  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }
    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password.');
    }
    return this.buildAuthResponse(user);
  }

  private buildAuthResponse(user: User) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    return {
      accessToken: this.jwtService.sign(payload),
      user: this.sanitize(user),
    };
  }

  private sanitize(user: User) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      landlordApproved: user.landlordApproved,
      preferredLanguage: user.preferredLanguage,
      createdAt: user.createdAt,
    };
  }
}
