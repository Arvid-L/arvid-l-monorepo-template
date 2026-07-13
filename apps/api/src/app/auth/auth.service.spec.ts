import { Test } from '@nestjs/testing';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { UserRole } from '@arvid-l-monorepo-template/shared';
import { AuthService } from './auth.service';
import { UsersService } from './users.service';
import { RefreshTokensService } from './refresh-tokens.service';
import { PasswordResetTokensService } from './password-reset-tokens.service';
import { EmailVerificationTokensService } from './email-verification-tokens.service';
import { MailService } from '../mail/mail.service';
import { hashPassword, verifyPassword } from './password.util';

describe('AuthService', () => {
  let service: AuthService;
  const findByEmail = jest.fn();
  const findById = jest.fn();
  const create = jest.fn();
  const updatePassword = jest.fn();
  const markEmailVerified = jest.fn();
  const issue = jest.fn();
  const findValid = jest.fn();
  const revoke = jest.fn();
  const revokeAllForUser = jest.fn();
  const issueReset = jest.fn();
  const findValidReset = jest.fn();
  const markUsed = jest.fn();
  const issueVerification = jest.fn();
  const findValidVerification = jest.fn();
  const markUsedVerification = jest.fn();
  const sendMail = jest.fn();

  const storedUser = {
    id: 'user-1',
    email: 'admin@example.org',
    password_hash: hashPassword('secret-password'),
    role: UserRole.ADMIN,
    email_verified_at: new Date().toISOString(),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'test-secret-not-production' })],
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            findByEmail,
            findById,
            create,
            updatePassword,
            markEmailVerified,
          },
        },
        {
          provide: RefreshTokensService,
          useValue: { issue, findValid, revoke, revokeAllForUser },
        },
        {
          provide: PasswordResetTokensService,
          useValue: {
            issue: issueReset,
            findValid: findValidReset,
            markUsed,
          },
        },
        {
          provide: EmailVerificationTokensService,
          useValue: {
            issue: issueVerification,
            findValid: findValidVerification,
            markUsed: markUsedVerification,
          },
        },
        { provide: MailService, useValue: { send: sendMail } },
        { provide: ConfigService, useValue: { get: () => undefined } },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  beforeEach(() => {
    jest.resetAllMocks();
    issue.mockResolvedValue({ token: 'new-refresh-token' });
  });

  describe('login', () => {
    it('returns a token pair and the user for valid credentials', async () => {
      findByEmail.mockResolvedValue(storedUser);

      const result = await service.login(
        'admin@example.org',
        'secret-password',
      );

      expect(result.accessToken.split('.')).toHaveLength(3);
      expect(result.refreshToken).toBe('new-refresh-token');
      expect(result.user).toEqual({
        id: 'user-1',
        email: 'admin@example.org',
        role: UserRole.ADMIN,
      });
    });

    it('rejects a wrong password', async () => {
      findByEmail.mockResolvedValue(storedUser);

      await expect(
        service.login('admin@example.org', 'wrong'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(issue).not.toHaveBeenCalled();
    });

    it('rejects an unknown user', async () => {
      findByEmail.mockResolvedValue(undefined);

      await expect(
        service.login('nobody@example.org', 'whatever'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects unverified users with EMAIL_NOT_VERIFIED', async () => {
      findByEmail.mockResolvedValue({ ...storedUser, email_verified_at: null });

      await expect(
        service.login('admin@example.org', 'secret-password'),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ errorCode: 'EMAIL_NOT_VERIFIED' }),
      });
      expect(issue).not.toHaveBeenCalled();
    });
  });

  describe('register', () => {
    it('creates the user unverified, sends a verification mail, returns no tokens', async () => {
      create.mockResolvedValue({ ...storedUser, email_verified_at: null });
      issueVerification.mockResolvedValue('raw-verification-token');
      sendMail.mockResolvedValue(undefined);

      const result = await service.register('new@example.org', 'password-123');

      expect(create).toHaveBeenCalledWith(
        'new@example.org',
        expect.stringMatching(/^scrypt\$/),
      );
      expect(result).toEqual({ message: expect.any(String) });
      expect(issueVerification).toHaveBeenCalledWith(storedUser.id);
      expect(sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: storedUser.email,
          subject: expect.stringContaining('Verify'),
          text: expect.stringContaining(
            '/verify-email?token=raw-verification-token',
          ),
        }),
      );
      expect(issue).not.toHaveBeenCalled(); // no refresh token pair
    });

    it('maps a duplicate email (unique violation) to 409', async () => {
      create.mockRejectedValue(
        Object.assign(new Error('dup'), {
          code: '23505',
        }),
      );

      await expect(
        service.register('taken@example.org', 'password123'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(issue).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('rotates the token: revokes the used one and issues a new pair', async () => {
      findValid.mockResolvedValue({ id: 'rt-1', user_id: 'user-1' });
      findById.mockResolvedValue(storedUser);

      const result = await service.refresh('old-refresh-token');

      expect(revoke).toHaveBeenCalledWith('rt-1');
      expect(issue).toHaveBeenCalledWith('user-1');
      expect(result.refreshToken).toBe('new-refresh-token');
      expect(result.accessToken.split('.')).toHaveLength(3);
    });

    it('rejects an invalid, expired or revoked token', async () => {
      findValid.mockResolvedValue(undefined);

      await expect(service.refresh('bad-token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(revoke).not.toHaveBeenCalled();
    });

    it('rejects when the user behind the token is gone', async () => {
      findValid.mockResolvedValue({ id: 'rt-1', user_id: 'user-1' });
      findById.mockResolvedValue(undefined);

      await expect(service.refresh('orphaned')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(revoke).not.toHaveBeenCalled();
    });
  });

  describe('forgotPassword', () => {
    it('issues a token and mails a reset link for a known email', async () => {
      findByEmail.mockResolvedValue(storedUser);
      issueReset.mockResolvedValue('reset-token-123');
      sendMail.mockResolvedValue(undefined);

      await service.forgotPassword('admin@example.org');

      expect(issueReset).toHaveBeenCalledWith('user-1');
      expect(sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'admin@example.org',
          text: expect.stringContaining(
            '/reset-password?token=reset-token-123',
          ),
        }),
      );
    });

    it('resolves silently for unknown emails (no enumeration)', async () => {
      findByEmail.mockResolvedValue(undefined);

      await expect(
        service.forgotPassword('nobody@example.org'),
      ).resolves.toBeUndefined();
      expect(issueReset).not.toHaveBeenCalled();
      expect(sendMail).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('updates the password, burns the token, revokes all sessions', async () => {
      findValidReset.mockResolvedValue({ id: 'prt-1', user_id: 'user-1' });

      await service.resetPassword('valid-token', 'new-password-123');

      const [userId, newHash] = updatePassword.mock.calls[0];
      expect(userId).toBe('user-1');
      expect(verifyPassword('new-password-123', newHash)).toBe(true);
      expect(markUsed).toHaveBeenCalledWith('prt-1');
      expect(revokeAllForUser).toHaveBeenCalledWith('user-1');
    });

    it('rejects invalid, expired or used tokens', async () => {
      findValidReset.mockResolvedValue(undefined);

      await expect(
        service.resetPassword('bad-token', 'new-password-123'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(updatePassword).not.toHaveBeenCalled();
      expect(revokeAllForUser).not.toHaveBeenCalled();
    });
  });

  describe('verifyEmail', () => {
    it('marks user verified, consumes the token, returns a login response', async () => {
      findValidVerification.mockResolvedValue({
        id: 'evt-1',
        user_id: storedUser.id,
      });
      findById.mockResolvedValue(storedUser);

      const result = await service.verifyEmail('raw-token');

      expect(markEmailVerified).toHaveBeenCalledWith(storedUser.id);
      expect(markUsedVerification).toHaveBeenCalledWith('evt-1');
      expect(result.user.email).toBe(storedUser.email);
      expect(result.accessToken).toBeDefined();
    });

    it('rejects an invalid token', async () => {
      findValidVerification.mockResolvedValue(undefined);
      await expect(service.verifyEmail('bad')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('resendVerification', () => {
    it('resolves silently for unknown emails', async () => {
      findByEmail.mockResolvedValue(undefined);
      await expect(
        service.resendVerification('ghost@example.org'),
      ).resolves.toBeUndefined();
      expect(issueVerification).not.toHaveBeenCalled();
    });

    it('resolves silently for already-verified users', async () => {
      findByEmail.mockResolvedValue(storedUser); // has email_verified_at
      await service.resendVerification(storedUser.email);
      expect(issueVerification).not.toHaveBeenCalled();
    });

    it('reissues and mails for unverified users', async () => {
      findByEmail.mockResolvedValue({ ...storedUser, email_verified_at: null });
      issueVerification.mockResolvedValue('fresh-token');
      sendMail.mockResolvedValue(undefined);

      await service.resendVerification(storedUser.email);

      expect(sendMail).toHaveBeenCalledWith(
        expect.objectContaining({ to: storedUser.email }),
      );
    });

    it('skips the mail when rate-limited (issue returns null)', async () => {
      findByEmail.mockResolvedValue({ ...storedUser, email_verified_at: null });
      issueVerification.mockResolvedValue(null);

      await service.resendVerification(storedUser.email);

      expect(sendMail).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('revokes a valid refresh token', async () => {
      findValid.mockResolvedValue({ id: 'rt-1', user_id: 'user-1' });

      await service.logout('valid-token');

      expect(revoke).toHaveBeenCalledWith('rt-1');
    });

    it('is a no-op for unknown tokens', async () => {
      findValid.mockResolvedValue(undefined);

      await service.logout('unknown-token');

      expect(revoke).not.toHaveBeenCalled();
    });
  });
});
