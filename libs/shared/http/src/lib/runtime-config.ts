import { InjectionToken } from '@angular/core';

export interface RuntimeConfig {
  apiBaseUrl: string;
  appName?: string;
  version?: string;
}

export const RUNTIME_CONFIG = new InjectionToken<RuntimeConfig>('RUNTIME_CONFIG');

const DEFAULT_CONFIG: RuntimeConfig = { apiBaseUrl: '/api' };

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
