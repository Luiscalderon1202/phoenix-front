import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { LoadingOverlay } from '../loading-overlay/loading-overlay';

/**
 * Región de contenido de un formulario/dashboard. Es la tercera pieza del patrón de página
 * (junto a `erp-page-header` y `erp-filter-panel`): aquí va TODO lo que muestra la pantalla
 * —tarjetas, paneles, gráficos, detalles— proyectado vía `<ng-content>`.
 *
 * PRESENTACIONAL: aporta el layout (columna con separación uniforme) y, en escritorio, ocupa el
 * alto restante bajo el header y el filtro con scroll propio. Con `[loading]` muestra un overlay
 * de carga que cubre solo esta región y bloquea la interacción mientras se consulta una API.
 */
@Component({
  selector: 'erp-form-content',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LoadingOverlay],
  template: `
    <div class="fc__scroll"><ng-content /></div>
    <erp-loading-overlay [show]="loading()" [label]="loadingLabel()" />
  `,
  styleUrl: './form-content.scss',
})
export class FormContent {
  /** Muestra el overlay de carga sobre el contenido (la página lo liga a su signal `loading`). */
  readonly loading = input(false);
  readonly loadingLabel = input('Cargando…');
}
