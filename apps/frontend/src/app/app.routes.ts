import { Route } from '@angular/router';
import { ExampleComponent } from './components/example';
import {
  ForgotPasswordComponent,
  LoginComponent,
  RegisterComponent,
  ResetPasswordComponent,
  VerifyEmailComponent,
} from './components/auth';
import { ImprintComponent, PrivacyComponent } from './components/legal';
import { NotFoundComponent } from './components/not-found/not-found.component';
import { SettingsComponent } from './components/settings/settings.component';
import { authGuard } from './core/auth/auth.guard';
import { ROUTES } from './core/constants/routes.constants';

// The example route is public on purpose (template demo). Protect routes
// with canActivate: [authGuard] (core/auth/auth.guard.ts).
export const appRoutes: Route[] = [
  {
    path: ROUTES.EXAMPLES,
    component: ExampleComponent,
  },
  {
    path: ROUTES.LOGIN,
    component: LoginComponent,
  },
  {
    path: ROUTES.REGISTER,
    component: RegisterComponent,
  },
  {
    path: ROUTES.FORGOT_PASSWORD,
    component: ForgotPasswordComponent,
  },
  {
    path: ROUTES.RESET_PASSWORD,
    component: ResetPasswordComponent,
  },
  {
    // Public on purpose — the mail link must work logged-out.
    path: ROUTES.VERIFY_EMAIL,
    component: VerifyEmailComponent,
  },
  {
    path: ROUTES.IMPRINT,
    component: ImprintComponent,
  },
  {
    path: ROUTES.PRIVACY,
    component: PrivacyComponent,
  },
  {
    path: ROUTES.SETTINGS,
    component: SettingsComponent,
    canActivate: [authGuard],
  },
  {
    // The old '**' redirect doubled as the root route — keep '/' working
    // now that '**' renders a real 404.
    path: '',
    redirectTo: ROUTES.EXAMPLES,
    pathMatch: 'full',
  },
  {
    path: '**',
    component: NotFoundComponent,
  },
];
