import type { Routes } from '@angular/router';

/**
 * Rutas del módulo Tipos de descuento. Se montan bajo el layout privado de la app
 * (`/mantenimiento/tipos-descuento`). El componente es lazy: no entra en el bundle inicial.
 */
export const TIPOS_DESCUENTO_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./lib/tipo-descuento-list/tipo-descuento-list-page').then((m) => m.TipoDescuentoListPage),
    data: { title: 'Tipos de descuento', breadcrumb: 'Tipos de descuento' },
  },
];
