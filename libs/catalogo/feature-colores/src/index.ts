import type { Routes } from '@angular/router';

/**
 * Rutas del módulo Colores. Se montan bajo el layout privado de la app
 * (`/mantenimiento/colores`), con `procesoGuard('CAT-COLOR')` en `app.routes.ts`.
 *
 * ⚠ No cuelga del hub de Tablas Básicas: es una opción de menú propia (fila nueva, padre 70 «Catálogo») con su PROPIO
 * proceso de permiso.
 *
 * ⚠ Esta pantalla NO TENÍA FILA en `basic.menuweb`: al legacy solo se llega por URL directa o
 * desde el formulario de producto. La fila la crea Phoenix, con el proceso que `Color.php` ya
 * declaraba.
 *
 * El componente es lazy: no entra en el bundle inicial.
 */
export const COLORES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./lib/color-list/color-list-page').then((m) => m.ColorListPage),
    data: { title: 'Colores', breadcrumb: 'Colores' },
  },
];
