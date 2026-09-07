import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { ICON_REGISTRY } from './icon-registry';

/**
 * Icono del design system: `<erp-icon name="home" />`.
 *
 * Resuelve el `name` contra `ICON_REGISTRY` (único lugar con SVGs inline). El tamaño y el color
 * los hereda del contenedor: el SVG usa `currentColor` y `1em` de caja, así que basta envolverlo
 * en texto del color/tamaño deseado.
 */
@Component({
  selector: 'erp-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="erp-icon" [innerHTML]="svg()"></span>`,
  styles: [
    `
      .erp-icon {
        display: inline-flex;
        width: 1em;
        height: 1em;
        line-height: 0;
      }
      .erp-icon ::ng-deep svg {
        width: 100%;
        height: 100%;
        display: block;
      }
    `,
  ],
})
export class Icon {
  readonly name = input.required<string>();
  private readonly sanitizer = inject(DomSanitizer);

  // NOTA: bypassSecurityTrustHtml es seguro AQUÍ porque el contenido es una CONSTANTE interna
  // (ICON_REGISTRY), nunca datos del usuario o del backend. Si el nombre no existe, cae a 'doc'.
  protected readonly svg = computed(() =>
    this.sanitizer.bypassSecurityTrustHtml(ICON_REGISTRY[this.name()] ?? ICON_REGISTRY['doc']),
  );
}
