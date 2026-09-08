import type { Routes } from '@angular/router';

/**
 * Rutas del módulo Unidades de medida. Se montan bajo el layout privado de la app
 * (`/mantenimiento/unidades-medida`), con `procesoGuard('CAT-UNIDAD-MEDIDA')` en `app.routes.ts`.
 * El componente es lazy: no entra en el bundle inicial.
 */
export const UNIDADES_MEDIDA_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./lib/unidad-medida-list/unidad-medida-list-page').then(
        (m) => m.UnidadMedidaListPage,
      ),
    data: { title: 'Unidades de medida', breadcrumb: 'Unidades de medida' },
  },
];
