import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthUser, LoginResponse } from '@arvid-l-monorepo-template/shared';
import { AuthService, JwtPayload } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';

// Credential endpoints get a strict rate limit on top of the global one
// (brute-force protection).
const CREDENTIAL_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle(CREDENTIAL_THROTTLE)
  async login(@Body() loginDto: LoginDto): Promise<LoginResponse> {
    return this.authService.login(loginDto.email, loginDto.password);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle(CREDENTIAL_THROTTLE)
  async refresh(@Body() refreshDto: RefreshDto): Promise<LoginResponse> {
    return this.authService.refresh(refreshDto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() refreshDto: RefreshDto): Promise<void> {
    await this.authService.logout(refreshDto.refreshToken);
  }

  // Protected example — the pattern to copy for any secured endpoint.
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: JwtPayload): AuthUser {
    return { id: user.sub, email: user.email };
  }
}
