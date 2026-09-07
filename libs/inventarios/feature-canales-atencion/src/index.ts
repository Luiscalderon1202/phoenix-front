import type { Routes } from '@angular/router';

/**
 * Rutas del módulo Canales de atención. Se montan bajo el layout privado de la app
 * (`/mantenimiento/canales-atencion`). El componente es lazy: no entra en el bundle inicial.
 */
export const CANALES_ATENCION_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./lib/tipo-canal-list/tipo-canal-list-page').then((m) => m.TipoCanalListPage),
    data: { title: 'Canales de atención', breadcrumb: 'Canales de atención' },
  },
];
