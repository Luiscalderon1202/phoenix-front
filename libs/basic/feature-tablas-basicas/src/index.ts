import type { Routes } from '@angular/router';

/**
 * Rutas del lanzador de Tablas básicas. Se monta bajo el layout privado en
 * `/mantenimiento/tablas-basicas`, que es el destino al que apunta la fila 58 del menú
 * (`TABLAS-BASICAS`) una vez conmutada a Phoenix.
 */
export const TABLAS_BASICAS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./lib/tablas-basicas/tablas-basicas-page').then((m) => m.TablasBasicasPage),
    data: { title: 'Tablas básicas', breadcrumb: 'Tablas básicas' },
  },
];

export { GRUPOS_TABLAS, type GrupoTablas, type OpcionTabla } from './lib/tablas-basicas/tablas';
