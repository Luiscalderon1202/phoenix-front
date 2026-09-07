/**
 * Rutas públicas de autenticación (infraestructura HTTP — viven aquí porque varios
 * interceptors necesitan reconocerlas, y `shared/http` NO puede importar `shared/auth`).
 * - El `auth-interceptor` NO adjunta el Bearer a estas rutas.
 * - El `refresh-interceptor` NO intenta refrescar ante un 401 de estas rutas (evita bucles).
 * - El `device-proof-interceptor` SÍ firma el proof para login/refresh.
 */
export const AUTH_LOGIN = '/auth/login';
export const AUTH_REFRESH = '/auth/refresh';
export const AUTH_LOGOUT = '/auth/logout';
export const AUTH_SWITCH_TENANT = '/auth/switch-tenant';
/** Cambio de la propia contraseña. NO es público: exige sesión y CSRF. */
export const AUTH_CAMBIAR_CLAVE = '/auth/clave';

const AUTH_PATHS = [AUTH_LOGIN, AUTH_REFRESH, AUTH_LOGOUT];

/** ¿La URL apunta a un endpoint público de auth (login/refresh/logout)? */
export function isAuthEndpoint(url: string): boolean {
  return AUTH_PATHS.some((path) => url.includes(path));
}

/** Endpoints que firman proof de dispositivo (login + refresh). */
export function requiresDeviceProof(url: string): boolean {
  return url.includes(AUTH_LOGIN) || url.includes(AUTH_REFRESH);
}
