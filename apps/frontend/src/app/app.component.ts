import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { AuthService } from './core/auth/auth.service';
import { ROUTES } from './core/constants/routes.constants';

@Component({
  imports: [RouterModule, MatButtonModule, MatToolbarModule],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class App {
  readonly auth = inject(AuthService);
  readonly ROUTES = ROUTES;
}
