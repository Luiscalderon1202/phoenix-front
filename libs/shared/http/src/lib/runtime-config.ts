import { InjectionToken } from '@angular/core';

export interface RuntimeConfig {
  apiBaseUrl: string;
  /**
   * Raíz del ERP legacy en PHP, para las pantallas que aún no están migradas.
   *
   * Vacío (por defecto) = el legacy vive en el MISMO host que Angular, así que basta con la
   * ruta absoluta (`/admin/interfaz/...`). Se rellena cuando estén en hosts distintos, que es
   * lo normal en desarrollo: `http://localhost/pseraphis`.
   *
   * Sin barra final: quien lo use concatena rutas que ya empiezan por `/`.
   */
  legacyBaseUrl?: string;
  appName?: string;
  version?: string;
}

export const RUNTIME_CONFIG = new InjectionToken<RuntimeConfig>('RUNTIME_CONFIG');

const DEFAULT_CONFIG: RuntimeConfig = { apiBaseUrl: '/api', legacyBaseUrl: '' };

let loaded: RuntimeConfig | null = null;

export async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  try {
    const res = await fetch('/assets/config.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`config.json ${res.status}`);
    loaded = { ...DEFAULT_CONFIG, ...(await res.json()) };
  } catch {
    loaded = DEFAULT_CONFIG;
  }
  return loaded ?? DEFAULT_CONFIG;
}

export function getRuntimeConfig(): RuntimeConfig {
  return loaded ?? DEFAULT_CONFIG;
}
