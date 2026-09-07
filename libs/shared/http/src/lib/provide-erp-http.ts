import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { provideHttpClient, withInterceptors, withXhr } from '@angular/common/http';
import { API_BASE_URL, LEGACY_BASE_URL } from './api-config';
import { getRuntimeConfig, RUNTIME_CONFIG } from './runtime-config';
import { credentialsInterceptor } from './interceptors/credentials-interceptor';
import { csrfInterceptor } from './interceptors/csrf-interceptor';
import { envelopeInterceptor } from './interceptors/envelope-interceptor';
import { refreshInterceptor } from './interceptors/refresh-interceptor';
import { errorInterceptor } from './interceptors/error-interceptor';

/**
 * Provee el cliente HTTP del ERP con la cadena de interceptors en orden:
 *   error → credentials → tenant → csrf → device-proof → envelope → refresh
 *
 * `error` va el PRIMERO (interceptor más externo) a propósito: es la frontera de errores. Así, en
 * la fase de respuesta desenrolla el ÚLTIMO, después de que `refresh` haya gestionado el 401 con el
 * `HttpErrorResponse` crudo; sólo lo que escapa llega a `error`, que lo normaliza y lo notifica.
 *
 * Modelo de sesión por cookies httpOnly + CSRF (AGENTS.md §7.1):
 * - `credentials` activa `withCredentials` global → las cookies de sesión viajan solas.
 * - `csrf` adjunta `X-CSRF-Token` en mutaciones (double-submit).
 * - El access token NO se maneja en JS (no hay Bearer).
 *
 * API_BASE_URL y RUNTIME_CONFIG se llenan desde getRuntimeConfig(), cargado en main.ts
 * antes de bootstrapApplication — bundle único válido para todos los ambientes.
 */
export function provideErpHttp(): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: API_BASE_URL,   useFactory: () => getRuntimeConfig().apiBaseUrl },
    { provide: RUNTIME_CONFIG, useFactory: () => getRuntimeConfig() },
    { provide: LEGACY_BASE_URL, useFactory: () => getRuntimeConfig().legacyBaseUrl ?? '' },
    provideHttpClient(withXhr(), 
      // tenantInterceptor: fuera. pseraphis es single-tenant (1 corporacion); el
      // eje real es multiempresa y viaja como ?empresaid= por peticion, no como
      // header de tenant.
      //
      // deviceProofInterceptor: fuera por ahora. phoenix-api todavia no verifica
      // el proof de dispositivo; se reincorpora cuando exista el endpoint.
      withInterceptors([
        errorInterceptor,
        credentialsInterceptor,
        csrfInterceptor,
        envelopeInterceptor,
        refreshInterceptor,
      ]),
    ),
  ]);
}
