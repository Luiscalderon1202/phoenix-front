import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  contentChildren,
  input,
  linkedSignal,
  model,
  output,
  signal,
  TemplateRef,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Icon } from '../icon/icon';
import { LoadingOverlay } from '../loading-overlay/loading-overlay';
import { CellTemplate } from './cell-template';

/** Definición de columna: la tabla es data-driven, NO hardcodea columnas de ningún dominio. */
export interface GridColumn<T = unknown> {
  key: string;
  header?: string;
  /** @deprecated usar `header`; se mantiene por compatibilidad con listados existentes. */
  label?: string;
  align?: 'left' | 'right'; // 'right' para números
  width?: string;
  mono?: boolean; // fuente monospace (códigos de cuenta, etc.)
  sortable?: boolean;
  cell?: (row: T) => string; // formateo opcional de la celda
  /**
   * Contenido de esta columna en la fila de GRUPO (solo con `groupBy`): recibe las filas del
   * grupo y devuelve el texto agregado (normalmente un subtotal ya formateado). Sin definir,
   * la celda del grupo va vacía.
   */
  groupCell?: (rows: T[]) => string;
}

/** Grupo de filas contiguas que comparten el valor de la columna `groupBy`. */
export interface RowGroup<T = unknown> {
  /** Valor de `groupBy` (en texto): identifica al grupo y rotula su fila. */
  key: string;
  rows: T[];
}

/** Estado de ordenamiento: columna activa y sentido. */
interface SortState {
  key: string;
  dir: 'asc' | 'desc';
}

/** Valor crudo de la columna: se ordena por el dato, no por el texto que formatea `cell`. */
function fieldOf(row: unknown, key: string): unknown {
  return (row as Record<string, unknown>)[key];
}

/**
 * Comparador para el ordenamiento de cliente.
 *
 * Los vacíos se resuelven FUERA de la dirección: van al final tanto en ascendente como en
 * descendente. Si se multiplicaran por el sentido, al invertir el orden las filas sin dato
 * saltarían al principio, que es justo donde estorban.
 *
 * Los textos se comparan con `localeCompare` numérico: así "Ítem 10" queda después de "Ítem 9"
 * y las tildes no alteran el alfabeto.
 */
function comparatorFor(key: string, dir: 'asc' | 'desc'): (a: unknown, b: unknown) => number {
  const sign = dir === 'asc' ? 1 : -1;
  return (rowA, rowB) => {
    const a = fieldOf(rowA, key);
    const b = fieldOf(rowB, key);

    const aEmpty = a == null || a === '';
    const bEmpty = b == null || b === '';
    if (aEmpty || bEmpty) return aEmpty && bEmpty ? 0 : aEmpty ? 1 : -1;

    if (typeof a === 'number' && typeof b === 'number') return sign * (a - b);
    if (typeof a === 'boolean' && typeof b === 'boolean') return sign * (Number(a) - Number(b));
    return sign * String(a).localeCompare(String(b), 'es', { numeric: true, sensitivity: 'base' });
  };
}

/**
 * Grilla genérica del design system. Renderiza una `<table>` nativa (sin motor de terceros) y
 * expone una API propia por `GridColumn[]` + filas, estilada con los tokens del diseño. La
 * toolbar (búsqueda + iconbtns) es parte del componente.
 *
 * Ordenamiento: es de CLIENTE y opera sobre las filas recibidas — con paginación en servidor,
 * eso significa ordenar la página en curso, no el total. Es el comportamiento que ya tenía la
 * grilla; si algún listado necesita ordenar contra el backend, hay que añadir un `sortChange`.
 *
 * Agrupación: con `[groupBy]="'<clave>'"` las filas se reparten en grupos expandibles; la fila de
 * grupo lleva el valor de la clave en la primera columna y, en el resto, lo que devuelva el
 * `groupCell` de cada columna (subtotales). La columna agrupadora no se declara en `columns()`.
 *
 * Slots de proyección:
 *  - `<ng-template #gridFooter let-columns>`: fila(s) de totales (se inyecta en el `<tfoot>` de la
 *    tabla, así queda alineada con las columnas).
 *  - `[gridPagination]`: el `erp-grid-footer`, que se renderiza debajo de la tabla.
 */
