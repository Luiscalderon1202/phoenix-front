import { Directive, inject, input, TemplateRef } from '@angular/core';

/**
 * Plantilla de celda personalizada por columna del `erp-data-grid`.
 *
 * Uso en la página:
 * ```html
 * <erp-data-grid [columns]="cols" [rows]="rows()">
 *   <ng-template [erpCell]="'estado'" let-row let-col="column">
 *     <span class="badge">{{ row.estado }}</span>
 *   </ng-template>
 * </erp-data-grid>
 * ```
 * Si una columna no tiene plantilla, el grid usa el texto por defecto (`cell` o el valor crudo).
 */
@Directive({ selector: '[erpCell]' })
export class CellTemplate {
  /** Clave de la columna a la que aplica esta plantilla (debe coincidir con `GridColumn.key`). */
  readonly erpCell = input.required<string>();
  readonly template = inject<TemplateRef<unknown>>(TemplateRef);
}
