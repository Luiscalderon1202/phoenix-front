import type { Routes } from '@angular/router';

/**
 * Rutas del módulo Laboratorios. Se montan bajo el layout privado de la app
 * (`/mantenimiento/laboratorios`), con `procesoGuard('CAT-LABORATORIO')` en `app.routes.ts`.
 *
 * ⚠ No cuelga del hub de Tablas Básicas: es una opción de menú propia (`basic.menuweb` 91, padre 70 «Catálogo») con su PROPIO
 * proceso de permiso.
 *
 * Seis endpoints, no ocho: la tabla no tiene `estado` ni `orden`. Es el gemelo de Marcas.
 *
 * El componente es lazy: no entra en el bundle inicial.
 */
export const LABORATORIOS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./lib/laboratorio-list/laboratorio-list-page').then((m) => m.LaboratorioListPage),
    data: { title: 'Laboratorios', breadcrumb: 'Laboratorios' },
  },
];
