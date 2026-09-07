import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  input,
  untracked,
  viewChild,
  type InputSignal,
  type Signal,
} from '@angular/core';
import { Chart as ChartJS, registerables } from 'chart.js';
import type {
  ChartConfiguration,
  ChartData,
  ChartOptions,
  ChartType,
  Plugin,
} from 'chart.js';

// Autorregistro de Chart.js al cargar este chunk. Se hace AQUÍ (no en app.config con
// provideCharts) a propósito: así Chart.js solo entra en los bundles lazy que importen
// `erp-chart`, y no en el main que cargan todas las pantallas.
ChartJS.register(...registerables);

/**
 * Envoltorio reutilizable sobre Chart.js para los gráficos del ERP (barras, líneas, etc.).
 * PRESENTACIONAL: recibe `type`/`data`/`options` y los pasa a la instancia de Chart.js,
 * aplicando defaults responsive. El contenedor controla el tamaño (el canvas llena `:host`),
 * por eso `maintainAspectRatio:false`.
 *
 * Instancia Chart.js directamente (sin ng2-charts): el `type` (re)crea el gráfico y los
 * cambios de `data`/`options`/`plugins` se aplican en sitio con `chart.update()` para
 * conservar las animaciones sin recrear el canvas.
 *
 * Para donas/pie seguimos usando `erp-donut-chart` (SVG): más nítido e imprimible. Este
 * wrapper es para lo que el SVG a mano no cubre cómodamente.
 */
@Component({
  selector: 'erp-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<canvas #canvas></canvas>',
  styleUrl: './chart.scss',
})
export class Chart {
  readonly type = input.required<ChartType>();
  readonly data = input.required<ChartData>();
  // Tipos anotados explícitamente: los typings de Chart.js expanden `ChartOptions`/`Plugin`
  // a rutas internas (chart.js/dist/types/…) que no se pueden nombrar al emitir el .d.ts (TS2742).
  readonly options: InputSignal<ChartOptions> = input<ChartOptions>({});
  /** Plugins inline por-gráfico (p. ej. dibujar el total encima de cada barra apilada). */
  readonly plugins: InputSignal<Plugin[]> = input<Plugin[]>([]);

  private readonly canvas =
    viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private chart?: ChartJS;

  /** Defaults responsive; la página puede sobreescribirlos vía `options`. */
  protected readonly mergedOptions: Signal<ChartOptions> = computed<ChartOptions>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    ...this.options(),
  }));

  constructor() {
    // (Re)crea la instancia cuando cambian `type` o `plugins` (ambos estructurales: Chart.js
    // expone `config.plugins` como solo-lectura, así que un cambio de plugins exige recrear,
    // no mutar). Los valores iniciales de data/options se leen sin rastrear: sus cambios los
    // aplica el segundo effect en sitio, sin recrear el canvas.
    effect((onCleanup) => {
      const canvas = this.canvas().nativeElement;
      const chart = new ChartJS(canvas, {
        type: this.type(),
        data: untracked(this.data),
        options: untracked(this.mergedOptions),
        plugins: this.plugins(),
      } as ChartConfiguration);
      this.chart = chart;
      onCleanup(() => {
        chart.destroy();
        this.chart = undefined;
      });
    });

    // Actualiza en sitio cuando cambian data/options (sin recrear el canvas → conserva
    // animaciones). Los plugins NO se tocan aquí: los maneja el effect de creación.
    effect(() => {
      const data = this.data();
      const options = this.mergedOptions();
      const chart = this.chart;
      if (!chart) return;
      chart.data = data;
      chart.options = options;
      chart.update();
    });
  }
}
