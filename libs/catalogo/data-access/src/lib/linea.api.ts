import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiService, type PagedResult, type QueryParams } from '@phoenix/shared/http';
import type {
  Linea,
  LineaEstado,
  LineaInput,
  LineaListQuery,
  ResultadoLoteLinea,
} from '@phoenix/catalogo/domain';

/**
 * Aplana la query a los parámetros que viajan en la URL.
 *
 * `q` vacío se OMITE en vez de mandarse en blanco, y `buildHttpParams` solo descarta
 * `undefined`/`null`, así que la cadena vacía hay que quitarla aquí.
 *
 * ⚠ El tamaño de página viaja como `page_size`, en snake_case. No es `pageSize`.
 */
export function lineaQueryParams(query: LineaListQuery): QueryParams {
  const params: QueryParams = { page: query.page, page_size: query.page_size };
  const q = query.q?.trim();
  if (q) params['q'] = q;
  return params;
}

/**
 * Líneas de producto (`catalogo.linea`). Los OCHO endpoints del molde: CRUD, borrado en lote,
 * alternar estado y reordenar.
 *
 * ⚠ Exige el proceso `CAT-LINEA`, no `TABLAS-BASICAS`: es una opción de menú propia
 * (`basic.menuweb` 71, padre 70 «Catálogo»).
 *
 * ⚠ `GET /lineas` PAGINA EN SERVIDOR: devuelve `data[]` + `meta{page, page_size, total}`. Por
 * eso `list()` usa `getList` (que conserva la `meta`) y no `get`. En este módulo lo hacen
 * también marcas y laboratorios; grupos, colores y tallas traen el catálogo entero.
 *
 * ⚠ `reordenar` y el orden del listado los aporta la **migración 0009 de Phoenix**:
 * `catalogo.palinea_cambiar_orden` no existe y el `_leer` del legacy ordena por nombre a
 * fuego. `alternarEstado`, en cambio, sí es del legacy.
 *
 * Sin `reportePdf`: este recurso no tiene reporte.
 *
 * Las rutas son relativas a `API_BASE_URL` (`/api/v1`). El header `X-CSRF-Token` que exigen las
 * mutaciones lo pone el `csrf-interceptor`; aquí no se toca.
 */
@Injectable({ providedIn: 'root' })
export class LineaApi {
  private readonly api = inject(ApiService);
  private readonly base = '/lineas';

  /**
   * Una PÁGINA del catálogo, con su `meta`, ordenada por `orden` y, a igualdad, por nombre.
   *
   * El total sale de `catalogo.palinea_count(q)`, al que el backend pasa exactamente el mismo
   * `q` que al `_leer`: si se separasen, `meta.total` contaría un universo distinto al que se
   * muestra.
   *
   * Devuelve activas e inactivas: el stored procedure no filtra por estado.
   */
  list(query: LineaListQuery): Observable<PagedResult<Linea>> {
    return this.api.getList<Linea>(this.base, lineaQueryParams(query));
  }

  get(lineaid: number): Observable<Linea> {
    return this.api.get<Linea>(`${this.base}/${lineaid}`);
  }

  /**
   * Alta. Devuelve la línea guardada, con su id y el `orden` que le asignó la base.
   *
   * ⚠ Ese orden lo coloca el backend en un SEGUNDO PASO
   * (`phoenix.palinea_orden_al_final`), porque `catalogo.palinea_actualizar` inserta
   * `palinea_lastorder()` sin el `+1` de sus hermanas y toda alta nacería empatada con la
   * última.
   */
  create(input: LineaInput): Observable<Linea> {
    return this.api.post<Linea>(this.base, input);
  }

  /**
   * Edición. Ni `estado` ni `orden` viajan aquí: cada uno tiene su ruta. El stored procedure sí
   * recibe el estado, y el backend le devuelve el que la fila ya tenía.
   */
  update(lineaid: number, input: LineaInput): Observable<Linea> {
    return this.api.put<Linea>(`${this.base}/${lineaid}`, input);
  }

  /** Elimina (204). Falla con 409 si algún master la usa. */
  remove(lineaid: number): Observable<void> {
    return this.api.delete<void>(`${this.base}/${lineaid}`);
  }

  /**
   * Borrado en lote: UNA petición, no N. Responde 200 con el resultado por id porque el lote es
   * parcial por diseño. El backend acota a 200 ids.
   */
  removeLote(ids: readonly number[]): Observable<ResultadoLoteLinea[]> {
    return this.api.post<ResultadoLoteLinea[]>(`${this.base}/lote/eliminar`, { ids });
  }

  /**
   * Alterna el estado (activa ⇄ inactiva). Es un TOGGLE, no un setter: el backend hace
   * `set estado = not estado`, así que NO recibe el valor deseado y reintentar la petición
   * deshace el cambio. Devuelve el estado RESULTANTE.
   */
  alternarEstado(lineaid: number): Observable<LineaEstado> {
    return this.api.post<LineaEstado>(`${this.base}/${lineaid}/estado/alternar`, {});
  }

  /**
   * Persiste el orden de la lista. `ids` van en el orden deseado y `desde` es la posición
   * 1-based de la primera: el backend calcula `orden = posición + (desde-1)`.
   *
   * ⚠ Aquí `desde` pesa más que en los catálogos que pagina el cliente: este listado **pagina
   * en servidor**, así que el tramo visible casi nunca empieza en 1. Hay que enviar
   * `(page-1)*page_size + 1`.
   */
  reordenar(ids: readonly number[], desde = 1): Observable<void> {
    return this.api.patch<void>(`${this.base}/orden`, { ids, desde });
  }
}
