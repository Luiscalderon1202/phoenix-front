import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LEGACY_BASE_URL } from '@phoenix/shared/http';
import { Icon, PageHeader } from '@phoenix/shared/ui';
import { GRUPOS_TABLAS, type GrupoTablas, type OpcionTabla } from './tablas';

/** Opción ya resuelta para pintar: se sabe si es interna y cuál es su destino final. */
interface OpcionVista extends OpcionTabla {
  /** `true` si navega dentro de Angular; `false` si sale al PHP. */
  readonly migrada: boolean;
  /** Destino definitivo: `ruta` tal cual, o el `.php` con la raíz del legacy delante. */
  readonly destino: string;
}

interface GrupoVista extends Omit<GrupoTablas, 'opciones'> {
  readonly opciones: readonly OpcionVista[];
}

/**
 * Lanzador de **Tablas básicas**: el índice de los 40 catálogos del ERP, agrupados como en
 * `TablasBasicas.php`. No administra datos, solo enruta.
 *
 * Es la pieza que hace conmutable el interruptor strangler de esta parte del sistema. El
 * mecanismo (`basic.menuweb.ruta_phoenix`) trabaja por FILA DE MENÚ, y la fila 58 no es una
 * pantalla sino la puerta a estas 40 tablas: apuntarla directamente a una sola de ellas
 * dejaría sin acceso a las otras 39. Con este hub se conmuta la fila una vez y luego se migra
 * tabla a tabla por dentro, cambiando `legacy` por `ruta` en `tablas.ts`.
 *
 * Las no migradas salen al PHP con navegación completa de página, igual que hace el menú
 * lateral, y se marcan con ↗ para que nadie se sorprenda al salir del Angular.
 */
@Component({
  selector: 'erp-tablas-basicas-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, PageHeader, Icon],
  templateUrl: './tablas-basicas-page.html',
  styleUrl: './tablas-basicas-page.scss',
})
export class TablasBasicasPage {
  /** Vacío = el legacy vive en el mismo host y basta la ruta absoluta. */
  private readonly legacyBase = inject(LEGACY_BASE_URL);

  /** Filtro por nombre: con 40 tarjetas, buscar a ojo cansa. */
  protected readonly busqueda = signal('');

  private readonly grupos = computed<GrupoVista[]>(() =>
    GRUPOS_TABLAS.map((g) => ({
      ...g,
      opciones: g.opciones.map((o) => ({
        ...o,
        migrada: !!o.ruta,
        destino: o.ruta ?? `${this.legacyBase}${o.legacy ?? ''}`,
      })),
    })),
  );

  /**
   * Grupos que se pintan. Un grupo sin opciones que casen desaparece entero, para no dejar
   * encabezados huérfanos sobre un hueco.
   */
  protected readonly gruposVisibles = computed<GrupoVista[]>(() => {
    const texto = this.busqueda().trim().toLocaleLowerCase('es');
    if (!texto) return this.grupos();

    return this.grupos()
      .map((g) => ({
        ...g,
        // Se busca también en el nombre del grupo: quien escribe "tesorería" espera ver
        // sus cinco tablas, aunque ninguna se llame así.
        opciones: g.titulo.toLocaleLowerCase('es').includes(texto)
          ? g.opciones
          : g.opciones.filter(
              (o) =>
                o.titulo.toLocaleLowerCase('es').includes(texto) ||
                o.descripcion.toLocaleLowerCase('es').includes(texto),
            ),
      }))
      .filter((g) => g.opciones.length > 0);
  });

  protected readonly sinResultados = computed(() => this.gruposVisibles().length === 0);

  /** Cuántas tablas están migradas, para no tener que contarlas a ojo en la pantalla. */
  protected readonly avance = computed(() => {
    const todas = GRUPOS_TABLAS.flatMap((g) => g.opciones);
    return { migradas: todas.filter((o) => o.ruta).length, total: todas.length };
  });

  protected onBuscar(valor: string): void {
    this.busqueda.set(valor);
  }

  protected onLimpiar(): void {
    this.busqueda.set('');
  }
}
