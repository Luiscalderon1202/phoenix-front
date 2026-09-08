import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiService, type QueryParams } from '@phoenix/shared/http';
import type {
  Color,
  ColorEstado,
  ColorFiltros,
  ColorInput,
  ResultadoLoteColor,
} from '@phoenix/catalogo/domain';

/**
 * Colores de producto (`catalogo.color`). Los OCHO endpoints del molde: CRUD, borrado en lote,
 * alternar estado y reordenar.
 *
 * ⚠ Exige el proceso `CAT-COLOR`, que en el legacy **no tenía fila en `basic.menuweb`**: al PHP
 * solo se llega por URL directa o desde el formulario de producto. La fila la crea Phoenix, con
 * el proceso que `Color.php` ya declaraba.
 *
 * ⚠ `list()` FILTRA en el servidor pero NO PAGINA: devuelve el catálogo completo, sin `meta`.
 * Por eso usa `get` y no `getList`. Tampoco filtra por estado: ese filtro es de cliente.
 *
 * ⚠ Es el único del tramo cuya familia de funciones está completa en el legacy: `reordenar`
 * apunta a `catalogo.pacolor_cambiar_orden`, que ya recibe `vstart`. Líneas y grupos
 * necesitaron la migración 0009.
 *
 * ⚠ Ni `create` ni `update` envían la columna `color` de la tabla: el backend la preserva sin
 * exponerla. Ver `Color` en `@phoenix/catalogo/domain`.
 *
 * Sin `reportePdf`: este recurso no tiene reporte.
 *
 * Las rutas son relativas a `API_BASE_URL` (`/api/v1`). El header `X-CSRF-Token` lo pone el
 * `csrf-interceptor`.
 */
@Injectable({ providedIn: 'root' })
export class ColorApi {
  private readonly api = inject(ApiService);
  private readonly base = '/colores';

  /**
   * Catálogo filtrado y COMPLETO —sin `meta`—, ya ordenado por `orden` desde el backend.
   *
   * Devuelve activos e inactivos. `q` vacío se omite: `?q=` no es «sin filtro», es un filtro
   * por la cadena vacía.
   */
  list(filtros: ColorFiltros = {}): Observable<Color[]> {
    const params: QueryParams = {};
    if (filtros.q?.trim()) params['q'] = filtros.q.trim();
    return this.api.get<Color[]>(this.base, params);
  }

  get(colorid: number): Observable<Color> {
    return this.api.get<Color>(`${this.base}/${colorid}`);
  }

  /** Alta. El backend deja el registro activo y le asigna `orden` (último+1); no se le mandan. */
  create(input: ColorInput): Observable<Color> {
    return this.api.post<Color>(this.base, input);
  }

  /**
   * Edición. Ni `estado` ni `orden` viajan aquí —cada uno tiene su ruta— ni la columna `color`,
   * que el backend relee y le devuelve al stored procedure intacta. En el legacy cada guardado
   * la borraba.
   */
  update(colorid: number, input: ColorInput): Observable<Color> {
    return this.api.put<Color>(`${this.base}/${colorid}`, input);
  }

  /** Elimina (204). Falla con 409 si algún producto lo usa. */
  remove(colorid: number): Observable<void> {
    return this.api.delete<void>(`${this.base}/${colorid}`);
  }

  /**
   * Borrado en lote: UNA petición, no N. Responde 200 con el resultado por id porque el lote es
   * parcial por diseño. El backend acota a 200 ids.
   */
  removeLote(ids: readonly number[]): Observable<ResultadoLoteColor[]> {
    return this.api.post<ResultadoLoteColor[]>(`${this.base}/lote/eliminar`, { ids });
  }

  /**
   * Alterna el estado (activo ⇄ inactivo). Es un TOGGLE, no un setter: reintentar la petición
   * deshace el cambio. Devuelve el estado RESULTANTE.
   */
  alternarEstado(colorid: number): Observable<ColorEstado> {
    return this.api.post<ColorEstado>(`${this.base}/${colorid}/estado/alternar`, {});
  }

  /**
   * Persiste el orden de la lista. `ids` van en el orden deseado y `desde` es la posición
   * 1-based de la primera: el backend calcula `orden = posición + (desde-1)`.
   *
   * ⚠ El backend RECHAZA el lote entero (422 `color_reserved_id`) si algún id es menor o igual
   * que 0: el stored procedure del legacy no protege la fila centinela, y filtrar el id aquí
   * desplazaría la posición de todos los que van detrás.
   */
  reordenar(ids: readonly number[], desde = 1): Observable<void> {
    return this.api.patch<void>(`${this.base}/orden`, { ids, desde });
  }
}
