import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { input } from '@angular/core';
import { Icon } from '../icon/icon';
import { UserMenu, type UserMenuAction } from '../user-menu/user-menu';

/**
 * Barra superior (presentacional puro): toggle de sidebar + marca a la izquierda,
 * botón de apps + chip de usuario a la derecha. Fondo navy, texto blanco.
 *
 * No conoce `AuthStore`: recibe los datos por input y emite intenciones por output.
 * El logo es UNA imagen reemplazable (`assets/logo-text-white.svg`), no SVG inline.
 */
@Component({
  selector: 'erp-navbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, UserMenu],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
})
export class Navbar {
  readonly userName = input.required<string>();
  readonly userRole = input<string>('');
  readonly tenantName = input<string>('');

  readonly toggleSidebar = output<void>();
  readonly openApps = output<void>();
  readonly userAction = output<UserMenuAction>();
  readonly logout = output<void>();
}
