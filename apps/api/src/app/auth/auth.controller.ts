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
import {
  AuthUser,
  LoginResponse,
  RegisterResponse,
  UserRole,
} from '@arvid-l-monorepo-template/shared';
import { AuthService, JwtPayload } from './auth.service';
import { UsersService } from './users.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';
import { CurrentUser } from './current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshDto } from './dto/refresh.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';

// Credential endpoints get a strict rate limit on top of the global one
// (brute-force protection).
const CREDENTIAL_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Post('register')
  @Throttle(CREDENTIAL_THROTTLE)
  async register(@Body() registerDto: RegisterDto): Promise<RegisterResponse> {
    return this.authService.register(registerDto.email, registerDto.password);
  }

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

  // Always 204, whether or not the email exists (no account enumeration).
  @Post('forgot-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle(CREDENTIAL_THROTTLE)
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<void> {
    await this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle(CREDENTIAL_THROTTLE)
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    await this.authService.resetPassword(dto.token, dto.password);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @Throttle(CREDENTIAL_THROTTLE)
  async verifyEmail(@Body() dto: VerifyEmailDto): Promise<LoginResponse> {
    return this.authService.verifyEmail(dto.token);
  }

  // Always 204, whether or not the email exists (no account enumeration).
  @Post('resend-verification')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle(CREDENTIAL_THROTTLE)
  async resendVerification(@Body() dto: ResendVerificationDto): Promise<void> {
    await this.authService.resendVerification(dto.email);
  }

  // Protected example — the pattern to copy for any secured endpoint.
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: JwtPayload): AuthUser {
    return { id: user.sub, email: user.email, role: user.role };
  }

  // Role-protected example — the pattern to copy for admin endpoints.
  // Roles are hierarchical: @Roles(UserRole.MODERATOR) would admit admins too.
  @Get('users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  users(): Promise<AuthUser[]> {
    return this.usersService.listAll();
  }
}
