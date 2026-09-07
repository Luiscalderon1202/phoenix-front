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

/**
 * Raíz del ERP legacy en PHP. Se provee en `provideErpHttp()` desde `config.json`.
 *
 * Lo consumen las pantallas que enlazan a partes no migradas del sistema anterior; el menú
 * lateral no lo usa porque el backend ya le manda la ruta completa en `menuweb.link`.
 */
export const LEGACY_BASE_URL = new InjectionToken<string>('ERP_LEGACY_BASE_URL', {
  providedIn: 'root',
  factory: () => '',
});
