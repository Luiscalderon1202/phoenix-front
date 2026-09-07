import type { Routes } from '@angular/router';

/**
 * Rutas del módulo Tipos de Empresa. Se montan bajo el layout privado de la app
 * (`/mantenimiento/tipos-empresa`). El componente es lazy: no entra en el bundle inicial.
 */
export const TIPOS_EMPRESA_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./lib/tipo-empresa-list/tipo-empresa-list-page').then(
        (m) => m.TipoEmpresaListPage,
      ),
    data: { title: 'Tipos de empresa', breadcrumb: 'Tipos de empresa' },
  },
];
