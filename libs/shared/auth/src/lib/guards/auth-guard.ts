import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { AuthStore } from '../auth-store';

/**
 * Guard funcional para rutas privadas. Úsalo como `canMatch`.
 * Si no hay sesión, redirige a `/login?returnUrl=<ruta intentada>` para que el login
 * devuelva al usuario a donde iba tras autenticarse.
 */
export const authGuard: CanMatchFn = (_route, segments) => {
  if (inject(AuthStore).isAuthenticated()) return true;

  const returnUrl = '/' + segments.map((s) => s.path).join('/');
  return inject(Router).createUrlTree(['/login'], {
    queryParams: returnUrl !== '/' ? { returnUrl } : undefined,
  });
};
