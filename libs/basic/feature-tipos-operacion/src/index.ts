import type { Routes } from '@angular/router';

/**
 * Rutas del módulo Tipos de operación. Se montan bajo el layout privado de la app
 * (`/mantenimiento/tipos-operacion`). El componente es lazy: no entra en el bundle inicial.
 */
export const TIPOS_OPERACION_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./lib/tipo-operacion-list/tipo-operacion-list-page').then((m) => m.TipoOperacionListPage),
    data: { title: 'Tipos de operación', breadcrumb: 'Tipos de operación' },
  },
];
