import {
  ConflictException,
  Injectable,
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
