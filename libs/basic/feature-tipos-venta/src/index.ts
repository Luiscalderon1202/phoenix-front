import type { Routes } from '@angular/router';

/**
 * Rutas del módulo Tipos de venta. Se montan bajo el layout privado de la app
 * (`/mantenimiento/tipos-venta`). El componente es lazy: no entra en el bundle inicial.
 */
export const TIPOS_VENTA_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./lib/tipo-venta-list/tipo-venta-list-page').then((m) => m.TipoVentaListPage),
    data: { title: 'Tipos de venta', breadcrumb: 'Tipos de venta' },
  },
];
