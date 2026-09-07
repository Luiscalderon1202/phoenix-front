import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { Icon } from '../icon/icon';

/** Acciones del menú de cuenta que NO son navegación directa (las resuelve el contenedor). */
export type UserMenuAction = 'profile' | 'messages' | 'resources' | 'settings' | 'help';

/**
 * Chip de usuario + dropdown de cuenta (presentacional).
 *
 * Grupos del diseño: [Mis datos · Mensajes · Mis Recursos] · [Configuración · Salir] · [Ayuda].
 * Se cierra con click-outside y con Escape. No navega ni cierra sesión por sí mismo: emite
 * `action`/`logout` y el contenedor (layout) decide.
 */
@Component({
  selector: 'erp-user-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  templateUrl: './user-menu.html',
  styleUrl: './user-menu.scss',
})
export class UserMenu {
  readonly userName = input.required<string>();
  readonly userRole = input<string>('');

  readonly action = output<UserMenuAction>();
  readonly logout = output<void>();

  protected readonly open = signal(false);
  private readonly host = inject(ElementRef<HTMLElement>);

  protected toggle(): void {
    this.open.update((v) => !v);
  }

  protected emit(action: UserMenuAction): void {
    this.action.emit(action);
    this.open.set(false);
  }

  protected onLogout(): void {
    this.logout.emit();
    this.open.set(false);
  }

  /** Iniciales para el avatar cuando no hay imagen. */
  protected initials(): string {
    return this.userName()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('');
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.open.set(false);
  }
}
