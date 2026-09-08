import type { Routes } from '@angular/router';

/**
 * Rutas del módulo Tallas. Se montan bajo el layout privado de la app
 * (`/mantenimiento/tallas`), con `procesoGuard('CAT-TALLA')` en `app.routes.ts`.
 *
 * ⚠ No cuelga del hub de Tablas Básicas: es una opción de menú propia (fila nueva, padre 70 «Catálogo») con su PROPIO
 * proceso de permiso.
 *
 * ⚠ Esta pantalla NO TENÍA FILA en `basic.menuweb`: al legacy solo se llega por URL directa o
 * desde el formulario de producto. La fila la crea Phoenix, con el proceso que `Talla.php` ya
 * declaraba.
 *
 * El componente es lazy: no entra en el bundle inicial.
 */
export const TALLAS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./lib/talla-list/talla-list-page').then((m) => m.TallaListPage),
    data: { title: 'Tallas', breadcrumb: 'Tallas' },
  },
];
