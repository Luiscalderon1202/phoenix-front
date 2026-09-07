import type { MenuItem } from '@phoenix/shared/auth';
import type { NavNode } from '@phoenix/shared/ui/chrome';

/**
 * Convierte el menú plano del backend (ya filtrado por permisos en `fn_user_menus`) al árbol
 * `NavNode` que consume el sidebar.
 *
 * Reglas:
 * - Un nodo CON hijos → grupo expandible (sin `route`).
 * - Un nodo SIN hijos (hoja) → navega a `menu.ruta` (la BD es la fuente de verdad de la ruta).
 * - `migrado: false` → la pantalla sigue en el ERP legacy: el nodo se marca `external` y el
 *   sidebar usa `href` en vez de `routerLink`. Migrar una pantalla es insertar una fila en
 *   `auth.menu_ruta`; ni el front ni el legacy se tocan.
 * - Icono: se usa uno seguro del registro ('database' para grupos, 'doc' para hojas) hasta
 *   alinear `menu.icono` con `ICON_REGISTRY`.
 */
const FALLBACK_ROUTE = '/inicio';

export function menusToNavNodes(menus: readonly MenuItem[]): NavNode[] {
  const childrenOf = new Map<number | null, MenuItem[]>();
  for (const m of menus) {
    const key = m.parentId ?? null;
    const list = childrenOf.get(key);
    if (list) {
      list.push(m);
    } else {
      childrenOf.set(key, [m]);
    }
  }

  const build = (parentId: number | null): NavNode[] =>
    (childrenOf.get(parentId) ?? [])
      .slice()
      .sort((a, b) => a.orden - b.orden)
      .map((m) => {
        const children = build(m.menuid);
        const node: NavNode = {
          id: String(m.menuid),
          label: m.nombre,
          icon: children.length ? 'database' : 'doc',
        };
        if (children.length) {
          node.children = children;
        } else {
          // La BD manda. `/inicio` solo como red de seguridad si `ruta` viniera vacía.
          node.route = m.ruta?.trim() ? m.ruta : FALLBACK_ROUTE;
          // Sin `migrado` la pantalla sigue en el PHP: se navega fuera de Angular.
          // Solo aplica si hay ruta real; el fallback es interno.
          if (m.ruta?.trim() && !m.migrado) {
            node.external = true;
          }
        }
        return node;
      });

  return build(null);
}
