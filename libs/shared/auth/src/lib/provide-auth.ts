import { EnvironmentProviders, inject, makeEnvironmentProviders } from '@angular/core';
import {
  DEVICE_PROOF_FN,
  REFRESH_TOKEN_FN,
  SESSION_EXPIRED_FN,
  TENANT_ID_FN,
} from '@phoenix/shared/http';
import { requiresDeviceProof } from '@phoenix/shared/http';
import { AuthStore } from './auth-store';
import { DeviceKey } from './device/device-key';

/**
 * Registra `AuthStore` e implementa los tokens invertidos de `shared/http`.
 * Así `shared/http` adjunta tenant, firma proofs y refresca sin importar `shared/auth`
 * (evita el ciclo http↔auth).
 *
 * Nota: ya NO existe ACCESS_TOKEN_FN — con cookies httpOnly el access token no se maneja
 * en JS (lo adjunta el navegador). El CSRF lo resuelve el `csrf-interceptor` leyendo el
 * cookie `csrf_token`, sin inversión.
 */
export function provideAuth(): EnvironmentProviders {
  return makeEnvironmentProviders([
    AuthStore,
    {
      provide: TENANT_ID_FN,
      useFactory: () => {
        const store = inject(AuthStore);
        return () => store.tenant()?.tenantId ?? null;
      },
    },
    {
      provide: REFRESH_TOKEN_FN,
      useFactory: () => {
        const store = inject(AuthStore);
        return () => store.refresh$();
      },
    },
    {
      provide: SESSION_EXPIRED_FN,
      useFactory: () => {
        const store = inject(AuthStore);
        return () => store.clear();
      },
    },
    {
      provide: DEVICE_PROOF_FN,
      useFactory: () => {
        const deviceKey = inject(DeviceKey);
        return (method: string, url: string) =>
          requiresDeviceProof(url) ? deviceKey.createProof(method, url) : Promise.resolve(null);
      },
    },
  ]);
}
