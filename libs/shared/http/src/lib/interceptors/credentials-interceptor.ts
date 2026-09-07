import { HttpInterceptorFn } from '@angular/common/http';

/**
 * Habilita `withCredentials` en TODA request para que las cookies httpOnly de sesión
 * (access_token, refresh_token, csrf_token) viajen automáticamente. Es el reemplazo del
 * viejo Bearer: el navegador adjunta el access token, el JS nunca lo toca.
 */
export const credentialsInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req.clone({ withCredentials: true }));
};
