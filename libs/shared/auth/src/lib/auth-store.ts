import { computed, inject, Injectable, signal } from '@angular/core';
import { finalize, firstValueFrom, map, Observable, shareReplay, tap } from 'rxjs';
import type { TenantContext } from '@phoenix/shared/api';
import { AuthApi } from './auth-api';
import { DeviceKey } from './device/device-key';
import {
  toTenantContext,
  type AuthSessionPayload,
  type AuthUser,
  type BackendTenant,
  type LoginCredentials,
  type MenuItem,
  type MenuPermiso,
  type CambioClave,
  ACCION_TODAS,
} from './auth-user';

/**
 * Signal store de autenticación (sesión viva). Lo consulta TODO el sistema sin acoplarse
 * al módulo de negocio `security`.
 *
 * Modelo de sesión: cookies httpOnly + CSRF (AGENTS.md §7.1).
 * - El access token NO vive en el front: es una cookie httpOnly que el navegador adjunta
 *   solo (vía `withCredentials`). El JS nunca lo ve ni lo guarda.
 * - El refresh token es otra cookie httpOnly acotada a `/api/v1/auth`.
 * - `isAuthenticated` se deriva de tener `user` (no de un token en memoria).
 * - `refresh$()` está deduplicado: N requests con 401 comparten un único `/refresh`.
 *
 * Se provee vía `provideAuth()` para que los tokens invertidos de `shared/http` resuelvan
 * esta misma instancia.
 */
@Injectable()
export class AuthStore {
  private readonly api = inject(AuthApi);
  private readonly deviceKey = inject(DeviceKey);

  // ── state privado ───────────────────────────────────────────────────
  private readonly _user = signal<AuthUser | null>(null);
  private readonly _tenant = signal<TenantContext | null>(null);
  private readonly _permissions = signal<MenuPermiso[]>([]);
  private readonly _corporaciones = signal<BackendTenant[]>([]);
  private readonly _menus = signal<MenuItem[]>([]);
  private readonly _debeCambiarClave = signal(false);

