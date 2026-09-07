import { InjectionToken } from '@angular/core';
import { Observable, throwError } from 'rxjs';

/**
 * INVERSIÓN DE DEPENDENCIAS (clave para no crear ciclo http↔auth).
 *
 * `shared/http` NO importa `shared/auth`. En su lugar define estos tokens de inyección
 * que `provideAuth()` (en `shared/auth`) implementa. Los interceptors leen las funciones,
 * no el `AuthStore`. Cada token trae un default no-op para que `shared/http` funcione
 * de forma autónoma (p. ej. en tests sin auth).
 *
 * MODELO DE SESIÓN: cookies httpOnly + CSRF (AGENTS.md §7.1). El access token NO lo ve el
 * JS: viaja en cookie httpOnly que el navegador adjunta solo (withCredentials). Por eso NO
 * existe un ACCESS_TOKEN_FN: no hay token en memoria que inyectar.
 */

/** Devuelve el id del tenant activo o `null` (se manda como header X-Tenant-Id). */
export const TENANT_ID_FN = new InjectionToken<() => string | null>('TENANT_ID_FN', {
  providedIn: 'root',
  factory: () => () => null,
});

/** Firma un proof de dispositivo (DPoP-style) para `method`+`url`. `null` si no hay clave. */
export const DEVICE_PROOF_FN = new InjectionToken<(method: string, url: string) => Promise<string | null>>(
  'DEVICE_PROOF_FN',
  { providedIn: 'root', factory: () => () => Promise.resolve(null) },
);

/**
 * Dispara un refresh deduplicado. Con cookies httpOnly no devuelve token alguno: tras
 * completar, las nuevas cookies ya quedaron seteadas por el servidor y el reintento de la
 * request las usa automáticamente. Emite al completar.
 */
export const REFRESH_TOKEN_FN = new InjectionToken<() => Observable<void>>('REFRESH_TOKEN_FN', {
  providedIn: 'root',
  factory: () => () => throwError(() => new Error('No hay proveedor de refresh configurado')),
});

/** Limpia la sesión cuando el refresh falla (lo implementa `AuthStore.clear`). */
export const SESSION_EXPIRED_FN = new InjectionToken<() => void>('SESSION_EXPIRED_FN', {
  providedIn: 'root',
  factory: () => () => void 0,
});
