import type { Routes } from '@angular/router';

/**
 * Rutas del módulo Empresas. Se montan bajo el layout privado de la app
 * (`/mantenimiento/empresas`), con `procesoGuard('EMPRESA')` en `app.routes.ts`.
 *
 * ⚠ El proceso `EMPRESA` (`basic.menuweb` 6) decide quién puede MANTENER el catálogo. NO es
 * el ámbito multiempresa: quién puede operar sobre los datos de una empresa concreta lo
 * decide `basic.permisos_empresa` y viaja como `?empresaid=`.
 *
 * El componente es lazy: no entra en el bundle inicial.
 */
export const EMPRESAS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./lib/empresa-list/empresa-list-page').then((m) => m.EmpresaListPage),
    data: { title: 'Empresas', breadcrumb: 'Empresas' },
  },
];
