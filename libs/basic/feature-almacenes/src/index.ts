import type { Routes } from '@angular/router';

/**
 * Rutas del módulo Locales / Tiendas. Se montan bajo el layout privado de la app
 * (`/mantenimiento/almacenes`), con `procesoGuard('ALMACEN')` en `app.routes.ts`.
 *
 * ⚠ La tabla del legacy se llama `basic.almacen` y por eso la ruta y el proceso conservan ese
 * nombre, pero la pantalla habla de LOCALES: la sede física desde la que se vende, no un
 * depósito de mercadería.
 *
 * El componente es lazy: no entra en el bundle inicial.
 */
export const ALMACENES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./lib/almacen-list/almacen-list-page').then((m) => m.AlmacenListPage),
    data: { title: 'Locales / Tiendas', breadcrumb: 'Locales' },
  },
];
