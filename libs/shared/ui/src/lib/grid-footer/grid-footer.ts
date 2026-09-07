import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { PageMeta } from '@phoenix/shared/api';
import { EMPTY_META } from '@phoenix/shared/api';

/** Token de elipsis en la ventana de páginas. */
const GAP = '…' as const;
type PageItem = number | typeof GAP;

/**
 * Pie de grilla: "Mostrando X–Y de N", selector de tamaño de página y paginador con ventana
 * de páginas (elipsis). Presentacional: emite `pageChange`/`pageSizeChange`; la página recarga.
 */
@Component({
  selector: 'erp-grid-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './grid-footer.html',
  styleUrl: './grid-footer.scss',
})
export class GridFooter {
  readonly meta = input<PageMeta>(EMPTY_META);
  readonly pageSizes = input<number[]>([10, 25, 50, 100]);

  readonly pageChange = output<number>();
  readonly pageSizeChange = output<number>();

  /** Rango "desde–hasta de total" derivado de la meta. */
  protected readonly range = computed(() => {
    const { page, pageSize, total } = this.meta();
    if (total === 0) return { from: 0, to: 0, total };
    // pageSize <= 0 representa "All": una sola página con todo.
    if (pageSize <= 0) return { from: 1, to: total, total };
    const from = (page - 1) * pageSize + 1;
    const to = Math.min(page * pageSize, total);
    return { from, to, total };
  });

  protected readonly canPrev = computed(() => this.meta().page > 1);
  protected readonly canNext = computed(() => this.meta().page < this.meta().totalPages);

  /** Ventana de páginas con elipsis: [1, …, 4, 5, 6, …, 20]. */
  protected readonly pages = computed<PageItem[]>(() => {
    const { page, totalPages } = this.meta();
    if (totalPages <= 1) return [1];

    const window = new Set<number>([1, totalPages, page, page - 1, page + 1]);
    const sorted = [...window].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);

    const items: PageItem[] = [];
    let prev = 0;
    for (const p of sorted) {
      if (p - prev > 1) items.push(GAP);
      items.push(p);
      prev = p;
    }
    return items;
  });

  protected isGap(item: PageItem): boolean {
    return item === GAP;
  }

  protected go(page: number): void {
    const { totalPages } = this.meta();
    if (page >= 1 && page <= totalPages && page !== this.meta().page) {
      this.pageChange.emit(page);
    }
  }

  protected prev(): void {
    if (this.canPrev()) this.pageChange.emit(this.meta().page - 1);
  }

  protected next(): void {
    if (this.canNext()) this.pageChange.emit(this.meta().page + 1);
  }
}
