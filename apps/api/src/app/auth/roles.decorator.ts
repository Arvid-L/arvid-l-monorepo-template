import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@arvid-l-monorepo-template/shared';

export const ROLES_KEY = 'roles';

// Usage (must be combined with JwtAuthGuard, which populates request.user):
//   @UseGuards(JwtAuthGuard, RolesGuard)
//   @Roles(UserRole.MODERATOR)
// Roles are hierarchical (see USER_ROLE_RANK): requiring MODERATOR also
// admits ADMIN. Listing several roles admits the lowest-ranked one and up.
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
