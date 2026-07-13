import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ROUTES } from '../constants/routes.constants';
import { TokenStorageService } from './token-storage.service';

// Attach to protected routes via canActivate: [authGuard]. Checks token
// presence only (fast, synchronous) — an expired token still 401s on the
// first API call and goes through the interceptor's silent refresh.
export const authGuard: CanActivateFn = (_route, state) => {
  const tokenStorage = inject(TokenStorageService);
  const router = inject(Router);

  return tokenStorage.isLoggedIn
    ? true
    : router.createUrlTree([ROUTES.LOGIN], {
        queryParams: { returnUrl: state.url },
      });
};
