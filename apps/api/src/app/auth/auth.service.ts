import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  AuthUser,
  LoginResponse,
  UserRole,
} from '@arvid-l-monorepo-template/shared';
import { MailService } from '../mail/mail.service';
import { UsersService } from './users.service';
import { RefreshTokensService } from './refresh-tokens.service';
import { PasswordResetTokensService } from './password-reset-tokens.service';
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
    private readonly mailService: MailService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(email: string, password: string): Promise<LoginResponse> {
    const user = await this.usersService.findByEmail(email);

    if (!user || !verifyPassword(password, user.password_hash)) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.issueTokenPair({
      id: user.id,
      email: user.email,
      role: user.role,
    });
  }

  // Open registration — every new account gets the USER role; admins and
  // moderators are promoted via `npm run user:create -- <email> <pw> <role>`
  // or a future admin UI.
  async register(email: string, password: string): Promise<LoginResponse> {
    try {
      const user = await this.usersService.create(
        email,
        hashPassword(password),
      );
      return await this.issueTokenPair({
        id: user.id,
        email: user.email,
        role: user.role,
      });
    } catch (error) {
      // Race-safe duplicate check: rely on the unique index instead of a
      // separate SELECT beforehand.
      if (isUniqueViolation(error)) {
        throw new ConflictException('Email is already registered');
      }
      throw error;
    }
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
    return this.issueTokenPair({
      id: user.id,
      email: user.email,
      role: user.role,
    });
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
