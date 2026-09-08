import type { Routes } from '@angular/router';

/**
 * Rutas del módulo Grupos. Se montan bajo el layout privado de la app
 * (`/mantenimiento/grupos`), con `procesoGuard('CAT-GRUPO')` en `app.routes.ts`.
 *
 * ⚠ No cuelga del hub de Tablas Básicas: es una opción de menú propia (`basic.menuweb` 81, padre 70 «Catálogo») con su PROPIO
 * proceso de permiso.
 *
 * Su reordenamiento lo arregla la migración 0009: la función del legacy numera siempre desde 1
 * y no acepta un tramo.
 *
 * El componente es lazy: no entra en el bundle inicial.
 */
export const GRUPOS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./lib/grupo-list/grupo-list-page').then((m) => m.GrupoListPage),
    data: { title: 'Grupos', breadcrumb: 'Grupos' },
  },
];
