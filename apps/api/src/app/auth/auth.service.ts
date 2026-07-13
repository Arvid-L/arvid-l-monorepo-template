import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { LoginResponse } from '@arvid-l-monorepo-template/shared';
import { UsersService } from './users.service';
import { verifyPassword } from './password.util';

export interface JwtPayload {
  sub: string;
  email: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, password: string): Promise<LoginResponse> {
    const user = await this.usersService.findByEmail(email);

    if (!user || !verifyPassword(password, user.password_hash)) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: JwtPayload = { sub: user.id, email: user.email };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: { id: user.id, email: user.email },
    };
  }
}
