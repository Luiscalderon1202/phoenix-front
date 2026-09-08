import type { Routes } from '@angular/router';

/**
 * Rutas del módulo Categorías. Se montan bajo el layout privado de la app
 * (`/mantenimiento/categorias`) con `procesoGuard('CAT-CATEGORIA')`, su proceso PROPIO: esta
 * pantalla no cuelga del hub de Tablas Básicas. El componente es lazy: no entra en el bundle
 * inicial.
 */
export const CATEGORIAS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./lib/categoria-list/categoria-list-page').then((m) => m.CategoriaListPage),
    data: { title: 'Categorías', breadcrumb: 'Categorías' },
  },
];
