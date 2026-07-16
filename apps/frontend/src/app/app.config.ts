import {
  ApplicationConfig,
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { provideRouter } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { appRoutes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { httpErrorInterceptor } from './core/interceptors/http-error.interceptor';
import { TranslocoHttpLoader } from './core/i18n/transloco-loader';
import { LanguageService } from './core/i18n/language.service';
import { TranslocoPaginatorIntl } from './core/i18n/paginator-intl';

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
    provideTransloco({
      config: {
        availableLangs: ['en', 'de'],
        defaultLang: 'en',
        fallbackLang: 'en',
        missingHandler: { useFallbackTranslation: true },
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
      },
      loader: TranslocoHttpLoader,
    }),
    provideAppInitializer(() => inject(LanguageService).init()),
    // Translated MatPaginator labels for every paginated table.
    { provide: MatPaginatorIntl, useClass: TranslocoPaginatorIntl },
  ],
};