@Component({
  selector: 'erp-data-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, Icon, LoadingOverlay],
  templateUrl: './data-grid.html',
  styleUrl: './data-grid.scss',
})
export class DataGrid<T = unknown> {
  readonly columns = input.required<GridColumn<T>[]>();
  readonly rows = input<T[]>([]);
  readonly loading = input(false);
  readonly density = model<'normal' | 'compact'>('normal');
  readonly searchText = model('');
  /** Activa/desactiva la fila de totales sin quitar la plantilla (p.ej. ocultarla si no hay datos). */
  readonly showTotals = input(true);
  /** Muestra la toolbar (búsqueda + iconbtns). Por defecto OCULTA: cada formulario la habilita. */
  readonly showToolbar = input(false);
  /** Activa la columna de checkboxes (selección de filas) al inicio. */
  readonly selectable = input(false);
  /** Activa el reordenamiento de filas por arrastre (handle en una columna propia al final). */
  readonly reorderable = input(false);
  /**
   * Agrupa las filas por esta clave (una fila de grupo expandible por valor distinto). La columna
   * agrupadora NO se declara en `columns()`: su valor rotula la fila de grupo. Los subtotales los
   * aporta cada columna con `groupCell`. No combinar con `reorderable` (el arrastre asume filas
   * planas). `null` (por defecto) = sin agrupar.
   */
  readonly groupBy = input<string | null>(null);
  /** Estado inicial de los grupos: colapsados (por defecto) o expandidos. */
  readonly groupsCollapsed = input(true);

  readonly rowClick = output<T>();
  readonly refresh = output<void>();
  /** Emite las filas seleccionadas cada vez que cambia la selección. */
  readonly selectionChange = output<T[]>();
  /** Emite el arreglo completo de filas en el NUEVO orden tras un arrastre. */
  readonly rowReorder = output<T[]>();

  // Orden de trabajo: copia editable del input que se resincroniza cuando cambian las `rows`,
  // así el arrastre no muta el arreglo del padre y podemos emitir el orden nuevo.
  private readonly value = linkedSignal<T[]>(() => [...this.rows()]);

  // ── Ordenamiento ────────────────────────────────────────────────────────
  /** Columna y sentido activos, o `null` si se respeta el orden de llegada. */
  protected readonly sort = signal<SortState | null>(null);

  /** Filas tal como se pintan: el orden de trabajo con el ordenamiento aplicado encima. */
  protected readonly viewRows = computed<T[]>(() => {
    const rows = this.value();
    const sort = this.sort();
    if (!sort) return rows;
    // Se copia antes de ordenar: `value` conserva el orden de llegada para poder volver a él.
    return [...rows].sort(comparatorFor(sort.key, sort.dir));
  });

  /** Alterna asc → desc → sin orden sobre la columna indicada. */
  protected toggleSort(key: string): void {
    this.sort.update((current) => {
      if (current?.key !== key) return { key, dir: 'asc' };
      return current.dir === 'asc' ? { key, dir: 'desc' } : null;
    });
  }

  protected ariaSortOf(col: GridColumn<T>): 'ascending' | 'descending' | 'none' | null {
    if (!col.sortable) return null;
    const sort = this.sort();
    if (sort?.key !== col.key) return 'none';
    return sort.dir === 'asc' ? 'ascending' : 'descending';
  }

  // ── Agrupación expandible ───────────────────────────────────────────────
  /**
   * Filas repartidas en grupos, o `null` si no hay `groupBy` (la tabla pinta filas planas).
   * Los grupos salen en orden de PRIMERA APARICIÓN sobre `viewRows`, así que el ordenamiento
   * de columna reordena tanto los grupos como las filas dentro de cada uno.
   */
  protected readonly groups = computed<RowGroup<T>[] | null>(() => {
    const key = this.groupBy();
    if (!key) return null;
    const buckets = new Map<string, T[]>();
    for (const row of this.viewRows()) {
      const value = String(fieldOf(row, key) ?? '');
      const bucket = buckets.get(value);
      if (bucket) bucket.push(row);
      else buckets.set(value, [row]);
    }
    return [...buckets].map(([groupKey, rows]) => ({ key: groupKey, rows }));
  });

  /**
   * Grupos abiertos. Se recalcula cuando cambian las filas o la clave de agrupación (datos
   * nuevos → estado inicial), pero NO al ordenar: se deriva de `rows()`, no de `groups()`.
   */
  private readonly expanded = linkedSignal<ReadonlySet<string>>(() => {
    const key = this.groupBy();
    if (!key || this.groupsCollapsed()) return new Set<string>();
    return new Set(this.rows().map((r) => String(fieldOf(r, key) ?? '')));
  });

  protected isExpanded(key: string): boolean {
    return this.expanded().has(key);
  }

  /** Todos los grupos abiertos (estado del botón "expandir/contraer todo" de la cabecera). */
  protected readonly allExpanded = computed(() => {
    const groups = this.groups();
    return !!groups?.length && groups.every((g) => this.expanded().has(g.key));
  });

  protected toggleGroup(key: string): void {
    const next = new Set(this.expanded());
    if (next.has(key)) next.delete(key);
    else next.add(key);
    this.expanded.set(next);
  }

  protected toggleAllGroups(): void {
    const groups = this.groups() ?? [];
    this.expanded.set(this.allExpanded() ? new Set<string>() : new Set(groups.map((g) => g.key)));
  }

  // ── Reordenamiento por arrastre (HTML5 nativo, igual que hacía p-table) ──
  private readonly dragFrom = signal<number | null>(null);
  /** Fila sobre la que se soltaría ahora mismo (para la guía visual). */
  protected readonly dropIndex = signal<number | null>(null);

