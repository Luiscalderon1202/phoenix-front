import type { Routes } from '@angular/router';

/**
 * Rutas del módulo Tipos de movimiento de caja. Se montan bajo el layout privado de la app
 * (`/mantenimiento/tipos-movimiento-caja`). El componente es lazy.
 *
 * ⚠ Su `procesoGuard` en `app.routes.ts` NO es TABLAS-BASICAS sino TIPMOVCAJA: esta pantalla
 * cuelga del mismo hub que las otras cuatro de tesorería pero tiene permiso propio, igual que
 * en el legacy.
 */
export const TIPOS_MOVIMIENTO_CAJA_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./lib/tipmovcaja-list/tipmovcaja-list-page').then((m) => m.TipMovCajaListPage),
    data: { title: 'Tipos de movimiento de caja', breadcrumb: 'Tipos de movimiento de caja' },
  },
];
