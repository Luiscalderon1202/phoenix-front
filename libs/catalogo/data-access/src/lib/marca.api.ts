import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiService, type PagedResult, type QueryParams } from '@phoenix/shared/http';
import type {
  Marca,
  MarcaInput,
  MarcaListQuery,
  ResultadoLoteMarca,
} from '@phoenix/catalogo/domain';

/**
 * Aplana la query a los parámetros que viajan en la URL.
 *
 * `q` vacío se OMITE en vez de mandarse en blanco: para el backend `q=` sí es un filtro (el
 * `Normalizar` del agregado le hace trim y compara con la cadena vacía, pero no hay razón
 * para gastar el parámetro), y `buildHttpParams` solo descarta `undefined`/`null`, así que la
 * cadena vacía hay que quitarla aquí.
 *
 * ⚠ El tamaño de página viaja como `page_size`, en snake_case. No es `pageSize`.
 */
export function marcaQueryParams(query: MarcaListQuery): QueryParams {
  const params: QueryParams = { page: query.page, page_size: query.page_size };
  const q = query.q?.trim();
  if (q) params['q'] = q;
  return params;
}

/**
 * Marcas (`catalogo.marca`). CRUD completo: el stored procedure del legacy resuelve el alta y
 * la edición enteras en una llamada.
 *
 * ⚠ `GET /marcas` es el ÚNICO listado del módulo `catalogo` que responde PAGINADO: devuelve
 * `data[]` + `meta{page, page_size, total}`. Por eso `list()` usa `getList` (que conserva la
 * `meta`) y no `get`. Sus cuatro hermanos —unidades de medida, unidad base, categorías y
 * subcategorías— traen el catálogo entero y filtran en cliente.
 *
 * SEIS endpoints, no ocho: no hay `/{id}/estado/alternar` ni `PATCH /orden`, porque
 * `catalogo.marca` no tiene columna `estado` ni `orden`. El legacy aparenta lo contrario con
 * código muerto en tres capas a la vez; no se migra.
 *
 * Sin `reportePdf`: el legacy no imprime este catálogo.
 *
 * Las rutas son relativas a `API_BASE_URL` (`/api/v1`). El header `X-CSRF-Token` que exigen
 * las mutaciones lo pone el `csrf-interceptor`; aquí no se toca.
 */
@Injectable({ providedIn: 'root' })
export class MarcaApi {
  private readonly api = inject(ApiService);
  private readonly base = '/marcas';

  /**
   * Una PÁGINA del catálogo, con su `meta`. El total sale de `pamarca_count(q)`, al que el
   * servicio pasa exactamente el mismo `q` que al `_leer`: si se separasen, `meta.total`
   * contaría un universo distinto al que se muestra.
   */
  list(query: MarcaListQuery): Observable<PagedResult<Marca>> {
    return this.api.getList<Marca>(this.base, marcaQueryParams(query));
  }

  get(marcaid: number): Observable<Marca> {
    return this.api.get<Marca>(`${this.base}/${marcaid}`);
  }

  /** Alta. Devuelve la marca guardada, con su id y su `count_productos` (que arranca en 0). */
  create(input: MarcaInput): Observable<Marca> {
    return this.api.post<Marca>(this.base, input);
  }

  /** Edición. No hay estado ni orden que reponer: la tabla no tiene esas columnas. */
  update(marcaid: number, input: MarcaInput): Observable<Marca> {
    return this.api.put<Marca>(`${this.base}/${marcaid}`, input);
  }

  /** Elimina (204). Falla con 409 si algún master la usa. */
  remove(marcaid: number): Observable<void> {
    return this.api.delete<void>(`${this.base}/${marcaid}`);
  }

  /**
   * Borrado en lote: UNA petición, no N. Responde 200 con el resultado por id porque el lote
   * es parcial por diseño. El backend acota a 200 ids.
   */
  removeLote(ids: readonly number[]): Observable<ResultadoLoteMarca[]> {
    return this.api.post<ResultadoLoteMarca[]>(`${this.base}/lote/eliminar`, { ids });
  }
}
