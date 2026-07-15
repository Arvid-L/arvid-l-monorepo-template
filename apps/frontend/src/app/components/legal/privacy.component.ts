import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

// Placeholder page — downstream projects MUST replace the body with their
// real privacy policy (GDPR Art. 13/14). Content lives in
// i18n/{en,de}.json under legal.privacy.
@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="legal-page">
      <h1>{{ 'legal.privacy.title' | transloco }}</h1>
      <p>{{ 'legal.privacy.body' | transloco }}</p>
    </div>
  `,
  styles: `
    .legal-page {
      max-width: 48rem;
      margin: 2rem auto;
      padding: 0 1rem;
    }
  `,
})
export class PrivacyComponent {}
