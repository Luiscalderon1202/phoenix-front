import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { Icon } from '../icon/icon';

/**
 * Contenedor de filtros COLAPSABLE y genérico. No conoce los campos ni los botones concretos:
 * la página proyecta los campos (`<ng-content>`) y los botones de acción (`[filterActions]`).
 * Así cada formulario decide sus acciones (Buscar, Exportar, Imprimir, Limpiar, u otras).
 *
 * Presentacional puro: solo aporta el chrome colapsable y recuerda su estado por two-way
 * `collapsed` (la página puede persistirlo en `UiPreferencesStore`).
 *
 * Con `head=false` se oculta la cabecera colapsable y el panel queda siempre expandido
 * (útil cuando los filtros se embeben dentro de un formulario que ya tiene su propio título).
 */
@Component({
  selector: 'erp-filter-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  templateUrl: './filter-panel.html',
  styleUrl: './filter-panel.scss',
})
export class FilterPanel {
  readonly title = input('Filtros');
  readonly head = input(true);
  readonly collapsed = model(false);

  protected toggle(): void {
    this.collapsed.update((v) => !v);
  }
}
