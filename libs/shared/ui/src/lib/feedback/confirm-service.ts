import { Injectable, signal } from '@angular/core';

/** Opciones de un diálogo de confirmación. Solo `message` es obligatorio. */
export interface ConfirmOptions {
  message: string;
  title?: string;
  confirmText?: string;
  cancelText?: string;
  /** `danger` pinta el botón de confirmar en rojo (acciones destructivas: eliminar, etc.). */
  tone?: 'default' | 'danger';
}

/** Estado interno: las opciones resueltas + el `resolve` de la promesa pendiente. */
export interface PendingConfirm extends Required<Omit<ConfirmOptions, 'tone'>> {
  tone: 'default' | 'danger';
  resolve: (ok: boolean) => void;
}

/**
 * Servicio de confirmaciones. Reemplaza el `confirm()` nativo por un diálogo del design system.
 * Uso: `if (await confirm.ask({ message: '¿Eliminar?' , tone: 'danger' })) { ... }`.
 *
 * Mantiene una sola confirmación pendiente a la vez (la UI es modal). El `ConfirmDialog`
 * (montado una vez en el shell) la renderiza y llama `resolve()`.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly _pending = signal<PendingConfirm | null>(null);
  /** Confirmación pendiente (la lee el `ConfirmDialog`), o `null` si no hay ninguna. */
  readonly pending = this._pending.asReadonly();

  /** Abre el diálogo y resuelve `true` (confirmar) o `false` (cancelar / cerrar). */
  ask(options: ConfirmOptions): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this._pending.set({
        message: options.message,
        title: options.title ?? 'Confirmar',
        confirmText: options.confirmText ?? 'Aceptar',
        cancelText: options.cancelText ?? 'Cancelar',
        tone: options.tone ?? 'default',
        resolve,
      });
    });
  }

  /** Lo llama el diálogo al aceptar/cancelar: cierra y resuelve la promesa pendiente. */
  resolve(ok: boolean): void {
    const pending = this._pending();
    if (!pending) return;
    this._pending.set(null);
    pending.resolve(ok);
  }
}
