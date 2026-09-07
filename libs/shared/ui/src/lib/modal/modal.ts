import { ChangeDetectionStrategy, Component, input, model, output, signal } from '@angular/core';
import { Icon } from '../icon/icon';

/**
 * Modal/diálogo del design system (sin PrimeNG). Presentacional y genérico: muestra un overlay
 * con un panel centrado. El contenido va por `<ng-content>` y las acciones por `[modalFooter]`.
 *
 * Abre/cierra con el two-way `open`. Cierra al pulsar el backdrop, la X o Escape, emitiendo `close`.
 * Con `[maximizable]="true"` añade un botón en la cabecera que expande el panel a pantalla completa.
 */
@Component({
  selector: 'erp-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  templateUrl: './modal.html',
  styleUrl: './modal.scss',
  host: { '(document:keydown.escape)': 'onEscape()' },
})
export class Modal {
  readonly open = model(false);
  readonly title = input('');
  /** Ancho del panel: 'md' (520px, por defecto) | 'lg' (900px) | 'xl' (1100px). */
  readonly size = input<'md' | 'lg' | 'xl'>('md');
  /** Muestra el botón de maximizar/restaurar en la cabecera. */
  readonly maximizable = input(false);
  readonly closed = output<void>();

  /** Panel a pantalla completa (solo si `maximizable`). */
  protected readonly maximized = signal(false);

  protected onClose(): void {
    this.open.set(false);
    this.maximized.set(false);
    this.closed.emit();
  }

  protected toggleMaximize(): void {
    this.maximized.update((m) => !m);
  }

  protected onEscape(): void {
    if (this.open()) this.onClose();
  }
}
