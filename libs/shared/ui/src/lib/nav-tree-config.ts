/**
 * Árbol de navegación HÍBRIDO: la ESTRUCTURA se define en el front (aquí), la VISIBILIDAD
 * la decide el permiso por nodo. No se consulta ningún endpoint para armar el menú.
 *
 * Reglas de visibilidad (ver `filterByPermission`):
 *  - Nodo sin `requiredPermission` → siempre visible.
 *  - Hoja (con `route`) con `requiredPermission` → visible solo si el usuario tiene el permiso.
 *  - Grupo (con `children`) → visible solo si pasa su propio permiso Y le queda algún hijo visible.
 */
export interface NavNode {
  /** Id estable del nodo (track en el render recursivo). */
  id: string;
  label: string;
  /** Nombre del icono en `ICON_REGISTRY`. */
  icon: string;
  /** Hoja navegable: ruta absoluta. Los grupos no llevan `route`. */
  route?: string;
  /**
   * La hoja apunta al ERP legacy en PHP, no a una ruta de Angular. Durante la
   * migracion strangler conviven las dos aplicaciones detras del mismo menu: las
   * pantallas migradas navegan con routerLink y el resto sale con una
   * navegacion completa de pagina.
   */
  external?: boolean;
  /**
   * Si está presente, el nodo se muestra solo si el usuario tiene esa acción en la
   * opción de menú indicada (`AuthStore.can(menuid, accion)`).
   */
  requiredPermission?: { menuid: number; accion: string };
  children?: NavNode[];
}

/**
 * Estructura del menú. Las rutas apuntan a los shells reales registrados en `app.routes.ts`.
 *
 * Nota de permisos: ningún nodo lleva `requiredPermission` hoy. Los que tenía (contabilidad)
 * usaban códigos inventados del estilo `accounting.balance.view`, que el backend NUNCA emitió
 * —solo existen ACT, DEL y VER—, así que filtrar por ellos habría ocultado todo el módulo.
 * Se quitaron al migrar los permisos al grano (menú, acción) el 2026-08-17.
 *
 * ⚠️ Este árbol está sin consumidores: MainLayout pinta el menú que manda el backend
 * (`fn_user_menus`). Si se revive, cada nodo debe declarar `{ menuid, accion }` con un
 * menuid real de `oauth.menu`.
 */
export const NAV_TREE: NavNode[] = [
  { id: 'inicio', label: 'Inicio', icon: 'home', route: '/inicio' },
  {
    id: 'seguridad',
    label: 'Seguridad',
    icon: 'shield',
    children: [
      { id: 'usuarios', label: 'Usuarios', icon: 'users', route: '/security/users' },
      { id: 'roles', label: 'Roles', icon: 'doc', route: '/security/roles' },
      { id: 'tenants', label: 'Tenants', icon: 'church', route: '/security/tenants' },
    ],
  },
  {
    id: 'catalogos',
    label: 'Catálogos',
    icon: 'database',
    children: [
      { id: 'monedas', label: 'Monedas', icon: 'cash', route: '/master-data/currencies' },
      { id: 'paises', label: 'Países', icon: 'visits', route: '/master-data/countries' },
      { id: 'unidades', label: 'Unidades', icon: 'columns', route: '/master-data/units-of-measure' },
      {
        id: 'tipos-cambio',
        label: 'Tipos de cambio',
        icon: 'scale',
        route: '/master-data/exchange-rates',
      },
    ],
  },
  {
    id: 'terceros',
    label: 'Terceros',
    icon: 'users',
    children: [
      { id: 'personas', label: 'Personas', icon: 'user', route: '/partners/persons' },
      { id: 'empresas', label: 'Empresas', icon: 'church', route: '/partners/corporations' },
    ],
  },
  {
    id: 'contabilidad',
    label: 'Contabilidad',
    icon: 'book',
    children: [
      {
        id: 'balance',
        label: 'Balance de Comprobación',
        icon: 'scale',
        route: '/accounting/balance',
      },
      {
        id: 'balance-general',
        label: 'Balance General',
        icon: 'estado',
        route: '/accounting/balance-general',
      },
      {
        id: 'conta-lote',
        label: 'Lead Time de Asientos',
        icon: 'estado',
        route: '/accounting/conta-lote',
      },
      {
        id: 'estados-financieros',
        label: 'Estados Financieros',
        icon: 'estado',
        children: [
          {
            id: 'estado-resultado',
            label: 'Estado de Resultados',
            icon: 'doc',
            route: '/accounting/estado-resultado',
          },
          {
            id: 'proyeccion-planilla',
            label: 'Proyección de Planilla',
            icon: 'doc',
            route: '/accounting/proyeccion-planilla',
          },
          {
            id: 'tendencias',
            label: 'Tendencias',
            icon: 'doc',
            route: '/accounting/tendencias',
          },
        ],
      },
      {
        id: 'libros',
        label: 'Libros',
        icon: 'books',
        children: [
          {
            id: 'mayor',
            label: 'Mayor',
            icon: 'doc',
            route: '/accounting/mayor',
          },
          {
            id: 'diario',
            label: 'Diario',
            icon: 'doc',
            route: '/accounting/diario',
          },
          {
            id: 'caja-bancos',
            label: 'Caja y Bancos',
            icon: 'cash',
            route: '/accounting/caja-bancos',
          },
        ],
      },
    ],
  },
];

/**
 * Filtra el árbol por permisos, de forma recursiva e inmutable.
 *
 * @param nodes árbol completo (estructura del front).
 * @param can   predicado de permiso. Convención:
 *              `p => !p || authStore.can(p.menuid, p.accion)`
 *              (un nodo sin `requiredPermission` siempre pasa).
 */
export function filterByPermission(
  nodes: readonly NavNode[],
  can: (permission?: { menuid: number; accion: string }) => boolean,
): NavNode[] {
  return nodes
    .map((n) => ({
      ...n,
      children: n.children ? filterByPermission(n.children, can) : undefined,
    }))
    .filter((n) => {
      const allowed = can(n.requiredPermission);
      const hasVisibleChildren = !!n.children?.length;
      // Hoja: visible si tiene permiso. Grupo: visible si tiene permiso Y le quedan hijos visibles.
      return n.route ? allowed : allowed && hasVisibleChildren;
    });
}
