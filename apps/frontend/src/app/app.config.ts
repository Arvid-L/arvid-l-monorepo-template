import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { appRoutes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { httpErrorInterceptor } from './core/interceptors/http-error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes),
    // Order matters: on response errors the chain unwinds inside-out, so
    // authInterceptor (last) retries 401s with a refreshed token before
    // httpErrorInterceptor (first) would toast them.
    provideHttpClient(
      withInterceptors([httpErrorInterceptor, authInterceptor]),
    ),
  ],
};
