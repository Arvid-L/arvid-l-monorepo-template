import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

// Placeholder page — downstream projects MUST replace the body with their
// real Impressum (legally required in Germany, § 5 DDG). Content lives in
// i18n/{en,de}.json under legal.imprint.
@Component({
  selector: 'app-imprint',
  standalone: true,
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="legal-page">
      <h1>{{ 'legal.imprint.title' | transloco }}</h1>
      <p>{{ 'legal.imprint.body' | transloco }}</p>
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
export class ImprintComponent {}
