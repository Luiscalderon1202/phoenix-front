import { InjectionToken } from '@angular/core';

/**
 * Configuración del cliente HTTP del ERP.
 */
export interface ApiConfig {
  baseUrl: string;
}

/**
 * URL base del API. Se provee en `provideErpHttp(config)`.
 */
export const API_BASE_URL = new InjectionToken<string>('ERP_API_BASE_URL');
