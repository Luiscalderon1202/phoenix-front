import { booleanAttribute, ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Breadcrumbs } from '../breadcrumbs/breadcrumbs';

/**
 * Encabezado de página: breadcrumbs (derivados de la ruta, vía `erp-breadcrumbs`) + título/subtítulo.
 * Genérico para cualquier pantalla.
 *
 * Las acciones (exportar/imprimir/etc.) NO viven aquí: cada formulario las maneja en su fila de
 * acciones (p.ej. el slot `[filterActions]` del `erp-filter-panel`). Si una página necesita
 * acciones en la cabecera, puede proyectarlas con `[headerActions]`.
 *
 * Las pantallas densas (dashboards, reportes) pueden ocultar los breadcrumbs con
 * `[breadcrumbs]="false"` para recuperar ese alto.
 */
@Component({
  selector: 'erp-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Breadcrumbs],
  templateUrl: './page-header.html',
  styleUrl: './page-header.scss',
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
  readonly breadcrumbs = input(true, { transform: booleanAttribute });
}
