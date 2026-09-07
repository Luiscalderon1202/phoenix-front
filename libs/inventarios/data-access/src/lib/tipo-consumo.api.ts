import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiService } from '@phoenix/shared/http';
import type {
  ResultadoLoteTipoConsumo,
  TipoConsumo,
  TipoConsumoEstado,
  TipoConsumoInput,
} from '@phoenix/inventarios/domain';

/**
 * Tipos de consumo (`inventarios.tipoconsumo`). CRUD completo: el stored procedure del legacy resuelve el
 * alta y la edición enteras en una llamada.
 *
 * `GET /tipos-consumo` devuelve el catálogo COMPLETO y sin `meta`: la función del legacy no pagina
 * y la tabla es de unas pocas filas. Por eso `list()` usa `get` y no `getList`.
 *
 * Sin `reportePdf`: este recurso no tiene reporte. El PDF no es estándar —cuesta un endpoint,
 * una definición de columnas y su sitio en el contrato— y solo se añade a los recursos que lo
 * piden.
 *
 * Las rutas son relativas a `API_BASE_URL` (`/api/v1`). El header `X-CSRF-Token` que exigen
 * las mutaciones lo pone el `csrf-interceptor`; aquí no se toca.
 */
@Injectable({ providedIn: 'root' })
export class TipoConsumoApi {
  private readonly api = inject(ApiService);
  private readonly base = '/tipos-consumo';

  /** Catálogo completo, ya ordenado por `orden` desde el backend. */
  list(): Observable<TipoConsumo[]> {
    return this.api.get<TipoConsumo[]>(this.base);
  }

  get(tipoid: number): Observable<TipoConsumo> {
    return this.api.get<TipoConsumo>(`${this.base}/${tipoid}`);
  }

  /** Alta. El backend asigna `orden` (al final) y deja el registro activo; no se le mandan. */
  create(input: TipoConsumoInput): Observable<TipoConsumo> {
    return this.api.post<TipoConsumo>(this.base, input);
  }

  /**
   * Edición. Ni `orden` ni `estado` viajan aquí: cada uno tiene su ruta y ésa es su única
   * fuente de verdad.
   */
  update(tipoid: number, input: TipoConsumoInput): Observable<TipoConsumo> {
    return this.api.put<TipoConsumo>(`${this.base}/${tipoid}`, input);
  }

  /** Elimina (204). Falla con 409 si alguna venta o algún pedido lo referencian. */
  remove(tipoid: number): Observable<void> {
    return this.api.delete<void>(`${this.base}/${tipoid}`);
  }

  /**
   * Borrado en lote: UNA petición, no N. Responde 200 (no 204) con el resultado por id,
   * porque el lote es parcial por diseño —uno puede estar en uso mientras el resto sí se
   * borra—, así que el saldo se lee de `ResultadoLoteTipoConsumo[]`. El backend acota a 200.
   */
  removeLote(ids: readonly number[]): Observable<ResultadoLoteTipoConsumo[]> {
    return this.api.post<ResultadoLoteTipoConsumo[]>(`${this.base}/lote/eliminar`, { ids });
  }

  /**
   * Alterna el estado (activo ⇄ inactivo). Es un TOGGLE, no un setter: el backend hace
   * `set estado = not estado`, así que NO recibe el valor deseado y reintentar la petición
   * deshace el cambio. Devuelve el estado RESULTANTE.
   */
  alternarEstado(tipoid: number): Observable<TipoConsumoEstado> {
    return this.api.post<TipoConsumoEstado>(`${this.base}/${tipoid}/estado/alternar`, {});
  }

  /**
   * Persiste el orden de la lista. `ids` van en el orden deseado y `desde` es la posición
   * 1-based de la primera: el backend calcula `orden = posición + (desde-1)`, de modo que
   * reordenar el tramo visible no renumera la tabla entera.
   */
  reordenar(ids: readonly number[], desde = 1): Observable<void> {
    return this.api.patch<void>(`${this.base}/orden`, { ids, desde });
  }
}
