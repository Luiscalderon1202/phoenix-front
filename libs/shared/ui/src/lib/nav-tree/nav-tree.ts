import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Icon } from '../icon/icon';
import type { NavNode } from '../nav-tree-config';

/**
 * Árbol de navegación recursivo (acordeón, hasta 3 niveles). Presentacional:
 * recibe el árbol YA filtrado por permisos y la ruta activa; navega con `routerLink`.
 *
 * Comportamiento:
 *  - Acordeón por nivel: al abrir una rama, sus hermanas del mismo nivel se cierran.
 *  - La ruta activa abre automáticamente a sus ancestros (se recalcula al navegar).
 */
@Component({
  selector: 'erp-nav-tree',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, RouterLink, RouterLinkActive, Icon],
  templateUrl: './nav-tree.html',
  styleUrl: './nav-tree.scss',
})
export class NavTree {
  readonly nodes = input<readonly NavNode[]>([]);
  readonly activeRoute = input<string>('');

  /** Ids de grupos expandidos (estado de acordeón, controlado por el usuario). */
  private readonly expanded = signal<ReadonlySet<string>>(new Set());

  /** Ids de los ancestros del nodo cuya ruta coincide con la activa. */
  private readonly activeAncestors = computed(() =>
    ancestorIdsForRoute(this.nodes(), this.activeRoute()),
  );

  constructor() {
    // Al navegar, asegurar que los ancestros del item activo queden abiertos
    // (sin cerrar lo que el usuario haya abierto a mano).
    effect(() => {
      const ancestors = this.activeAncestors();
      if (ancestors.length === 0) return;
      this.expanded.update((prev) => new Set([...prev, ...ancestors]));
    });
  }

  protected isExpanded(id: string): boolean {
    return this.expanded().has(id);
  }

  /** Abre/cierra un grupo. Al abrir, cierra a sus hermanas del mismo nivel (acordeón). */
  protected toggle(node: NavNode, siblings: readonly NavNode[]): void {
    const next = new Set(this.expanded());
    if (next.has(node.id)) {
      next.delete(node.id);
    } else {
      for (const sibling of siblings) next.delete(sibling.id);
      next.add(node.id);
    }
    this.expanded.set(next);
  }
}

/**
 * Devuelve los ids de los ancestros (no incluye la hoja) del nodo cuya `route` corresponde a
 * `activeRoute`. Una ruta "corresponde" si es exacta o si `activeRoute` cuelga de ella
 * (`/accounting/balance/123` activa el nodo `/accounting/balance`).
 */
function ancestorIdsForRoute(nodes: readonly NavNode[], activeRoute: string): string[] {
  if (!activeRoute) return [];

  const walk = (items: readonly NavNode[], trail: string[]): string[] | null => {
    for (const node of items) {
      if (node.route && (activeRoute === node.route || activeRoute.startsWith(node.route + '/'))) {
        return trail; // ancestros acumulados (sin la hoja)
      }
      if (node.children) {
        const found = walk(node.children, [...trail, node.id]);
        if (found) return found;
      }
    }
    return null;
  };

  return walk(nodes, []) ?? [];
}
