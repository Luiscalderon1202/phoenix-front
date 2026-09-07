import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { TENANT_ID_FN } from '../tokens';
import { isAuthEndpoint } from '../auth-endpoints';

/**
 * Adjunta `X-Tenant-Id: <tenant activo>` a toda request autenticada.
 * El id del tenant llega por inversión de dependencias (`TENANT_ID_FN`), no desde `AuthStore`.
 */
export const tenantInterceptor: HttpInterceptorFn = (req, next) => {
  const getTenantId = inject(TENANT_ID_FN);
  const tenantId = getTenantId();

  if (!tenantId || isAuthEndpoint(req.url)) {
    return next(req);
  }

  return next(req.clone({ setHeaders: { 'X-Tenant-Id': tenantId } }));
};
