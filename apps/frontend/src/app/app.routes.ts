import { Route } from '@angular/router';
import { TemplateComponent } from './components/template/template.component';

export const appRoutes: Route[] = [
  {
    path: '',
    component: TemplateComponent,
  },
  {
    path: '**',
    redirectTo: '',
  },
];
