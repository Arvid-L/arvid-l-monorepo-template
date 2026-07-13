import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { TokenStorageService } from './token-storage.service';

// Attaches the JWT to every API request when a token is stored.
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(TokenStorageService).token;

  if (!token) {
    return next(req);
  }

  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};
