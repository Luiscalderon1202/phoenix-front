import type { TenantContext } from '@phoenix/shared/api';

/**
 * Usuario autenticado (espejo del UserDTO del backend).
 */
export interface AuthUser {
  userid: number;
  usuario: string;
  nombre: string;
  email: string;
  roles: string[];
  /**
   * Superusuario del legacy (`basic.superusuario()`). Ve todos los menús y
   * empresas, y el backend le salta la comprobación de permisos.
   */
  esadmin?: boolean;
}

/**
 * Credenciales de login desde la UI. `email` es el identificador (usuario o correo);
 * `tenantId` opcional cuando el usuario pertenece a varios tenants.
 * (El AuthStore las traduce al body del backend: `{ usuario, clave, corporacionId }`.)
 */
export interface LoginCredentials {
  email: string;
  password: string;
  tenantId?: string;
}

/** Cuerpo de PUT /auth/clave: el propio usuario cambia su contraseña. */
export interface CambioClave {
  claveActual: string;
  claveNueva: string;
}

/**
 * Tenant (corporación) tal como lo manda el backend.
 */
export interface BackendTenant {
  tenantId: number;
  tenantName: string;
}

/**
 * Ítem de menú del usuario (lista plana; el front arma el árbol por `parentId`).
 * Ya viene filtrado por permisos desde el backend (fn_user_menus).
 */
export interface MenuItem {
  menuid: number;
  parentId: number | null;
  nombre: string;
  ruta: string;
  icono: string;
  nivel: number;
  orden: number;
  /** Unidad de permiso (`basic.menuweb.proceso`), p. ej. `PERSONA`. */
  proceso?: string;
  /**
   * `false` = la pantalla sigue en el ERP legacy en PHP y `ruta` es su URL.
   * Lo resuelve el backend con auth.menu_ruta; migrar una pantalla es insertar
   * una fila, sin desplegar el front.
   */
  migrado?: boolean;
}

/**
 * Acciones que el usuario tiene EN UNA opción de menú.
 *
 * Antes el backend mandaba una lista plana de claves (`['ACT','DEL']`) porque colapsaba
 * los permisos por aplicación: tener ACT en una sola pantalla daba ACT en todas. Ahora
 * el par (menú, acción) viaja completo, que es como siempre estuvo guardado en la base.
 */
export interface MenuPermiso {
  menuid: number;
  acciones: string[];
}

/**
 * Comodin de acciones. pseraphis concede el menu entero (basic.permisos_menuweb
 * es un booleano por menu, sin acciones), asi que el backend emite ['*'].
 */
export const ACCION_TODAS = '*';

/**
 * Payload de login/refresh/switchTenant (va dentro de `data` del envelope).
 * ⛔ NO trae access token: con cookies httpOnly el access viaja en cookie y el JS no lo ve.
 * El refresh también es cookie httpOnly. El front solo recibe identidad + permisos + tenants.
 */
export interface AuthSessionPayload {
  user: AuthUser;
  /**
   * La contraseña vigente es temporal y hay que cambiarla antes de operar. La
   * temporal NO es secreta —es el documento de la persona o un valor fijo que el
   * encargado dicta—, así que dejar entrar sin cambiarla haría inútil el resto.
   */
  debeCambiarClave?: boolean;
  tenant: BackendTenant | null;
  permissions: MenuPermiso[];
  corporaciones: BackendTenant[];
  menus: MenuItem[];
}

/** Convierte el tenant del backend al TenantContext del front (id como string). */
export function toTenantContext(t: BackendTenant | null): TenantContext | null {
  return t ? { tenantId: String(t.tenantId), tenantName: t.tenantName } : null;
}
