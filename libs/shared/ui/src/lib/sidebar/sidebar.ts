import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NavTree } from '../nav-tree/nav-tree';
import type { NavNode } from '../nav-tree-config';

/**
 * Barra lateral (presentacional): contiene el árbol de navegación (con scroll) y un footer
 * con la marca y versión. Colapsa a ancho 0 cuando `collapsed` es true (el grid del layout
 * anima la transición). Recibe el árbol YA filtrado por permisos.
 */
@Component({
  selector: 'erp-sidebar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NavTree],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar {
  readonly nodes = input<readonly NavNode[]>([]);
  readonly activeRoute = input<string>('');
  readonly collapsed = input(false);
  readonly appVersion = input<string>('');
}
