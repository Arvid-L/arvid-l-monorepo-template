import { Test } from '@nestjs/testing';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

function contextWithAuthHeader(authorization?: string): ExecutionContext {
  const request: Record<string, unknown> = { headers: { authorization } };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let jwtService: JwtService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'test-secret-not-production' })],
      providers: [JwtAuthGuard],
    }).compile();

    guard = module.get(JwtAuthGuard);
    jwtService = module.get(JwtService);
  });

  it('accepts a valid bearer token and attaches the payload', async () => {
    const token = await jwtService.signAsync({ sub: 'user-1', email: 'a@b.c' });
    const context = contextWithAuthHeader(`Bearer ${token}`);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    const request = context.switchToHttp().getRequest();
    expect(request.user).toMatchObject({ sub: 'user-1', email: 'a@b.c' });
  });

  it('rejects a missing authorization header', async () => {
    await expect(
      guard.canActivate(contextWithAuthHeader(undefined)),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an invalid token', async () => {
    await expect(
      guard.canActivate(contextWithAuthHeader('Bearer not.a.token')),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