  /**
   * Arma el arrastre al sujetar el handle, para que la fila no sea arrastrable al seleccionar
   * texto en cualquier celda.
   *
   * Se toca el DOM a mano a propósito: con change detection zoneless, un `[attr.draggable]`
   * enlazado a un signal se aplica en el siguiente ciclo, y el navegador ya habría decidido
   * que el elemento no es arrastrable. Tiene que ser síncrono dentro del pointerdown.
   */
  protected armDrag(event: Event, armed: boolean): void {
    (event.target as HTMLElement).closest('tr')?.setAttribute('draggable', String(armed));
  }

  protected onDragStart(index: number): void {
    this.dragFrom.set(index);
  }

  protected onDragOver(event: DragEvent, index: number): void {
    if (this.dragFrom() === null) return;
    event.preventDefault(); // sin esto el navegador no admite el drop
    this.dropIndex.set(index);
  }

  protected onDrop(event: DragEvent): void {
    const from = this.dragFrom();
    const to = this.dropIndex();
    if (from === null || to === null || from === to) return;
    event.preventDefault();

    const next = [...this.viewRows()];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    // El orden manual manda: se descarta el ordenamiento para que `value` sea lo que se ve.
    this.sort.set(null);
    this.value.set(next);
    this.rowReorder.emit(next);
  }

  protected onDragEnd(event: Event): void {
    (event.target as HTMLElement).closest('tr')?.removeAttribute('draggable');
    this.dragFrom.set(null);
    this.dropIndex.set(null);
  }

  /** Fila de totales opcional, proyectada por la página y renderizada en el `<tfoot>`. */
  protected readonly footerTpl = contentChild<TemplateRef<unknown>>('gridFooter');
  /** Columna de acciones (Editar/Eliminar/…) proyectada con `<ng-template #rowActions let-row>`. */
  protected readonly rowActionsTpl = contentChild<TemplateRef<unknown>>('rowActions');

  /** Plantillas de celda por columna proyectadas con `[erpCell]="'<key>'"`. */
  private readonly cellTemplates = contentChildren(CellTemplate);
  private readonly cellTemplateMap = computed(
    () => new Map(this.cellTemplates().map((t) => [t.erpCell(), t.template])),
  );

  /** El `<tfoot>` se muestra solo si la página proyecta `#gridFooter` y `showTotals` es true. */
  protected readonly showFooter = computed(() => !!this.footerTpl() && this.showTotals());

  protected readonly isEmpty = computed(() => !this.loading() && this.rows().length === 0);

  // ── Selección de filas (referencia de objeto) ───────────────────────────
  private readonly selected = signal<ReadonlySet<T>>(new Set<T>());

  /** La columna de acciones aparece solo si la página proyecta `#rowActions`. */
  protected readonly showActionsColumn = computed(() => !!this.rowActionsTpl());

  /** Nº de columnas reales (para el colspan de la fila vacía): datos + reorder + checkbox + acciones. */
  protected readonly colspan = computed(
    () =>
      this.columns().length +
      (this.reorderable() ? 1 : 0) +
      (this.selectable() ? 1 : 0) +
      (this.showActionsColumn() ? 1 : 0),
  );

  /** Todas las filas visibles están seleccionadas. */
  protected readonly allSelected = computed(() => {
    const rows = this.rows();
    const sel = this.selected();
    return rows.length > 0 && rows.every((r) => sel.has(r));
  });

  /** Selección parcial (una o más, pero no todas) → checkbox de cabecera en estado indeterminado. */
  protected readonly someSelected = computed(() => this.selected().size > 0 && !this.allSelected());

  protected isSelected(row: T): boolean {
    return this.selected().has(row);
  }

  protected toggleRow(row: T): void {
    const next = new Set(this.selected());
    if (next.has(row)) {
      next.delete(row);
    } else {
      next.add(row);
    }
    this.selected.set(next);
    this.selectionChange.emit([...next]);
  }

  protected toggleAll(): void {
    const next = this.allSelected() ? new Set<T>() : new Set<T>(this.rows());
    this.selected.set(next);
    this.selectionChange.emit([...next]);
  }

  protected headerOf(col: GridColumn<T>): string {
    return col.header ?? col.label ?? '';
  }

  /** Plantilla personalizada de la columna (o `undefined` para usar el texto por defecto). */
  protected cellTemplateFor(key: string): TemplateRef<unknown> | undefined {
    return this.cellTemplateMap().get(key);
  }

  protected cellValue(row: T, col: GridColumn<T>): string {
    if (col.cell) return col.cell(row);
    const value = (row as Record<string, unknown>)[col.key];
    return value == null ? '' : String(value);
  }

  protected toggleDensity(): void {
    this.density.update((d) => (d === 'compact' ? 'normal' : 'compact'));
  }
}
