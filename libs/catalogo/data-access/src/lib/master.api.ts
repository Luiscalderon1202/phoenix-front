import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiService, type PagedResult, type QueryParams } from '@phoenix/shared/http';
import type {
  Master,
  MasterEstado,
  MasterListQuery,
  ResultadoLoteMaster,
} from '@phoenix/catalogo/domain';
import { filtrosCatalogoParams } from './producto.api';

/** Aplana la query de masters: los filtros comunes más el suyo y la paginación. */
export function masterQueryParams(query: MasterListQuery): QueryParams {
  const params: QueryParams = {
    ...filtrosCatalogoParams(query),
    page: query.page,
    page_size: query.page_size,
  };
  if (query.masterid) params['masterid'] = query.masterid;
  if (query.order_by) params['order_by'] = query.order_by;
  return params;
}

/**
 * Productos master (`catalogo.master`), segunda pestaña de la pantalla de productos.
 *
 * ⚠ Exige `CAT-PRODUCTO`, el MISMO proceso que el producto: el master no tiene fila en
 * `basic.menuweb` ni pantalla suya.
 *
 * CUATRO endpoints, uno menos que producto porque «cambiar master» es una operación DEL
 * producto. Y ninguno escribe campos: el alta y la edición son otro tramo.
 *
 * ⚠ `GET /masters` PAGINA EN SERVIDOR. Su `meta.total` lo calcula una función de la migración
 * 0010, porque el `_count` del legacy comparaba la abreviatura sin normalizar mayúsculas y
 * hacía que el total mintiera.
 *
 * Las rutas son relativas a `API_BASE_URL` (`/api/v1`). El header `X-CSRF-Token` lo pone el
 * `csrf-interceptor`.
 */
@Injectable({ providedIn: 'root' })
export class MasterApi {
  private readonly api = inject(ApiService);
  private readonly base = '/masters';

  /**
   * Una PÁGINA del listado, con su `meta`. Cada fila trae el stock sumado de todos sus
   * productos y el contador de productos calculado en vivo.
   */
  list(query: MasterListQuery): Observable<PagedResult<Master>> {
    return this.api.getList<Master>(this.base, masterQueryParams(query));
  }

  /** Elimina (204). Falla con 409 (`master_has_relations`) si le cuelga algún producto. */
  remove(masterid: number): Observable<void> {
    return this.api.delete<void>(`${this.base}/${masterid}`);
  }

  /**
   * Borrado en lote: UNA petición, no N. Responde 200 con el resultado por id. El backend acota
   * a 200 ids y llama al stored procedure una vez por id, porque el del legacy es de lote y no
   * sabe decir cuál falló.
   */
  removeLote(ids: readonly number[]): Observable<ResultadoLoteMaster[]> {
    return this.api.post<ResultadoLoteMaster[]>(`${this.base}/lote/eliminar`, { ids });
  }

  /**
   * Alterna el estado. Es un TOGGLE, no un setter. Devuelve el estado RESULTANTE.
   *
   * ⚠ Apagar un master NO apaga sus productos.
   */
  alternarEstado(masterid: number): Observable<MasterEstado> {
    return this.api.post<MasterEstado>(`${this.base}/${masterid}/estado/alternar`, {});
  }
}
