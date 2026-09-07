import { ChangeDetectionStrategy, Component, ElementRef, inject, input, signal } from '@angular/core';
import { output } from '@angular/core';
import { Icon } from '../icon/icon';

export type ExportFormat = 'excel' | 'csv';

/** Elección del menú: formato + si es la variante "detalle" (con `[detalle]=true`). */
export interface ExportChoice {
  formato: ExportFormat;
  detalle: boolean;
}

/** Opción personalizada del menú: reemplaza la lista Excel/CSV por una a medida. */
export interface ExportMenuOption {
  /** Texto del ítem. */
  label: string;
  /** Valor que se emite por `(seleccion)` al elegir. */
  value: string;
  /** Icono del registry (por defecto 'excel'). */
  icon?: string;
}

/**
 * Menú de exportación (dropdown). Presentacional: emite la elección; la página resuelve la
 * descarga real. Se cierra al elegir una opción o al perder el foco.
 *
 * Dos modos:
 *  - Por defecto: opciones Excel/CSV (+ "detalle" con `[detalle]="true"`), emite `(exportar)`.
 *  - Con `[options]`: lista a medida, emite el `value` elegido por `(seleccion)`.
 */
@Component({
  selector: 'erp-export-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  templateUrl: './export-menu.html',
  styleUrl: './export-menu.scss',
})
export class ExportMenu {
  private readonly host = inject(ElementRef<HTMLElement>);

  /** Muestra además las opciones "Excel detalle" / "CSV detalle". */
  readonly detalle = input(false);

  /** Lista de opciones a medida; si se define, reemplaza la lista Excel/CSV por defecto. */
  readonly options = input<readonly ExportMenuOption[] | null>(null);

  readonly exportar = output<ExportChoice>();
  /** Emite el `value` de la opción elegida (modo `[options]`). */
  readonly seleccion = output<string>();

  protected readonly open = signal(false);

  protected toggle(): void {
    this.open.update((v) => !v);
  }

  protected close(): void {
    this.open.set(false);
  }

  /**
   * Cierra SOLO si el foco sale del menú. Si no, al hacer clic en un ítem el `focusout` del botón
   * cerraría el `@if` y borraría el ítem antes de que su `click` dispare `choose()` → no exportaba.
   */
  protected onFocusOut(e: FocusEvent): void {
    const next = e.relatedTarget as Node | null;
    if (!next || !this.host.nativeElement.contains(next)) this.close();
  }

  protected choose(formato: ExportFormat, detalle: boolean): void {
    this.exportar.emit({ formato, detalle });
    this.close();
  }

  protected chooseOption(value: string): void {
    this.seleccion.emit(value);
    this.close();
  }
}
