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
  const updateDisplayName = jest.fn();
  const updateEmail = jest.fn();
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
    display_name: null,
    disabled_at: null,
    privacy_accepted_at: null,
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
            updateDisplayName,
            updateEmail,
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
        displayName: null,
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

      const result = await service.register({
        email: 'new@example.org',
        password: 'password-123',
        displayName: 'New Person',
        privacyAccepted: true,
      });

      expect(create).toHaveBeenCalledWith({
        email: 'new@example.org',
        passwordHash: expect.stringMatching(/^scrypt\$/),
        displayName: 'New Person',
        privacyAccepted: true,
      });
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
        service.register({
          email: 'taken@example.org',
          password: 'password123',
          privacyAccepted: true,
        }),
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

  describe('me', () => {
    it('returns the fresh user from the DB', async () => {
      findById.mockResolvedValue({ ...storedUser, display_name: 'Arvid' });

      await expect(service.me('user-1')).resolves.toEqual({
        id: 'user-1',
        email: 'admin@example.org',
        role: UserRole.ADMIN,
        displayName: 'Arvid',
      });
    });

    it('rejects unknown users', async () => {
      findById.mockResolvedValue(undefined);

      await expect(service.me('ghost')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('updateProfile', () => {
    it('trims the name and stores null for empty input', async () => {
      findById.mockResolvedValue(storedUser);

      await service.updateProfile('user-1', '   ');

      expect(updateDisplayName).toHaveBeenCalledWith('user-1', null);
    });

    it('stores the trimmed display name and returns the fresh user', async () => {
      findById.mockResolvedValue({ ...storedUser, display_name: 'Arvid' });

      const result = await service.updateProfile('user-1', '  Arvid ');

      expect(updateDisplayName).toHaveBeenCalledWith('user-1', 'Arvid');
      expect(result.displayName).toBe('Arvid');
    });
  });

  describe('changePassword', () => {
    it('rejects a wrong current password with 400 (NOT 401 — the FE interceptor would log the user out)', async () => {
      findById.mockResolvedValue(storedUser);

      await expect(
        service.changePassword('user-1', 'wrong', 'new-password-123'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(updatePassword).not.toHaveBeenCalled();
    });

    it('updates the hash, revokes all sessions and returns a fresh pair', async () => {
      findById.mockResolvedValue(storedUser);

      const result = await service.changePassword(
        'user-1',
        'secret-password',
        'new-password-123',
      );

      expect(updatePassword).toHaveBeenCalledWith(
        'user-1',
        expect.stringMatching(/^scrypt\$/),
      );
      expect(revokeAllForUser).toHaveBeenCalledWith('user-1');
      expect(result.refreshToken).toBe('new-refresh-token');
      expect(result.user.id).toBe('user-1');
    });
  });
});
