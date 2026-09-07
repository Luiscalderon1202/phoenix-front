import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Un filtro aplicado, ya resuelto a etiqueta legible, para el encabezado de impresión. */
export interface PrintField {
  label: string;
  value: string;
}

/**
 * Encabezado SOLO para impresión: título del reporte, los filtros aplicados y la fecha.
 * Oculto en pantalla (`display:none`); visible únicamente en `@media print`.
 *
 * Se coloca DENTRO del contenedor que se imprime (junto al dashboard) para reemplazar al
 * `erp-filter-panel`, que cada reporte oculta al imprimir. Los reportes pasan los filtros ya
 * resueltos a etiqueta (empresa, entidad, periodo…) tomados del snapshot de la última consulta,
 * no del filtro vivo, para que el impreso refleje lo consultado.
 */
@Component({
  selector: 'erp-print-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './print-header.html',
  styleUrl: './print-header.scss',
})
export class PrintHeader {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
  readonly fields = input<readonly PrintField[]>([]);

  /** Fecha de impresión (es-PE). El día es estable para una impresión en el momento. */
  protected readonly fecha = new Date().toLocaleDateString('es-PE', { dateStyle: 'long' });
}
