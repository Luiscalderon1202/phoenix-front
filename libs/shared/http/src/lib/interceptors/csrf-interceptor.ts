import { HttpInterceptorFn } from '@angular/common/http';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const CSRF_COOKIE = 'csrf_token';
const CSRF_HEADER = 'X-CSRF-Token';

/** Lee el valor de una cookie legible por JS (csrf_token no es httpOnly). */
function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Double-submit CSRF (AGENTS.md §7.1): en métodos mutantes adjunta el header
 * `X-CSRF-Token` con el valor del cookie legible `csrf_token`. El servidor exige que
 * header y cookie coincidan. Las lecturas (GET/HEAD) no lo requieren.
 */
export const csrfInterceptor: HttpInterceptorFn = (req, next) => {
  if (!MUTATING.has(req.method.toUpperCase())) {
    return next(req);
  }
  const token = readCookie(CSRF_COOKIE);
  if (!token) {
    return next(req);
  }
  return next(req.clone({ setHeaders: { [CSRF_HEADER]: token } }));
};
