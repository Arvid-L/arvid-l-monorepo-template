import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from './auth.service';

// Usage: myEndpoint(@CurrentUser() user: JwtPayload) — requires JwtAuthGuard.
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): JwtPayload | undefined =>
    context.switchToHttp().getRequest().user,
);
