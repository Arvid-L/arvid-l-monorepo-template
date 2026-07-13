import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@arvid-l-monorepo-template/shared';
import { RolesGuard } from './roles.guard';
import { JwtPayload } from './auth.service';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  const getAllAndOverride = jest.fn();

  const contextFor = (user?: JwtPayload): ExecutionContext =>
    ({
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as unknown as ExecutionContext;

  const userWithRole = (role: UserRole): JwtPayload => ({
    sub: 'user-1',
    email: 'someone@example.org',
    role,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    guard = new RolesGuard({ getAllAndOverride } as unknown as Reflector);
  });

  it('passes when no roles are required', () => {
    getAllAndOverride.mockReturnValue(undefined);

    expect(guard.canActivate(contextFor(userWithRole(UserRole.USER)))).toBe(
      true,
    );
  });

  it('passes for an exact role match', () => {
    getAllAndOverride.mockReturnValue([UserRole.MODERATOR]);

    expect(
      guard.canActivate(contextFor(userWithRole(UserRole.MODERATOR))),
    ).toBe(true);
  });

  it('admits higher-ranked roles (hierarchy)', () => {
    getAllAndOverride.mockReturnValue([UserRole.MODERATOR]);

    expect(guard.canActivate(contextFor(userWithRole(UserRole.ADMIN)))).toBe(
      true,
    );
  });

  it('rejects lower-ranked roles', () => {
    getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

    expect(() =>
      guard.canActivate(contextFor(userWithRole(UserRole.MODERATOR))),
    ).toThrow(ForbiddenException);
  });

  it('rejects when no user is on the request (JwtAuthGuard missing)', () => {
    getAllAndOverride.mockReturnValue([UserRole.USER]);

    expect(() => guard.canActivate(contextFor(undefined))).toThrow(
      ForbiddenException,
    );
  });
});
