import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiService, type PagedResult, type QueryParams } from '@phoenix/shared/http';
import type {
  Laboratorio,
  LaboratorioInput,
  LaboratorioListQuery,
  ResultadoLoteLaboratorio,
} from '@phoenix/catalogo/domain';

/**
 * Aplana la query a los parámetros que viajan en la URL. `q` vacío se OMITE.
 *
 * ⚠ El tamaño de página viaja como `page_size`, en snake_case. No es `pageSize`.
 */
export function laboratorioQueryParams(query: LaboratorioListQuery): QueryParams {
  const params: QueryParams = { page: query.page, page_size: query.page_size };
  const q = query.q?.trim();
  if (q) params['q'] = q;
  return params;
}

/**
 * Laboratorios (`catalogo.laboratorio`). CRUD completo y borrado en lote.
 *
 * ⚠ Exige el proceso `CAT-LABORATORIO`, no `TABLAS-BASICAS`: es una opción de menú propia
 * (`basic.menuweb` 91, padre 70 «Catálogo»).
 *
 * ⚠ `GET /laboratorios` PAGINA EN SERVIDOR: devuelve `data[]` + `meta`. Por eso `list()` usa
 * `getList` y no `get`.
 *
 * SEIS endpoints, no ocho: no hay `/{id}/estado/alternar` ni `PATCH /orden`, porque
 * `catalogo.laboratorio` no tiene columna `estado` ni `orden` —son tres columnas y nada más—.
 * El legacy aparenta lo contrario con código muerto en tres capas; no se migra. Es el gemelo
 * de marcas.
 *
 * Sin `reportePdf`: este recurso no tiene reporte.
 *
 * Las rutas son relativas a `API_BASE_URL` (`/api/v1`). El header `X-CSRF-Token` lo pone el
 * `csrf-interceptor`.
 */
@Injectable({ providedIn: 'root' })
export class LaboratorioApi {
  private readonly api = inject(ApiService);
  private readonly base = '/laboratorios';

  /**
   * Una PÁGINA del catálogo, con su `meta`, ordenada por nombre.
   *
   * El total sale de `catalogo.palaboratorio_count(q)`, al que el backend pasa exactamente el
   * mismo `q` que al `_leer`.
   *
   * ⚠ En el legacy este filtro no hace nada: `ajLaboratorio.php:19` llama `Leer($vNombre)`
   * contra `Leer($vInicio, $vFin, $vNombre)`. Aquí sí filtra; es una corrección deliberada.
   */
  list(query: LaboratorioListQuery): Observable<PagedResult<Laboratorio>> {
    return this.api.getList<Laboratorio>(this.base, laboratorioQueryParams(query));
  }

  get(laboratorioid: number): Observable<Laboratorio> {
    return this.api.get<Laboratorio>(`${this.base}/${laboratorioid}`);
  }

  /** Alta. Devuelve el laboratorio guardado, con su id y su `count_productos` (que arranca en 0). */
  create(input: LaboratorioInput): Observable<Laboratorio> {
    return this.api.post<Laboratorio>(this.base, input);
  }

  /** Edición. No hay estado ni orden que reponer: la tabla no tiene esas columnas. */
  update(laboratorioid: number, input: LaboratorioInput): Observable<Laboratorio> {
    return this.api.put<Laboratorio>(`${this.base}/${laboratorioid}`, input);
  }

  /** Elimina (204). Falla con 409 si algún producto lo usa. */
  remove(laboratorioid: number): Observable<void> {
    return this.api.delete<void>(`${this.base}/${laboratorioid}`);
  }

  /**
   * Borrado en lote: UNA petición, no N. Responde 200 con el resultado por id porque el lote es
   * parcial por diseño. El backend acota a 200 ids.
   */
  removeLote(ids: readonly number[]): Observable<ResultadoLoteLaboratorio[]> {
    return this.api.post<ResultadoLoteLaboratorio[]>(`${this.base}/lote/eliminar`, { ids });
  }
}
