import { Route } from '@angular/router';
import { ExampleComponent } from './components/example';
import {
  ForgotPasswordComponent,
  LoginComponent,
  RegisterComponent,
  ResetPasswordComponent,
} from './components/auth';
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
    path: '**',
    redirectTo: ROUTES.EXAMPLES,
  },
];
