import type { Routes } from '@angular/router';

/**
 * Rutas del módulo Estados de proceso. Se montan bajo el layout privado de la app
 * (`/mantenimiento/estados-proceso-pedido`). El componente es lazy: no entra en el bundle inicial.
 */
export const ESTADOS_PROCESO_PEDIDO_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./lib/estado-proceso-pedido-list/estado-proceso-pedido-list-page').then((m) => m.EstadoProcesoPedidoListPage),
    data: { title: 'Estados de proceso', breadcrumb: 'Estados de proceso' },
  },
];
