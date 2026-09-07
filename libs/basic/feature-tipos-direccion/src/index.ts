import type { Routes } from '@angular/router';

/**
 * Rutas del módulo Tipos de Dirección. Se montan bajo el layout privado de la app
 * (`/mantenimiento/tipos-direccion`). El componente es lazy: no entra en el bundle inicial.
 */
export const TIPOS_DIRECCION_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./lib/tipo-direccion-list/tipo-direccion-list-page').then(
        (m) => m.TipoDireccionListPage,
      ),
    data: { title: 'Tipos de dirección', breadcrumb: 'Tipos de dirección' },
  },
];
