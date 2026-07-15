import { inject, Injectable, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

const LANG_KEY = 'lang';
type Lang = 'en' | 'de';

// Owns the active language: persists the choice and keeps a signal the
// toolbar toggle can render. Components never talk to TranslocoService
// directly for switching.
@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly transloco = inject(TranslocoService);
  readonly active = signal<Lang>('en');

  // Called once at app start (provideAppInitializer in app.config.ts).
  init(): void {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'en' || saved === 'de') {
      this.set(saved);
    }
  }

  set(lang: Lang): void {
    localStorage.setItem(LANG_KEY, lang);
    this.transloco.setActiveLang(lang);
    this.active.set(lang);
  }

  toggle(): void {
    this.set(this.active() === 'en' ? 'de' : 'en');
  }
}
