import { Routes } from '@angular/router';

/** Every feature route is lazily loaded. */
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Blue Eclipse · Dashboard',
    loadComponent: () =>
      import('./features/dashboard/dashboard').then((m) => m.Dashboard),
  },
  {
    path: 'test',
    title: 'Blue Eclipse · Test',
    loadComponent: () => import('./features/test/test').then((m) => m.Test),
  },
  {
    path: 'results/:testId',
    title: 'Blue Eclipse · Results',
    loadComponent: () =>
      import('./features/results/results').then((m) => m.Results),
  },
  {
    path: 'browse',
    title: 'Blue Eclipse · Browse',
    loadComponent: () => import('./features/browse/browse').then((m) => m.Browse),
  },
  {
    path: 'settings',
    title: 'Blue Eclipse · Settings',
    loadComponent: () =>
      import('./features/settings/settings').then((m) => m.Settings),
  },
  { path: '**', redirectTo: '' },
];
