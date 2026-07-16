import { TestBed } from '@angular/core/testing';
import { TranslocoService, TranslocoTestingModule } from '@jsverse/transloco';
import en from '../../../../public/i18n/en.json';
import de from '../../../../public/i18n/de.json';
import { TranslocoPaginatorIntl } from './paginator-intl';

describe('TranslocoPaginatorIntl', () => {
  let intl: TranslocoPaginatorIntl;
  let transloco: TranslocoService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        // Both languages preloaded so the language-switch test is synchronous.
        TranslocoTestingModule.forRoot({
          langs: { en, de },
          translocoConfig: { availableLangs: ['en', 'de'], defaultLang: 'en' },
          preloadLangs: true,
        }),
      ],
      providers: [TranslocoPaginatorIntl],
    });
    transloco = TestBed.inject(TranslocoService);
    intl = TestBed.inject(TranslocoPaginatorIntl);
  });

  it('exposes the Material default labels in English', () => {
    expect(intl.itemsPerPageLabel).toBe('Items per page:');
    expect(intl.nextPageLabel).toBe('Next page');
    expect(intl.previousPageLabel).toBe('Previous page');
    expect(intl.firstPageLabel).toBe('First page');
    expect(intl.lastPageLabel).toBe('Last page');
  });

  it('formats the range label exactly like the Material default', () => {
    expect(intl.getRangeLabel(0, 10, 42)).toBe('1 – 10 of 42');
    expect(intl.getRangeLabel(1, 10, 42)).toBe('11 – 20 of 42');
    // Last partial page.
    expect(intl.getRangeLabel(4, 10, 42)).toBe('41 – 42 of 42');
    // Empty list / zero page size.
    expect(intl.getRangeLabel(0, 10, 0)).toBe('0 of 0');
    expect(intl.getRangeLabel(0, 0, 42)).toBe('0 of 42');
    // Start index beyond the list length (Material keeps the raw window).
    expect(intl.getRangeLabel(5, 10, 42)).toBe('51 – 60 of 42');
  });

  it('re-translates labels and emits changes on language switch', () => {
    const emitted = jest.fn();
    intl.changes.subscribe(emitted);

    transloco.setActiveLang('de');

    expect(emitted).toHaveBeenCalled();
    expect(intl.itemsPerPageLabel).toBe('Einträge pro Seite:');
    expect(intl.nextPageLabel).toBe('Nächste Seite');
    expect(intl.previousPageLabel).toBe('Vorherige Seite');
    expect(intl.firstPageLabel).toBe('Erste Seite');
    expect(intl.lastPageLabel).toBe('Letzte Seite');
    expect(intl.getRangeLabel(0, 10, 42)).toBe('1 – 10 von 42');
    expect(intl.getRangeLabel(0, 10, 0)).toBe('0 von 0');
  });
});
