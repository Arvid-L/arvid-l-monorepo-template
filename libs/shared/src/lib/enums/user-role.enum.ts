export enum UserRole {
  ADMIN = 'admin',
  MODERATOR = 'moderator',
  USER = 'user',
}

// Linear hierarchy used by the API's RolesGuard (and reusable in the FE to
// show/hide admin UI): a role grants everything a lower-ranked role can do.
// When adding a new role, insert it here with an appropriate rank.
export const USER_ROLE_RANK: Record<UserRole, number> = {
  [UserRole.ADMIN]: 3,
  [UserRole.MODERATOR]: 2,
  [UserRole.USER]: 1,
};
