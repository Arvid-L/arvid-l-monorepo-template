import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole, USER_ROLE_RANK } from '@arvid-l-monorepo-template/shared';
import { JwtPayload } from './auth.service';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required?.length) {
      return true;
    }

    const user = context
      .switchToHttp()
      .getRequest<{ user?: JwtPayload }>().user;

    // No user on the request means JwtAuthGuard did not run before this
    // guard — a wiring mistake, not a role problem.
    if (!user) {
      throw new ForbiddenException(
        'RolesGuard requires JwtAuthGuard to run first',
      );
    }

    const userRank = USER_ROLE_RANK[user.role] ?? 0;
    const requiredRank = Math.min(...required.map((r) => USER_ROLE_RANK[r]));

    if (userRank < requiredRank) {
      throw new ForbiddenException('Insufficient role');
    }

    return true;
  }
}
