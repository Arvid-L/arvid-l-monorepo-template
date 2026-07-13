import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  AuthUser,
  LoginResponse,
  UserRole,
} from '@arvid-l-monorepo-template/shared';
import { UsersService } from './users.service';
import { RefreshTokensService } from './refresh-tokens.service';
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
  constructor(
    private readonly usersService: UsersService,
    private readonly refreshTokensService: RefreshTokensService,
    private readonly jwtService: JwtService,
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
