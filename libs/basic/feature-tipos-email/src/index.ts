import type { Routes } from '@angular/router';

/**
 * Rutas del módulo Tipos de Email. Se montan bajo el layout privado de la app
 * (`/mantenimiento/tipos-email`). El componente es lazy: no entra en el bundle inicial.
 */
export const TIPOS_EMAIL_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./lib/tipo-email-list/tipo-email-list-page').then((m) => m.TipoEmailListPage),
    data: { title: 'Tipos de email', breadcrumb: 'Tipos de email' },
  },
];