  // ── selectors públicos ──────────────────────────────────────────────
  readonly user = this._user.asReadonly();
  readonly tenant = this._tenant.asReadonly();
  readonly permissions = this._permissions.asReadonly();
  readonly corporaciones = this._corporaciones.asReadonly();
  readonly menus = this._menus.asReadonly();
  /** true ⇒ hay que cambiar la contraseña antes de dejar operar. */
  readonly debeCambiarClave = this._debeCambiarClave.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);

  /** Callbacks a ejecutar tras cambiar de tenant (los registra cada store de feature). */
  private readonly tenantChangeHooks = new Set<() => void>();

  /** Refresh en vuelo (dedupe). `null` cuando no hay refresh en curso. */
  private refreshInFlight$: Observable<void> | null = null;

  // ── commands ────────────────────────────────────────────────────────
  async login(credentials: LoginCredentials): Promise<void> {
    await this.deviceKey.ensure();
    const devicePublicJwk = await this.deviceKey.publicJwk();
    const payload = await firstValueFrom(
      this.api.login({
        usuario: credentials.email,
        clave: credentials.password,
        // pseraphis es single-tenant: la corporacion 1 es la unica. Se manda
        // explicita para que el contrato ya contemple el multi-tenant futuro.
        corporacionId: credentials.tenantId ? Number(credentials.tenantId) : 1,
        devicePublicJwk,
      }),
    );
    this.applySession(payload);
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.api.logout());
    } finally {
      this.clear();
    }
  }

  /**
   * Refresh silencioso. Usado en el bootstrap (provideAppInitializer) y por el refresh-interceptor.
   * No bloquea el arranque si no hay sesión (el llamador hace `.catch(() => void 0)`).
   */
  async refresh(): Promise<void> {
    await firstValueFrom(this.refresh$());
  }

  /**
   * Variante Observable para el `refresh-interceptor` (vía `REFRESH_TOKEN_FN`).
   * Deduplicada: un solo `/refresh` para N suscriptores concurrentes. No emite token (las
   * cookies nuevas ya quedaron seteadas por el servidor); emite `void` al completar.
   */
  refresh$(): Observable<void> {
    if (!this.refreshInFlight$) {
      this.refreshInFlight$ = this.api.refresh().pipe(
        tap((payload) => this.applySession(payload)),
        map(() => void 0),
        finalize(() => (this.refreshInFlight$ = null)),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    }
    return this.refreshInFlight$;
  }

  /**
   * Cambia de tenant: el backend valida el acceso y reemite cookies + permisos.
   * Al cambiar se LIMPIA el estado de todos los stores de feature (vía hooks).
   */
  async switchTenant(tenantId: string): Promise<void> {
    const payload = await firstValueFrom(this.api.switchTenant(Number(tenantId)));
    this.applySession(payload);
    for (const hook of this.tenantChangeHooks) {
      hook();
    }
  }

  /** Registra un callback de limpieza/recarga a ejecutar tras `switchTenant()`. */
  onTenantChanged(hook: () => void): void {
    this.tenantChangeHooks.add(hook);
  }

  clear(): void {
    this._user.set(null);
    this._tenant.set(null);
    this._permissions.set([]);
    this._corporaciones.set([]);
    this._menus.set([]);
    this._debeCambiarClave.set(false);
    this.refreshInFlight$ = null;
  }

  /**
   * Cambia la contraseña del usuario actual. Al terminar refresca la sesión para
   * que `debeCambiarClave` baje a false y el guard deje de redirigir.
   */
  async cambiarClave(cambio: CambioClave): Promise<void> {
    await firstValueFrom(this.api.cambiarClave(cambio));
    this._debeCambiarClave.set(false);
  }

  // ── autorización (consultado por TODO el sistema, sin acoplar a security) ──
  /**
   * ¿El usuario tiene la acción `code` en la opción de menú `menuid`?
   *
   * Es solo para pintar u ocultar controles: el enforcement real lo hace el backend
   * contra el mismo par. Nunca uses esto como única barrera.
   */
  can(menuid: number, code: string): boolean {
    return this._permissions().some(
      (p) =>
        p.menuid === menuid &&
        // pseraphis concede el menu completo, sin granularidad de accion, y el
        // backend lo expresa con el comodin '*'. Se comprueba tambien la accion
        // concreta para que el dia que existan permisos por accion este codigo
        // siga valiendo sin cambios.
        (p.acciones.includes(ACCION_TODAS) || p.acciones.includes(code)),
    );
  }

  /**
   * ¿Tiene el usuario acceso al proceso indicado?
   *
   * En Phoenix la unidad de permiso es `basic.menuweb.proceso` (p. ej. PERSONA,
   * CAJA, CAT-MARCA), no el par (menuid, acción) de ezer: pseraphis solo tiene
   * un booleano por menú y no hay fuente de verdad para inventar acciones.
   *
   * El menú llega YA filtrado por permisos desde `auth.papermisos_efectivos`,
   * así que la presencia del proceso ES el permiso.
   *
   * ⚠️ Solo para el enrutado: oculta la pantalla, no protege el dato. El backend
   * revalida el mismo proceso en cada endpoint con RequirePermiso.
   */
  puedeProceso(proceso: string): boolean {
    if (this._user()?.esadmin) return true;

    const buscado = proceso.trim().toUpperCase();
    if (!buscado) return true;

    return this._menus().some((m) => (m.proceso ?? '').trim().toUpperCase() === buscado);
  }

  private applySession(payload: AuthSessionPayload): void {
    this._user.set(payload.user);
    this._tenant.set(toTenantContext(payload.tenant));
    this._permissions.set(payload.permissions);
    this._corporaciones.set(payload.corporaciones ?? []);
    this._menus.set(payload.menus ?? []);
    this._debeCambiarClave.set(payload.debeCambiarClave ?? false);
  }
}
