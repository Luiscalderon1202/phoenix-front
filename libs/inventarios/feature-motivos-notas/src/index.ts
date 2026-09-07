import type { Routes } from '@angular/router';

/**
 * Rutas del módulo Motivos de notas. Se montan bajo el layout privado de la app
 * (`/mantenimiento/motivos-notas`). El componente es lazy: no entra en el bundle inicial.
 */
export const MOTIVOS_NOTAS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./lib/motivo-notas-list/motivo-notas-list-page').then((m) => m.MotivoNotasListPage),
    data: { title: 'Motivos de notas', breadcrumb: 'Motivos de notas' },
  },
];
