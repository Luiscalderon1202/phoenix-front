import type { Routes } from '@angular/router';

/**
 * Rutas del módulo Motivos de anulación. Se montan bajo el layout privado de la app
 * (`/mantenimiento/motivos-anulacion`). El componente es lazy: no entra en el bundle inicial.
 */
export const MOTIVOS_ANULACION_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./lib/motivo-anulacion-list/motivo-anulacion-list-page').then((m) => m.MotivoAnulacionListPage),
    data: { title: 'Motivos de anulación', breadcrumb: 'Motivos de anulación' },
  },
];
