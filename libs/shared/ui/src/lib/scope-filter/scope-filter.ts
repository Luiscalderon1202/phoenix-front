import { ChangeDetectionStrategy, Component, effect, input, model } from '@angular/core';
import type { CatalogoItem } from '@phoenix/shared/domain';

/** Campos posibles del filtro de alcance/periodo. */
export type ScopeField =
  | 'empresa'
  | 'entidad'
  | 'sede'
  | 'fondo'
  | 'anio'
  | 'mes';

/** Valor seleccionado: solo incluye los campos visibles. */
export type ScopeFilterValue = Partial<Record<ScopeField, number>>;

const ETIQUETAS: Record<ScopeField, string> = {
  empresa: 'Empresa',
  entidad: 'Entidad',
  sede: 'Sede',
  fondo: 'Fondo',
  anio: 'Año',
  mes: 'Mes',
};

// Hijos que se limpian al cambiar el padre (cascada). fondo/anio/mes son independientes.
const HIJOS: Partial<Record<ScopeField, ScopeField[]>> = {
  empresa: ['entidad', 'sede'],
  entidad: ['sede'],
};

/**
 * Id preseleccionado por campo cuando está vacío (si existe entre sus opciones; si no, cae al
 * primero). Por defecto el fondo arranca en 10 (Fondo Operacional) en TODAS las páginas que usen
 * el campo `fondo`. Una página puede sobreescribirlo con `[defaults]`.
 */
export const SCOPE_FIELD_DEFAULTS: Partial<Record<ScopeField, number>> = { fondo: 10 };

/**
 * Filtro reutilizable de alcance organizativo + periodo. PRESENTACIONAL y config-driven:
 * la página le pasa las opciones de cada campo (desde sus stores) y recibe el valor por two-way.
 *
 * El componente conoce la jerarquía (empresa raíz; entidad cuelga de empresa; sede de
 * entidad o de empresa) y encapsula lo repetitivo: layout, default al primer ítem y reset en
 * cascada. Para `anio`/`mes` actuales, la página pre-siembra `valor` (p. ej. `{ mes: 6 }`).
 *
 * Se proyecta dentro de `erp-filter-panel`; `:host { display: contents }` deja que cada `.field`
 * sea ítem directo del grid de 12 columnas del panel.
 */
@Component({
  selector: 'erp-scope-filter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './scope-filter.html',
  styleUrl: './scope-filter.scss',
})
export class ScopeFilter {
  /** Campos a mostrar, en orden. */
  readonly campos = input.required<ScopeField[]>();

  readonly empresas = input<readonly CatalogoItem[]>([]);
  readonly entidades = input<readonly CatalogoItem[]>([]);
  readonly sedes = input<readonly CatalogoItem[]>([]);
  readonly fondos = input<readonly CatalogoItem[]>([]);
  readonly anios = input<readonly CatalogoItem[]>([]);
  readonly meses = input<readonly CatalogoItem[]>([]);

  /** Valor seleccionado (two-way). */
  readonly valor = model<ScopeFilterValue>({});

  /** Id preseleccionado por campo (sobre el primer ítem). Por defecto `{ fondo: 10 }`. */
  readonly defaults = input<Partial<Record<ScopeField, number>>>(SCOPE_FIELD_DEFAULTS);

  /**
   * Ancho de cada campo en columnas del grid de 12 de `erp-filter-panel` (aplica la clase
   * `f-N`). Sin valor, el campo usa el ancho por defecto del panel (3 columnas).
   */
  readonly anchos = input<Partial<Record<ScopeField, number>>>({});

  protected readonly etiquetas = ETIQUETAS;

  protected anchoClase(campo: ScopeField): string {
    const n = this.anchos()[campo];
    return n ? `f-${n}` : '';
  }

  constructor() {
    // Default por campo vacío en cuanto llegan sus opciones: usa el id de `defaults` si existe
    // entre las opciones; si no, el primer ítem. Cubre empresa, la cascada al recomputarse
    // (entidad/sede), año y el fondo (10 por defecto). El mes actual lo pre-siembra
    // la página en `valor`.
    effect(() => {
      const next = { ...this.valor() };
      const defaults = this.defaults();
      let changed = false;
      for (const campo of this.campos()) {
        if (next[campo] == null) {
          const opts = this.opciones(campo);
          if (opts.length) {
            const preferido = defaults[campo];
            next[campo] =
              preferido != null && opts.some((o) => o.value === preferido)
                ? preferido
                : opts[0].value;
            changed = true;
          }
        }
      }
      if (changed) this.valor.set(next);
    });
  }

  protected opciones(campo: ScopeField): readonly CatalogoItem[] {
    switch (campo) {
      case 'empresa':
        return this.empresas();
      case 'entidad':
        return this.entidades();
      case 'sede':
        return this.sedes();
      case 'fondo':
        return this.fondos();
      case 'anio':
        return this.anios();
      case 'mes':
        return this.meses();
    }
  }

  protected onSelect(campo: ScopeField, raw: string): void {
    const next: ScopeFilterValue = { ...this.valor() };
    if (raw === '') delete next[campo];
    else next[campo] = Number(raw);
    // Limpia los hijos en cascada (el `effect` les vuelve a poner su primer ítem válido).
    for (const hijo of HIJOS[campo] ?? []) delete next[hijo];
    this.valor.set(next);
  }
}
