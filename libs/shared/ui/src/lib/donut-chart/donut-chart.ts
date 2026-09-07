import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';

/** Un segmento de la dona: etiqueta, valor y color. */
export interface DonutDatum {
  label: string;
  value: number;
  color: string;
}

/** Segmento ya resuelto para el SVG (arco como `stroke-dasharray`/`stroke-dashoffset`). */
interface DonutArc extends DonutDatum {
  dash: number;
  offset: number;
  pct: number;
}

/**
 * Dona/anillo reutilizable, PRESENTACIONAL y sin dependencias (SVG puro).
 * Cada segmento es un `<circle>` con `stroke-dasharray` (longitud del arco) y `stroke-dashoffset`
 * (su inicio acumulado); el grupo rota -90° para arrancar arriba. Hereda el color de los datos,
 * así que se tematiza con los tokens de la app. Opcionalmente pinta una leyenda con porcentajes.
 *
 * Para gráficos más complejos (barras, líneas, interactividad) conviene una librería; esta dona
 * cubre el caso pie/donut con coste cero de bundle y buena salida en impresión.
 */
@Component({
  selector: 'erp-donut-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe],
  templateUrl: './donut-chart.html',
  styleUrl: './donut-chart.scss',
})
export class DonutChart {
  /** Segmentos a graficar (los de valor 0 no pintan arco pero sí aparecen en la leyenda). */
  readonly data = input.required<readonly DonutDatum[]>();
  /** Grosor del anillo en unidades del viewBox (0–60). */
  readonly thickness = input(20);
  /** Muestra la leyenda con color, etiqueta y porcentaje. */
  readonly legend = input(true);

  // viewBox fijo 0 0 120 120; el radio deja medio grosor de margen a cada lado.
  protected readonly r = computed(() => 50 - this.thickness() / 2);
  protected readonly circ = computed(() => 2 * Math.PI * this.r());

  /** Total para normalizar; 0 → 1 evita divisiones por cero (dona vacía). */
  protected readonly total = computed(() => {
    const t = this.data().reduce((acc, d) => acc + Math.max(0, d.value), 0);
    return t || 1;
  });

  /** Arcos acumulados: cada uno empieza donde terminó el anterior. */
  protected readonly arcs = computed<DonutArc[]>(() => {
    const circ = this.circ();
    const total = this.total();
    let acc = 0;
    return this.data().map((d) => {
      const frac = Math.max(0, d.value) / total;
      const arc: DonutArc = {
        ...d,
        dash: frac * circ,
        offset: -acc * circ,
        pct: frac * 100,
      };
      acc += frac;
      return arc;
    });
  });
}
