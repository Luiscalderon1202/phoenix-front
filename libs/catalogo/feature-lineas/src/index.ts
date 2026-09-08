import type { Routes } from '@angular/router';

/**
 * Rutas del módulo Líneas. Se montan bajo el layout privado de la app
 * (`/mantenimiento/lineas`), con `procesoGuard('CAT-LINEA')` en `app.routes.ts`.
 *
 * ⚠ No cuelga del hub de Tablas Básicas: es una opción de menú propia (`basic.menuweb` 71, padre 70 «Catálogo») con su PROPIO
 * proceso de permiso.
 *
 * Es la única pantalla del módulo que combina paginación de servidor con arrastre para
 * reordenar; el `orden` lo hace posible la migración 0009 de Phoenix.
 *
 * El componente es lazy: no entra en el bundle inicial.
 */
export const LINEAS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./lib/linea-list/linea-list-page').then((m) => m.LineaListPage),
    data: { title: 'Líneas', breadcrumb: 'Líneas' },
  },
];
