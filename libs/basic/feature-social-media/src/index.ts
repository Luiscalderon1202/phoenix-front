import type { Routes } from '@angular/router';

/**
 * Rutas del módulo Social media. Se montan bajo el layout privado de la app
 * (`/mantenimiento/social-media`). El componente es lazy: no entra en el bundle inicial.
 */
export const SOCIAL_MEDIA_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./lib/social-media-list/social-media-list-page').then(
        (m) => m.SocialMediaListPage,
      ),
    data: { title: 'Social media', breadcrumb: 'Social media' },
  },
];
