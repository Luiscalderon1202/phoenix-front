import type { Routes } from '@angular/router';

/**
 * Rutas del módulo Marcas. Se montan bajo el layout privado de la app
 * (`/mantenimiento/marcas`), con `procesoGuard('CAT-MARCA')` en `app.routes.ts`.
 *
 * ⚠ No cuelga del hub de Tablas Básicas: es una opción de menú propia (`basic.menuweb` 73,
 * padre 70 «Catálogo») con su PROPIO proceso de permiso.
 *
 * El componente es lazy: no entra en el bundle inicial.
 */
export const MARCAS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./lib/marca-list/marca-list-page').then((m) => m.MarcaListPage),
    data: { title: 'Marcas', breadcrumb: 'Marcas' },
  },
];
