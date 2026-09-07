import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, switchMap, throwError } from 'rxjs';
import { REFRESH_TOKEN_FN, SESSION_EXPIRED_FN } from '../tokens';
import { isAuthEndpoint } from '../auth-endpoints';

/**
 * Maneja respuestas `401`:
 *  1. Dedupe de refresh en vuelo: `REFRESH_TOKEN_FN()` (implementado en auth) comparte un
 *     único `/refresh` entre N requests concurrentes.
 *  2. Al completar el refresh, el servidor ya seteó las cookies nuevas (access/csrf): se
 *     **reintenta** la request original tal cual; el navegador adjunta las cookies frescas.
 *  3. Si el refresh falla → `SESSION_EXPIRED_FN()` (limpia sesión) + redirect a `/login`.
 *     No reintenta en bucle: los endpoints de auth quedan excluidos del manejo de 401.
 */
export const refreshInterceptor: HttpInterceptorFn = (req, next) => {
  const refresh = inject(REFRESH_TOKEN_FN);
  const sessionExpired = inject(SESSION_EXPIRED_FN);
  const router = inject(Router);

  if (isAuthEndpoint(req.url)) {
    return next(req);
  }

  return next(req).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse) || err.status !== 401) {
        return throwError(() => err);
      }
      return refresh().pipe(
        switchMap(() => next(req)),
        catchError((refreshErr: unknown) => {
          sessionExpired();
          void router.navigate(['/login']);
          return throwError(() => refreshErr);
        }),
      );
    }),
  );
};
