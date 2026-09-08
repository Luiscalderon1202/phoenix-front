import type { Routes } from '@angular/router';

/**
 * Rutas de la pantalla de Productos. Se monta bajo el layout privado de la app
 * (`/mantenimiento/productos`), con `procesoGuard('CAT-PRODUCTO')` en `app.routes.ts`.
 *
 * ⚠ Una sola ruta para DOS grillas: productos detallados y masters son las dos pestañas de la
 * misma pantalla del legacy y comparten filtros y permiso. No se parten en dos rutas.
 *
 * ⚠ Su fila de menú NO cuelga del padre 70 («Catalogo») como los diez catálogos, sino del 1.
 *
 * El componente es lazy: no entra en el bundle inicial.
 */
export const PRODUCTOS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./lib/producto-list/producto-list-page').then((m) => m.ProductoListPage),
    data: { title: 'Productos', breadcrumb: 'Productos' },
  },
];
