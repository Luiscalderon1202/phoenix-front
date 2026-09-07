import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Capa de carga reutilizable: spinner sobre un fondo translúcido que bloquea la interacción.
 * Se posiciona absolute sobre el ancestro posicionado más cercano (el contenedor que lo use
 * debe ser `position: relative`), así cubre exactamente esa región sin tapar el resto.
 *
 * PRESENTACIONAL: la visibilidad la controla la página con su signal `loading` vía `[show]`.
 * Pensado para colgar dentro de `erp-form-content`, pero sirve en cualquier contenedor relativo.
 */
@Component({
  selector: 'erp-loading-overlay',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (show()) {
      <div
        class="overlay"
        [class.overlay--lg]="size() === 'lg'"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <span class="overlay__spinner" aria-hidden="true"></span>
        @if (label()) {
          <span class="overlay__label">{{ label() }}</span>
        }
      </div>
    }
  `,
  styleUrl: './loading-overlay.scss',
})
export class LoadingOverlay {
  readonly show = input(false);
  readonly label = input('Cargando…');
  /** `lg` = spinner/etiqueta más grandes y fondo más opaco; para bloquear regiones grandes (página completa). */
  readonly size = input<'md' | 'lg'>('md');
}
