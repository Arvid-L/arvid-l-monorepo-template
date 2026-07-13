import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthUser, LoginResponse } from '@arvid-l-monorepo-template/shared';
import { UsersService } from './users.service';
import { RefreshTokensService } from './refresh-tokens.service';
import { verifyPassword } from './password.util';

export interface JwtPayload {
  sub: string;
  email: string;
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

    return this.issueTokenPair({ id: user.id, email: user.email });
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
    return this.issueTokenPair({ id: user.id, email: user.email });
  }

  async logout(refreshToken: string): Promise<void> {
    const stored = await this.refreshTokensService.findValid(refreshToken);
    if (stored) {
      await this.refreshTokensService.revoke(stored.id);
    }
  }

  private async issueTokenPair(user: AuthUser): Promise<LoginResponse> {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload),
      this.refreshTokensService.issue(user.id),
    ]);

    return { accessToken, refreshToken: refreshToken.token, user };
  }
}
