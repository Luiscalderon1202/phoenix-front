import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ConfirmService } from './confirm-service';

/**
 * Outlet visual del servicio de confirmaciones: renderiza el diálogo cuando hay una confirmación
 * pendiente. Se monta UNA sola vez en el shell (`MainLayout`). Cancela con backdrop o Escape.
 */
@Component({
  selector: 'erp-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.scss',
  host: { '(document:keydown.escape)': 'onEscape()' },
})
export class ConfirmDialog {
  private readonly confirm = inject(ConfirmService);
  protected readonly pending = this.confirm.pending;

  protected accept(): void {
    this.confirm.resolve(true);
  }

  protected cancel(): void {
    this.confirm.resolve(false);
  }

  protected onEscape(): void {
    if (this.pending()) this.cancel();
  }
}
