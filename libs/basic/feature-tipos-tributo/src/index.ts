import type { Routes } from '@angular/router';

/**
 * Rutas del módulo Tipos de tributo. Se montan bajo el layout privado de la app
 * (`/mantenimiento/tipos-tributo`). El componente es lazy: no entra en el bundle inicial.
 */
export const TIPOS_TRIBUTO_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./lib/tipo-tributo-list/tipo-tributo-list-page').then((m) => m.TipoTributoListPage),
    data: { title: 'Tipos de tributo', breadcrumb: 'Tipos de tributo' },
  },
];
