import type { Routes } from '@angular/router';

/**
 * Rutas del módulo Condiciones de pago. Se montan bajo el layout privado de la app
 * (`/mantenimiento/condiciones-pago`). El componente es lazy: no entra en el bundle inicial.
 */
export const CONDICIONES_PAGO_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./lib/condicion-pago-list/condicion-pago-list-page').then((m) => m.CondicionPagoListPage),
    data: { title: 'Condiciones de pago', breadcrumb: 'Condiciones de pago' },
  },
];
