import { TranslocoTestingModule } from '@jsverse/transloco';
import en from '../../../../public/i18n/en.json';

// Preloads the real English translations synchronously so component specs
// can keep asserting on visible copy. Import into TestBed `imports`.
export const getTranslocoTestingModule = () =>
  TranslocoTestingModule.forRoot({
    langs: { en },
    translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
    preloadLangs: true,
  });
