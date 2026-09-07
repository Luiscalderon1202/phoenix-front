import { Injectable, signal } from '@angular/core';

export type NotificationKind = 'success' | 'error' | 'info' | 'warning';

/** Un mensaje (toast) en cola. Inmutable: el servicio reemplaza la lista, no muta items. */
export interface Notification {
  readonly id: number;
  readonly kind: NotificationKind;
  readonly text: string;
  /** Título opcional en negrita encima del texto. */
  readonly title?: string;
}

/** Opciones por mensaje. `duration` en ms; `0` = no se auto-cierra (sticky). */
export interface NotifyOptions {
  title?: string;
  duration?: number;
}

/**
 * Servicio de notificaciones (toasts) de la app. API imperativa y genérica: cualquier página
 * o servicio llama `notify.success(...)` / `.error(...)` y el `Toaster` (montado una vez en el
 * shell) los renderiza. No conoce dominios ni textos concretos.
 *
 * providedIn root: estado único compartido (mismo patrón que `UiPreferencesStore`).
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly _items = signal<readonly Notification[]>([]);
  /** Cola actual de toasts (la lee el `Toaster`). */
  readonly items = this._items.asReadonly();

  private seq = 0;
  /** Duración por defecto (ms) para mensajes informativos. */
  private static readonly DEFAULT_DURATION = 4500;
  /** Duración para errores (ms): algo más larga que la informativa, pero también se auto-cierra. */
  private static readonly ERROR_DURATION = 8000;

  success(text: string, opts?: NotifyOptions): number {
    return this.show('success', text, opts);
  }

  error(text: string, opts?: NotifyOptions): number {
    // Los errores se auto-cierran con una duración algo mayor que la informativa.
    return this.show('error', text, { duration: NotificationService.ERROR_DURATION, ...opts });
  }

  info(text: string, opts?: NotifyOptions): number {
    return this.show('info', text, opts);
  }

  warning(text: string, opts?: NotifyOptions): number {
    return this.show('warning', text, opts);
  }

  /** Encola un toast y programa su auto-cierre. Devuelve el id (para cerrarlo manualmente). */
  show(kind: NotificationKind, text: string, opts?: NotifyOptions): number {
    const id = ++this.seq;
    const note: Notification = { id, kind, text, title: opts?.title };
    this._items.update((list) => [...list, note]);

    const duration = opts?.duration ?? NotificationService.DEFAULT_DURATION;
    if (duration > 0) {
      setTimeout(() => this.dismiss(id), duration);
    }
    return id;
  }

  dismiss(id: number): void {
    this._items.update((list) => list.filter((n) => n.id !== id));
  }

  clear(): void {
    this._items.set([]);
  }
}
