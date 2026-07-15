import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink, MatButtonModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="not-found-page">
      <h1>{{ 'notFound.title' | transloco }}</h1>
      <p>{{ 'notFound.body' | transloco }}</p>
      <a mat-raised-button color="primary" [routerLink]="['/']">
        {{ 'notFound.home' | transloco }}
      </a>
    </div>
  `,
  styles: `
    .not-found-page {
      text-align: center;
      margin-top: 4rem;
    }
  `,
})
export class NotFoundComponent {}
