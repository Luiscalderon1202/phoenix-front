import type { Routes } from '@angular/router';

/**
 * Rutas del módulo Subcategorías. Se montan bajo el layout privado de la app
 * (`/mantenimiento/subcategorias`). El componente es lazy: no entra en el bundle inicial.
 *
 * La pantalla acepta `?categoriaid=<id>` para llegar preacotada a una categoría: es el enlace
 * padre→hijo que el legacy hace con `SubCategoria.php?categoriaid=<id>` desde el botón `SC` del
 * listado de Categorías.
 */
export const SUBCATEGORIAS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./lib/subcategoria-list/subcategoria-list-page').then((m) => m.SubcategoriaListPage),
    data: { title: 'Subcategorías', breadcrumb: 'Subcategorías' },
  },
];
