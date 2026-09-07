import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  forwardRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Icon } from '../icon/icon';

/** Valor primitivo aceptado como clave de una opción. */
export type ComboValue = string | number;

/**
 * Opción genérica: cualquier objeto del que se leen `bindValue`/`bindLabel`. Se usa `any` a
 * propósito para aceptar interfaces tipadas (p. ej. `Distrito[]`) sin exigir índice de string.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ComboItem = Record<string, any>;

/**
 * Combo con búsqueda (typeahead) que reemplaza a un `<select>` largo. Tiene la apariencia de un
 * combobox: un control con la etiqueta seleccionada + chevron; al hacer clic abre un panel con un
 * buscador y la lista filtrada en cliente (limitada a `maxVisible`, 5 por defecto).
 *
 * Implementa `ControlValueAccessor`, así que se usa igual que un input reactivo:
 *   <erp-combo-search formControlName="distritoid" [items]="distritos()"
 *       bindValue="distritoid" bindLabel="nombre" />
 *
 * El valor emitido/almacenado es el `bindValue` de la opción (number o string), o `null` al limpiar.
 */
@Component({
  selector: 'erp-combo-search',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  templateUrl: './combo-search.html',
  styleUrl: './combo-search.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ComboSearch),
      multi: true,
    },
  ],
})
export class ComboSearch implements ControlValueAccessor {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Lista completa de opciones; el filtrado es 100% en cliente. */
  readonly items = input<readonly ComboItem[]>([]);
  /** Propiedad de cada opción usada como valor del control. */
  readonly bindValue = input('id');
  /** Propiedad de cada opción que se muestra como etiqueta. */
  readonly bindLabel = input('nombre');
  /**
   * Propiedad sobre la que se filtra al escribir. Por defecto coincide con `bindLabel`; se
   * separa cuando la etiqueta es un texto compuesto (p. ej. "depto / prov / distrito") pero
   * la búsqueda debe limitarse a un campo más específico (p. ej. solo el distrito).
   */
  readonly bindSearch = input<string | null>(null);
  /** Texto cuando no hay selección. */
  readonly placeholder = input('Seleccionar…');
  /** Texto del buscador. */
  readonly searchPlaceholder = input('Buscar…');
  /** Máximo de opciones visibles a la vez (las primeras coincidencias). */
  readonly maxVisible = input(5);
  /** Muestra el buscador dentro del panel. Desactívalo en listas cortas (p. ej. sexo). */
  readonly searchable = input(true);
  /** Muestra el botón de limpiar selección. Desactívalo en campos obligatorios. */
  readonly clearable = input(true);

  /** Se emite al elegir o limpiar una opción (para efectos colaterales del consumidor). */
  readonly changed = output<ComboValue | null>();

  protected readonly open = signal(false);
  protected readonly query = signal('');
  protected readonly value = signal<ComboValue | null>(null);
  /** Índice resaltado dentro de la lista filtrada (navegación con teclado). */
  protected readonly active = signal(0);
  protected readonly disabled = signal(false);

  /** Coincidencias completas (acento-insensible) según el texto buscado. */
  private readonly matches = computed<readonly ComboItem[]>(() => {
    const q = normalize(this.query());
    if (!q) return this.items();
    const key = this.bindSearch() ?? this.bindLabel();
    return this.items().filter((it) => normalize(String(it[key] ?? '')).includes(q));
  });

  /**
   * Coincidencias recortadas a `maxVisible` (lo que se pinta). Sin buscador no hay forma de
   * filtrar, así que se muestran todas (el panel hace scroll) y no se recorta.
   */
  protected readonly filtered = computed(() =>
    this.searchable() ? this.matches().slice(0, this.maxVisible()) : this.matches(),
  );

  /** Cuántas coincidencias quedan fuera del recorte (para el aviso "+N más…"). */
  protected readonly hiddenCount = computed(() => this.matches().length - this.filtered().length);

  /** Etiqueta de la opción seleccionada, o `null` si no hay coincidencia (→ placeholder). */
  protected readonly selectedLabel = computed(() => {
    const v = this.value();
    if (v == null) return null;
    const valKey = this.bindValue();
    const found = this.items().find((it) => it[valKey] === v);
    return found ? String(found[this.bindLabel()]) : null;
  });

  // ── ControlValueAccessor ──────────────────────────────────────────
  private onChange: (v: ComboValue | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(v: ComboValue | null): void {
    this.value.set(v ?? null);
  }
  registerOnChange(fn: (v: ComboValue | null) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  // ── Interacción ───────────────────────────────────────────────────
  protected toggle(): void {
    if (this.disabled()) return;
    if (this.open()) this.close();
    else this.openPanel();
  }

  private openPanel(): void {
    this.open.set(true);
    this.query.set('');
    this.active.set(0);
    // Con buscador: foco al input en el próximo microtask (ya renderizado el panel).
    // Sin buscador: el foco permanece en el control, y la navegación con teclado
    // se gestiona por el (keydown) del contenedor.
    if (this.searchable()) {
      queueMicrotask(() =>
        this.host.nativeElement.querySelector<HTMLInputElement>('.combo__search-input')?.focus(),
      );
    }
  }

  protected close(): void {
    if (!this.open()) return;
    this.open.set(false);
    this.onTouched();
  }

  protected onQuery(e: Event): void {
    this.query.set((e.target as HTMLInputElement).value);
    this.active.set(0);
  }

  protected choose(item: ComboItem): void {
    const v = item[this.bindValue()] as ComboValue;
    this.value.set(v);
    this.onChange(v);
    this.changed.emit(v);
    this.close();
  }

  protected clear(e: Event): void {
    e.stopPropagation();
    this.value.set(null);
    this.onChange(null);
    this.changed.emit(null);
  }

  protected onKeydown(e: KeyboardEvent): void {
    if (!this.open()) return;
    const items = this.filtered();
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.active.update((i) => Math.min(i + 1, items.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.active.update((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (items[this.active()]) this.choose(items[this.active()]);
        break;
      case 'Escape':
        e.preventDefault();
        this.close();
        break;
    }
  }

  /** Cierra solo cuando el foco abandona el componente (no al pasar entre buscador y opciones). */
  protected onFocusOut(e: FocusEvent): void {
    const next = e.relatedTarget as Node | null;
    if (!next || !this.host.nativeElement.contains(next)) this.close();
  }
}

/** Minúsculas y sin acentos para comparar de forma laxa. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}
