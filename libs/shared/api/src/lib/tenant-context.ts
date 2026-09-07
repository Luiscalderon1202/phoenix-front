/**
 * Contexto de tenant activo. Lo expone `shared/auth` y lo adjunta el `tenant-interceptor`
 * como header `X-Tenant-Id` en cada request autenticada.
 */
export interface TenantContext {
  tenantId: string;
  tenantName: string;
}
