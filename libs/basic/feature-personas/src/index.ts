import type { Routes } from '@angular/router';

/**
 * Rutas del módulo Personas. Se montan bajo el layout privado de la app
 * (`/mantenimiento/personas`). Los componentes son lazy: no entran en el bundle inicial.
 *
 * El alta y la edición son PÁGINA PROPIA, no un modal, igual que en el legacy: el
 * formulario tiene dos variantes según el tipo de persona y cuatro listas dinámicas
 * —teléfonos, emails, redes y documentos— más los roles. En un modal no cabe.
 *
 * ⚠ `nueva` va ANTES que `:id`: si no, el router resolvería «nueva» como un id.
 */
export const PERSONAS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./lib/persona-list/persona-list-page').then((m) => m.PersonaListPage),
    data: { title: 'Personas', breadcrumb: 'Personas' },
  },
  {
    path: 'nueva',
    loadComponent: () =>
      import('./lib/persona-form/persona-form-page').then((m) => m.PersonaFormPage),
    data: { title: 'Nueva persona', breadcrumb: 'Nueva' },
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./lib/persona-form/persona-form-page').then((m) => m.PersonaFormPage),
    data: { title: 'Editar persona', breadcrumb: 'Editar' },
  },
];
