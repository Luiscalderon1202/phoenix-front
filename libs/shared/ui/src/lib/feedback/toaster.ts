import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Icon } from '../icon/icon';
import { NotificationKind, NotificationService } from './notification-service';

/**
 * Outlet visual de las notificaciones: renderiza la pila de toasts que mantiene el
 * `NotificationService`. Se monta UNA sola vez en el shell de la app (`MainLayout`).
 * Presentacional: no decide qué se muestra, solo cómo.
 */
@Component({
  selector: 'erp-toaster',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  templateUrl: './toaster.html',
  styleUrl: './toaster.scss',
})
export class Toaster {
  private readonly notifications = inject(NotificationService);
  protected readonly items = this.notifications.items;

  /** Icono por tipo de mensaje. */
  protected iconOf(kind: NotificationKind): string {
    switch (kind) {
      case 'success':
        return 'check-circle';
      case 'error':
        return 'x-circle';
      case 'warning':
        return 'alert-triangle';
      case 'info':
        return 'info';
    }
  }

  protected dismiss(id: number): void {
    this.notifications.dismiss(id);
  }
}
