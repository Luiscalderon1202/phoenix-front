import type { Routes } from '@angular/router';

/**
 * Rutas del módulo Tipos de consumo. Se montan bajo el layout privado de la app
 * (`/mantenimiento/tipos-consumo`). El componente es lazy: no entra en el bundle inicial.
 */
export const TIPOS_CONSUMO_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./lib/tipo-consumo-list/tipo-consumo-list-page').then((m) => m.TipoConsumoListPage),
    data: { title: 'Tipos de consumo', breadcrumb: 'Tipos de consumo' },
  },
];
