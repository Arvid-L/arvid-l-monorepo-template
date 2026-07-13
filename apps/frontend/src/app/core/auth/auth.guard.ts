import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { TokenStorageService } from './token-storage.service';

// Route guard stub: attach to protected routes via canActivate: [authGuard].
// Adjust the redirect target once the project has a login page.
export const authGuard: CanActivateFn = () => {
  const tokenStorage = inject(TokenStorageService);
  const router = inject(Router);

  return tokenStorage.isLoggedIn ? true : router.parseUrl('/');
};
