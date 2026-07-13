import { Test } from '@nestjs/testing';
import { JwtModule } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from './users.service';
import { hashPassword } from './password.util';

describe('AuthService', () => {
  let service: AuthService;
  const findByEmail = jest.fn();

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'test-secret-not-production' })],
      providers: [
        AuthService,
        { provide: UsersService, useValue: { findByEmail } },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  beforeEach(() => findByEmail.mockReset());

  it('returns a token and the user for valid credentials', async () => {
    findByEmail.mockResolvedValue({
      id: 'user-1',
      email: 'admin@example.org',
      password_hash: hashPassword('secret-password'),
    });

    const result = await service.login('admin@example.org', 'secret-password');

    expect(result.accessToken).toEqual(expect.any(String));
    expect(result.accessToken.split('.')).toHaveLength(3);
    expect(result.user).toEqual({ id: 'user-1', email: 'admin@example.org' });
  });

  it('rejects a wrong password', async () => {
    findByEmail.mockResolvedValue({
      id: 'user-1',
      email: 'admin@example.org',
      password_hash: hashPassword('secret-password'),
    });

    await expect(
      service.login('admin@example.org', 'wrong'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an unknown user', async () => {
    findByEmail.mockResolvedValue(undefined);

    await expect(
      service.login('nobody@example.org', 'whatever'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
