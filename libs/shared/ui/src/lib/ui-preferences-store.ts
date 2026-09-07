import { computed, Injectable, signal } from '@angular/core';

/** Preferencias de UI puramente cosméticas (no sensibles). */
export interface UiPrefs {
  sidebarCollapsed: boolean;
  tableDensity: 'compact' | 'normal';
  defaultPageSize: number;
}

const DEFAULTS: UiPrefs = {
  sidebarCollapsed: false,
  tableDensity: 'normal',
  defaultPageSize: 25,
};

/**
 * Store de preferencias cosméticas de UI. ÚNICO uso permitido de localStorage en la app.
 *
 * EXCEPCIÓN DOCUMENTADA: localStorage SOLO se usa aquí y SOLO para preferencias no sensibles
 * (sidebar colapsado, densidad de tabla, page size). PROHIBIDO guardar tokens, datos de sesión,
 * datos de negocio o cualquier cosa sensible. La clave va namespaced por `userId` para no mezclar
 * preferencias entre usuarios del mismo navegador (equipos compartidos / multi-tenant).
 *
 * No inyecta `AuthStore` a propósito: shared/ui (type:ui) no puede depender de shared/auth
 * (type:data-access). El `userId` lo provee quien lo use (el `MainLayout` en la app) vía `load()`.
 */
@Injectable({ providedIn: 'root' })
export class UiPreferencesStore {
  private readonly _prefs = signal<UiPrefs>(DEFAULTS);
  private userId = 'anon';

  readonly sidebarCollapsed = computed(() => this._prefs().sidebarCollapsed);
  readonly tableDensity = computed(() => this._prefs().tableDensity);
  readonly defaultPageSize = computed(() => this._prefs().defaultPageSize);

  private key(): string {
    return `erp.ui.prefs.${this.userId}`;
  }

  /** Carga las preferencias del usuario indicado desde localStorage (cae a DEFAULTS si falla). */
  load(userId: string | null): void {
    this.userId = userId ?? 'anon';
    try {
      const raw = localStorage.getItem(this.key());
      this._prefs.set(raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS);
    } catch {
      this._prefs.set(DEFAULTS);
    }
  }

  toggleSidebar(): void {
    this.patch({ sidebarCollapsed: !this._prefs().sidebarCollapsed });
  }

  setDensity(density: UiPrefs['tableDensity']): void {
    this.patch({ tableDensity: density });
  }

  setDefaultPageSize(size: number): void {
    this.patch({ defaultPageSize: size });
  }

  private patch(partial: Partial<UiPrefs>): void {
    const next = { ...this._prefs(), ...partial };
    this._prefs.set(next);
    try {
      localStorage.setItem(this.key(), JSON.stringify(next));
    } catch {
      /* cosmético: si localStorage no está disponible, se ignora silenciosamente */
    }
  }
}
