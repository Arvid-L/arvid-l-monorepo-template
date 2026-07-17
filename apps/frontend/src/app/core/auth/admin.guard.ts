import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UserRole } from '@arvid-l-monorepo-template/shared';
import { ROUTES } from '../constants/routes.constants';
import { TokenStorageService } from './token-storage.service';

// Reads the role straight from the stored JWT (synchronous — no race with
// the async /auth/me session restore). UI-gating only; the API enforces.
export const adminGuard: CanActivateFn = (_route, state) => {
  const tokenStorage = inject(TokenStorageService);
  const router = inject(Router);

  if (!tokenStorage.isLoggedIn) {
    return router.createUrlTree([ROUTES.LOGIN], {
      queryParams: { returnUrl: state.url },
    });
  }
  return tokenStorage.role === UserRole.ADMIN
    ? true
    : router.createUrlTree(['/']);
};
