import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiService } from '@phoenix/shared/http';
import type { QueryParams } from '@phoenix/shared/http';
import type {
  ResultadoLoteUnidadMedida,
  UnidadMedida,
  UnidadMedidaEstado,
  UnidadMedidaFiltros,
  UnidadMedidaInput,
} from '@phoenix/catalogo/domain';

/**
 * Unidades de medida (`catalogo.unidadmedida`). Los ocho endpoints del molde: CRUD, borrado en
 * lote, alternar estado y reordenar.
 *
 * ⚠ Exige el proceso `CAT-UNIDAD-MEDIDA`, no `TABLAS-BASICAS`: esta pantalla no cuelga del hub
 * de tablas básicas, es una opción de menú propia (`basic.menuweb` 74).
 *
 * Dos rarezas que conviene tener presentes:
 *
 * - **`list()` filtra en el SERVIDOR** (a diferencia de las condiciones de pago, que traen el
 *   catálogo y filtran en memoria): `phoenix.paunidadmedida_leer` recibe los dos filtros y los
 *   aplica. Pero **devuelve el catálogo COMPLETO y sin `meta`**: filtra, no pagina. Por eso usa
 *   `get` y no `getList`, y la paginación se hace en el cliente.
 * - **`alternarEstado` y `reordenar` no existían.** Los aporta la migración 0008 sobre el
 *   esquema `phoenix`; ninguna función del legacy sabía escribir esas dos columnas.
 *
 * Sin `reportePdf`: este recurso no tiene reporte.
 *
 * Las rutas son relativas a `API_BASE_URL` (`/api/v1`). El header `X-CSRF-Token` que exigen las
 * mutaciones lo pone el `csrf-interceptor`; aquí no se toca.
 */
@Injectable({ providedIn: 'root' })
export class UnidadMedidaApi {
  private readonly api = inject(ApiService);
  private readonly base = '/unidades-medida';

  /**
   * Catálogo filtrado y COMPLETO —sin `meta`—, ya ordenado por `orden` desde el backend.
   *
   * Los vacíos se omiten: `?q=` no es «sin filtro», es un filtro por la cadena vacía, y
   * `buildHttpParams` solo descarta `undefined`/`null`. Lo mismo con `incluir_inactivas`, cuyo
   * default en el backend ya es `false`.
   */
  list(filtros: UnidadMedidaFiltros = {}): Observable<UnidadMedida[]> {
    const params: QueryParams = {};
    if (filtros.q?.trim()) params['q'] = filtros.q.trim();
    if (filtros.incluir_inactivas) params['incluir_inactivas'] = true;
    return this.api.get<UnidadMedida[]>(this.base, params);
  }

  get(unidadmedidaid: number): Observable<UnidadMedida> {
    return this.api.get<UnidadMedida>(`${this.base}/${unidadmedidaid}`);
  }

  /** Alta. El backend asigna `orden` (al final) y deja el registro activo; no se le mandan. */
  create(input: UnidadMedidaInput): Observable<UnidadMedida> {
    return this.api.post<UnidadMedida>(this.base, input);
  }

  /**
   * Edición. Ni `estado` ni `orden` viajan aquí: cada uno tiene su ruta y ésa es su única fuente
   * de verdad. El stored procedure tampoco los recibe.
   */
  update(unidadmedidaid: number, input: UnidadMedidaInput): Observable<UnidadMedida> {
    return this.api.put<UnidadMedida>(`${this.base}/${unidadmedidaid}`, input);
  }

  /**
   * Elimina (204). Falla con 409 si algún producto o alguna línea de pedido la usa: el stored
   * procedure solo mira `catalogo.producto`, y el backend traduce a 409 el 23503 que llega de
   * `inventarios.pedido_detalle`.
   */
  remove(unidadmedidaid: number): Observable<void> {
    return this.api.delete<void>(`${this.base}/${unidadmedidaid}`);
  }

  /**
   * Borrado en lote: UNA petición, no N. Responde 200 con el resultado por id porque el lote es
   * parcial por diseño. El backend acota a 200 ids.
   */
  removeLote(ids: readonly number[]): Observable<ResultadoLoteUnidadMedida[]> {
    return this.api.post<ResultadoLoteUnidadMedida[]>(`${this.base}/lote/eliminar`, { ids });
  }

  /**
   * Alterna el estado (activa ⇄ inactiva). Es un TOGGLE, no un setter: el backend hace
   * `set estado = not estado`, así que NO recibe el valor deseado y reintentar la petición
   * deshace el cambio. Devuelve el estado RESULTANTE.
   *
   * Es la ruta que hacía falta: en producción 17 de 27 unidades están inactivas y el listado del
   * legacy las ocultaba a fuego, sin manera de reactivarlas.
   */
  alternarEstado(unidadmedidaid: number): Observable<UnidadMedidaEstado> {
    return this.api.post<UnidadMedidaEstado>(
      `${this.base}/${unidadmedidaid}/estado/alternar`,
      {},
    );
  }

  /**
   * Persiste el orden de la lista. `ids` van en el orden deseado y `desde` es la posición
   * 1-based de la primera: el backend calcula `orden = posición + (desde-1)`.
   */
  reordenar(ids: readonly number[], desde = 1): Observable<void> {
    return this.api.patch<void>(`${this.base}/orden`, { ids, desde });
  }
}
