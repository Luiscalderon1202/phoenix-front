import type { Routes } from '@angular/router';

/**
 * Rutas del módulo Tipos de tarjeta. Se montan bajo el layout privado de la app
 * (`/mantenimiento/tipos-tarjeta`). El componente es lazy: no entra en el bundle inicial.
 */
export const TIPOS_TARJETA_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./lib/tipo-tarjeta-list/tipo-tarjeta-list-page').then((m) => m.TipoTarjetaListPage),
    data: { title: 'Tipos de tarjeta', breadcrumb: 'Tipos de tarjeta' },
  },
];
