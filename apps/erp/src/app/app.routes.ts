import { Route } from '@angular/router';
import {
  authGuard,
  CambioClavePage,
  cambioClaveGuard,
  LoginPage,
  procesoGuard,
} from '@phoenix/shared/auth';
import { HomePage } from './home/home-page';
import { MainLayout } from './layout/main-layout/main-layout';

export const appRoutes: Route[] = [
  // Login público, FUERA del layout (sin navbar/sidebar). `shared/auth` se usa eager
  // (provideAuth/authGuard), por eso LoginPage se importa estático y no lazy.
  { path: 'login', component: LoginPage },

  // Cambio de contraseña: FUERA del layout, como el login. Quien llega aquí tiene
  // una clave temporal pendiente y no debe poder navegar a nada más, así que
  // mostrarle navbar y menú sería ofrecerle salidas que el guard va a bloquear.
  // Exige sesión (authGuard) pero NO cambioClaveGuard: es su propio destino.
  {
    path: 'cambiar-clave',
    component: CambioClavePage,
    canMatch: [authGuard],
    data: { title: 'Cambiar contraseña' },
  },

  // Árbol privado: el `MainLayout` (navbar + sidebar + outlet) envuelve todo, protegido
  // por `authGuard` (canMatch en el padre). Cada ruta declara `breadcrumb`/`title` para que
  // los breadcrumbs y el título se deriven solos de la ruta activa.
  //
  // A medida que se migren módulos del legacy (pseraphis) se agrega aquí un hijo lazy
  // por dominio: `loadChildren: () => import('@phoenix/<dominio>/shell').then(…)`.
  {
    path: '',
    component: MainLayout,
    canMatch: [authGuard],
    // Desvía a /cambiar-clave mientras la contraseña siga siendo la temporal. Va
    // en el padre para cubrir TODO el árbol privado de una sola vez.
    canActivate: [cambioClaveGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'inicio' },
      {
        path: 'inicio',
        component: HomePage,
        data: { title: 'Inicio', breadcrumb: 'Inicio' },
      },
      // Mantenimiento (tablas básicas del legacy pseraphis). El tramo padre no tiene
      // pantalla propia: solo aporta la migaja "Mantenimiento" y agrupa a sus hijos.
      {
        path: 'mantenimiento',
        data: { breadcrumb: 'Mantenimiento' },
        children: [
          {
            path: 'personas',
            // `procesoGuard` y no `permissionGuard`: en Phoenix la unidad de
            // permiso es `basic.menuweb.proceso`, no el par (menuid, acción) de
            // ezer. PERSONA es el mismo valor que usa $segProcesoMenu en el PHP,
            // y el backend revalida el mismo proceso con RequirePermiso.
            canMatch: [procesoGuard('PERSONA')],
            loadChildren: () =>
              import('@phoenix/basic/feature-personas').then((m) => m.PERSONAS_ROUTES),
          },
        ],
      },
    ],
  },

  { path: '**', redirectTo: '' },
];
