import type { Routes } from '@angular/router';

/**
 * Rutas del módulo Personas. Se montan bajo el layout privado de la app
 * (`/mantenimiento/personas`). El componente es lazy: la pantalla no entra en el
 * bundle inicial.
 */
export const PERSONAS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./lib/persona-list/persona-list-page').then((m) => m.PersonaListPage),
    data: { title: 'Personas', breadcrumb: 'Personas' },
  },
];
