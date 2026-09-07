import type { Routes } from '@angular/router';

/**
 * Rutas del módulo Tipos de Teléfono. Se montan bajo el layout privado de la app
 * (`/mantenimiento/tipos-telefono`). El componente es lazy: no entra en el bundle inicial.
 */
export const TIPOS_TELEFONO_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./lib/tipo-telefono-list/tipo-telefono-list-page').then(
        (m) => m.TipoTelefonoListPage,
      ),
    data: { title: 'Tipos de teléfono', breadcrumb: 'Tipos de teléfono' },
  },
];
