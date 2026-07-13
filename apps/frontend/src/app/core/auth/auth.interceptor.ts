import {
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { TokenStorageService } from './token-storage.service';
import { AuthApiService } from './auth.api.service';

// Endpoints where a 401 must NOT trigger a token refresh (prevents loops
// and pointless retries on failed logins).
const NO_REFRESH_URLS = ['/auth/login', '/auth/refresh', '/auth/logout'];

const withBearer = (
  req: HttpRequest<unknown>,
  token: string,
): HttpRequest<unknown> =>
  req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });

// Attaches the JWT to every request; on 401 it silently refreshes the token
// pair once and retries. Registered AFTER httpErrorInterceptor so the retry
// happens before any error toast fires.
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const tokenStorage = inject(TokenStorageService);
  const authApi = inject(AuthApiService);

  const token = tokenStorage.token;
  const authedReq = token ? withBearer(req, token) : req;

  return next(authedReq).pipe(
    catchError((error: HttpErrorResponse) => {
      const canRefresh =
        error.status === 401 &&
        tokenStorage.refreshToken !== null &&
        !NO_REFRESH_URLS.some((url) => req.url.includes(url));

      if (!canRefresh) {
        return throwError(() => error);
      }

      return authApi.refresh().pipe(
        switchMap((response) => next(withBearer(req, response.accessToken))),
        catchError(() => {
          // Refresh failed — session is over; surface the original 401.
          tokenStorage.clear();
          return throwError(() => error);
        }),
      );
    }),
  );
};
