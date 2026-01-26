import { Route } from '@angular/router';
import { ExampleComponent } from './components/example';
import { ROUTES } from './core/constants/routes.constants';

export const appRoutes: Route[] = [
  {
    path: ROUTES.EXAMPLES,
    component: ExampleComponent,
  },
  {
    path: '**',
    redirectTo: ROUTES.EXAMPLES,
  },
];
