import { inject, Injectable } from '@angular/core';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { TranslocoService } from '@jsverse/transloco';
import { switchMap } from 'rxjs';

// Transloco-backed MatPaginator labels. Provided app-wide in app.config.ts
// ({ provide: MatPaginatorIntl, useClass: TranslocoPaginatorIntl }) so every
// paginated table picks it up. The en values mirror Material's built-in
// defaults byte-for-byte; de adds the missing German.
@Injectable()
export class TranslocoPaginatorIntl extends MatPaginatorIntl {
  private readonly transloco = inject(TranslocoService);

  constructor() {
    super();
    // langChanges$ emits the active language immediately and on every switch;
    // selectTranslation waits until that language's file is actually loaded,
    // so labels never render as raw keys during the initial async load.
    this.transloco.langChanges$
      .pipe(switchMap((lang) => this.transloco.selectTranslation(lang)))
      .subscribe(() => {
        this.itemsPerPageLabel = this.transloco.translate(
          'paginator.itemsPerPage',
        );
        this.nextPageLabel = this.transloco.translate('paginator.nextPage');
        this.previousPageLabel = this.transloco.translate(
          'paginator.previousPage',
        );
        this.firstPageLabel = this.transloco.translate('paginator.firstPage');
        this.lastPageLabel = this.transloco.translate('paginator.lastPage');
        this.changes.next();
      });
  }

  // Same windowing math as Material's default getRangeLabel; only the
  // string assembly goes through transloco.
  override getRangeLabel = (
    page: number,
    pageSize: number,
    length: number,
  ): string => {
    if (length === 0 || pageSize === 0) {
      return this.transloco.translate('paginator.rangeEmpty', {
        total: length,
      });
    }
    const total = Math.max(length, 0);
    const startIndex = page * pageSize;
    const endIndex =
      startIndex < total
        ? Math.min(startIndex + pageSize, total)
        : startIndex + pageSize;
    return this.transloco.translate('paginator.range', {
      start: startIndex + 1,
      end: endIndex,
      total,
    });
  };
}
