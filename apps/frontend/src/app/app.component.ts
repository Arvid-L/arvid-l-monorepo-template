import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from './core/auth/auth.service';
import { LanguageService } from './core/i18n/language.service';
import { ROUTES } from './core/constants/routes.constants';

@Component({
  imports: [RouterModule, MatButtonModule, MatToolbarModule, TranslocoPipe],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class App {
  readonly auth = inject(AuthService);
  readonly language = inject(LanguageService);
  readonly ROUTES = ROUTES;
}
