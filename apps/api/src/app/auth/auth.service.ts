import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  AuthUser,
  ErrorCode,
  LoginResponse,
  RegisterDto,
  RegisterResponse,
  UserRole,
} from '@arvid-l-monorepo-template/shared';
import { MailService } from '../mail/mail.service';
import { UsersService } from './users.service';
import { RefreshTokensService } from './refresh-tokens.service';
import { PasswordResetTokensService } from './password-reset-tokens.service';
import { EmailVerificationTokensService } from './email-verification-tokens.service';
import { hashPassword, verifyPassword } from './password.util';

const PG_UNIQUE_VIOLATION = '23505';

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  (error as { code?: string }).code === PG_UNIQUE_VIOLATION;

// The role rides in the JWT so RolesGuard needs no DB lookup. It can be up
// to JWT_EXPIRES_IN (15m) stale after a role change — acceptable; a forced
// re-login applies it immediately.
export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly refreshTokensService: RefreshTokensService,
    private readonly passwordResetTokensService: PasswordResetTokensService,
    private readonly emailVerificationTokensService: EmailVerificationTokensService,
    private readonly mailService: MailService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(email: string, password: string): Promise<LoginResponse> {
    const user = await this.usersService.findByEmail(email);

    if (!user || !verifyPassword(password, user.password_hash)) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Hard gate: unverified accounts cannot log in. Distinct errorCode
    // (passed through HttpExceptionFilter) so the FE can offer "resend
    // verification mail" instead of a generic error.
    if (!user.email_verified_at) {
      throw new ForbiddenException({
        statusCode: 403,
        errorCode: ErrorCode.EMAIL_NOT_VERIFIED,
        message: 'Please verify your email address first',
      });
    }

    return this.issueTokenPair(this.toAuthUser(user));
  }

  // Open registration — every new account gets the USER role and starts
  // unverified: no tokens until the mailed link is clicked (hard gate).
  // Admins and moderators are promoted via
  // `npm run user:create -- <email> <pw> <role>` or a future admin UI.
  async register(dto: RegisterDto): Promise<RegisterResponse> {
    try {
      const user = await this.usersService.create({
        email: dto.email,
        passwordHash: hashPassword(dto.password),
        displayName: dto.displayName || null,
        privacyAccepted: dto.privacyAccepted,
      });
      await this.sendVerificationMail(user.id, user.email);
      return { message: 'Check your inbox to verify your email address' };
    } catch (error) {
      // Race-safe duplicate check: rely on the unique index instead of a
      // separate SELECT beforehand.
      if (isUniqueViolation(error)) {
        throw new ConflictException('Email is already registered');
      }
      throw error;
    }
  }

  async verifyEmail(token: string): Promise<LoginResponse> {
    const stored = await this.emailVerificationTokensService.findValid(token);
    if (!stored) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    const user = await this.usersService.findById(stored.user_id);
    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    if (stored.new_email) {
      // Email-change confirmation: the link went to the new address, so
      // clicking it proves ownership. The unique index has the final word —
      // the address may have been taken since the change was requested.
      try {
        await this.usersService.updateEmail(user.id, stored.new_email);
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new BadRequestException('Email address is no longer available');
        }
        throw error;
      }
      user.email = stored.new_email;
    } else {
      await this.usersService.markEmailVerified(user.id);
    }
    await this.emailVerificationTokensService.markUsed(stored.id);

    // Clicking the mail link logs the user straight in.
    return this.issueTokenPair(this.toAuthUser(user));
  }

  // Same no-enumeration contract as forgotPassword: always resolves.
  async resendVerification(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);
    if (!user || user.email_verified_at) {
      return;
    }
    await this.sendVerificationMail(user.id, user.email);
  }

  private async sendVerificationMail(
    userId: string,
    email: string,
  ): Promise<void> {
    // null = reissued too soon (rate limit) — stay silent.
    const token = await this.emailVerificationTokensService.issue(userId);
    if (!token) {
      return;
    }

    const baseUrl =
      this.configService.get<string>('APP_BASE_URL') ?? 'http://localhost:4200';
    const verifyUrl = `${baseUrl}/verify-email?token=${token}`;

    // The SMTP call itself must not fail registration/resend — failures
    // only get logged (link stays retrievable via resend).
    await this.mailService
      .send({
        to: email,
        subject: 'Verify your email address',
        text:
          `Welcome! Confirm this email address to activate your account.\n\n` +
          `Verify your email (link valid for 24 hours):\n${verifyUrl}\n\n` +
          `If you didn't create this account, ignore this mail.`,
      })
      .catch((error) =>
        this.logger.error(`Verification mail to ${email} failed`, error),
      );
  }

  // Rotation: every refresh revokes the used token and issues a new pair,
  // so a leaked refresh token stops working as soon as its holder or the
  // legitimate client refreshes.
  async refresh(refreshToken: string): Promise<LoginResponse> {
    const stored = await this.refreshTokensService.findValid(refreshToken);
    if (!stored) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.usersService.findById(stored.user_id);
    if (!user) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    await this.refreshTokensService.revoke(stored.id);
    return this.issueTokenPair(this.toAuthUser(user));
  }

  async logout(refreshToken: string): Promise<void> {
    const stored = await this.refreshTokensService.findValid(refreshToken);
    if (stored) {
      await this.refreshTokensService.revoke(stored.id);
    }
  }

  // Always resolves without revealing whether the email exists (no account
  // enumeration). The mail goes out after the response — its latency must
  // not leak the difference either.
  async forgotPassword(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      return;
    }

    const token = await this.passwordResetTokensService.issue(user.id);
    const baseUrl =
      this.configService.get<string>('APP_BASE_URL') ?? 'http://localhost:4200';
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;

    // Deliberately not awaited: SMTP latency on known emails would leak
    // account existence through response timing. Failures only get logged.
    this.mailService
      .send({
        to: user.email,
        subject: 'Reset your password',
        text:
          `Someone requested a password reset for this account.\n\n` +
          `Reset your password (link valid for 1 hour):\n${resetUrl}\n\n` +
          `If this wasn't you, ignore this mail — your password is unchanged.`,
      })
      .catch((error) =>
        this.logger.error(`Password reset mail to ${user.email} failed`, error),
      );
  }

  async resetPassword(token: string, password: string): Promise<void> {
    const stored = await this.passwordResetTokensService.findValid(token);
    if (!stored) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    await this.usersService.updatePassword(
      stored.user_id,
      hashPassword(password),
    );
    await this.passwordResetTokensService.markUsed(stored.id);
    // The password may have leaked — kill all existing sessions.
    await this.refreshTokensService.revokeAllForUser(stored.user_id);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<LoginResponse> {
    const user = await this.usersService.findById(userId);
    if (!user || !verifyPassword(currentPassword, user.password_hash)) {
      // 400, not 401: a 401 would make the FE interceptor attempt a token
      // refresh and log the user out over a typo.
      throw new BadRequestException('Current password is incorrect');
    }

    await this.usersService.updatePassword(userId, hashPassword(newPassword));
    // Same reasoning as resetPassword: assume other sessions are stale or
    // hostile once the password changes — kill them, keep this one via a
    // fresh pair.
    await this.refreshTokensService.revokeAllForUser(userId);
    return this.issueTokenPair(this.toAuthUser(user));
  }

  async changeEmail(
    userId: string,
    newEmail: string,
    password: string,
  ): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (!user || !verifyPassword(password, user.password_hash)) {
      // 400, not 401 — see changePassword.
      throw new BadRequestException('Current password is incorrect');
    }
    if (newEmail === user.email) {
      throw new BadRequestException('This is already your email address');
    }
    if (await this.usersService.findByEmail(newEmail)) {
      // Enumeration is acceptable here: the caller is authenticated.
      throw new ConflictException('Email is already registered');
    }

    // null = reissued too soon — stay silent, same contract as resend.
    const token = await this.emailVerificationTokensService.issue(
      userId,
      newEmail,
    );
    if (!token) {
      return;
    }

    const baseUrl =
      this.configService.get<string>('APP_BASE_URL') ?? 'http://localhost:4200';
    const verifyUrl = `${baseUrl}/verify-email?token=${token}`;

    await this.mailService
      .send({
        to: newEmail,
        subject: 'Confirm your new email address',
        text:
          `Confirm this address to use it for your account ` +
          `(link valid for 24 hours):\n${verifyUrl}\n\n` +
          `If you didn't request this, ignore this mail.`,
      })
      .catch((error) =>
        this.logger.error(`Email change mail to ${newEmail} failed`, error),
      );

    // Best-effort heads-up to the old address: if the change wasn't
    // requested by the owner, they can still reset the password.
    await this.mailService
      .send({
        to: user.email,
        subject: 'Your email address is being changed',
        text:
          `A change of this account's email address to ${newEmail} was ` +
          `requested. If this wasn't you, reset your password immediately.`,
      })
      .catch((error) =>
        this.logger.error(`Email change notice to ${user.email} failed`, error),
      );
  }

  // /auth/me reads from the DB (not the JWT) so displayName and future
  // profile fields are always fresh.
  async me(userId: string): Promise<AuthUser> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.toAuthUser(user);
  }

  async updateProfile(userId: string, displayName: string): Promise<AuthUser> {
    // Empty submissions clear the name — the UI falls back to the email.
    await this.usersService.updateDisplayName(
      userId,
      displayName.trim() || null,
    );
    return this.me(userId);
  }

  private toAuthUser(user: {
    id: string;
    email: string;
    role: UserRole;
    display_name: string | null;
  }): AuthUser {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      displayName: user.display_name,
    };
  }

  private async issueTokenPair(user: AuthUser): Promise<LoginResponse> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload),
      this.refreshTokensService.issue(user.id),
    ]);

    return { accessToken, refreshToken: refreshToken.token, user };
  }
}
