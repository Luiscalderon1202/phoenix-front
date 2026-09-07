import type { Routes } from '@angular/router';

/**
 * Rutas del módulo Tipos de forma de pago. Se montan bajo el layout privado de la app
 * (`/mantenimiento/tipos-forma-pago`). El componente es lazy: no entra en el bundle inicial.
 */
export const TIPOS_FORMA_PAGO_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./lib/tipo-forma-pago-list/tipo-forma-pago-list-page').then((m) => m.TipoFormaPagoListPage),
    data: { title: 'Tipos de forma de pago', breadcrumb: 'Tipos de forma de pago' },
  },
];
