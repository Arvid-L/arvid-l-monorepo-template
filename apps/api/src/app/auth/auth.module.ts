import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MailModule } from '../mail/mail.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersService } from './users.service';
import { RefreshTokensService } from './refresh-tokens.service';
import { PasswordResetTokensService } from './password-reset-tokens.service';
import { EmailVerificationTokensService } from './email-verification-tokens.service';
import { TokenCleanupService } from './token-cleanup.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';

@Module({
  imports: [
    MailModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        // Access tokens are short-lived; clients stay logged in via the
        // rotating refresh token (POST /auth/refresh).
        signOptions: { expiresIn: config.get('JWT_EXPIRES_IN') ?? '15m' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    UsersService,
    RefreshTokensService,
    PasswordResetTokensService,
    EmailVerificationTokensService,
    TokenCleanupService,
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [JwtAuthGuard, RolesGuard, JwtModule],
})
export class AuthModule {}
