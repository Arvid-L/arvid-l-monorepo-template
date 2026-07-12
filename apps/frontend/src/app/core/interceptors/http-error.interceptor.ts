import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ToastService } from '../services/toast.service';

// Surfaces every failed HTTP call as a toast (the API's ErrorResponse
// carries message as string | string[]) and rethrows so callers can still
// handle errors themselves.
export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      const apiMessage = error.error?.message;
      const message = Array.isArray(apiMessage)
        ? apiMessage.join(', ')
        : apiMessage || `Request failed (${error.status})`;
      toast.error(message);
      return throwError(() => error);
    }),
  );
};
