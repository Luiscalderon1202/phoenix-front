import type { Routes } from '@angular/router';

/**
 * Rutas del módulo Unidad Base. Se montan bajo el layout privado de la app
 * (`/mantenimiento/unidades-base`). El componente es lazy: no entra en el bundle inicial.
 *
 * ⚠ Su `procesoGuard` en `app.routes.ts` es `CAT-UNIDAD` (de `Unidad.php:9`), **no**
 * `CAT-UNIDAD-MEDIDA` ni `TABLAS-BASICAS`: esta pantalla no cuelga del hub de tablas básicas,
 * es una opción de menú propia (`basic.menuweb` 92) con su propio permiso.
 */
export const UNIDADES_BASE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./lib/unidad-list/unidad-list-page').then((m) => m.UnidadListPage),
    data: { title: 'Unidades base', breadcrumb: 'Unidades base' },
  },
];
