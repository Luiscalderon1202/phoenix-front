import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiService } from '@phoenix/shared/http';
import type {
  ResultadoLoteTipoOperacion,
  TipoOperacion,
  TipoOperacionEstado,
  TipoOperacionInput,
} from '@phoenix/basic/domain';

/**
 * Tipos de operación (`basic.tipooperacion`). CRUD completo: el stored procedure del legacy resuelve el
 * alta y la edición enteras en una llamada.
 *
 * `GET /tipos-operacion` devuelve el catálogo COMPLETO y sin `meta`: la función del legacy no pagina
 * y la tabla es de unas pocas filas. Por eso `list()` usa `get` y no `getList`.
 *
 * Sin `reportePdf`: este recurso no tiene reporte. El PDF no es estándar —cuesta un endpoint,
 * una definición de columnas y su sitio en el contrato— y solo se añade a los recursos que lo
 * piden.
 * El borrado tiene efectos laterales que vienen del legacy: al eliminar un tipo de operación,
 * el stored procedure lo desasigna de los formatos de comprobante y de los países.
 *
 * Las rutas son relativas a `API_BASE_URL` (`/api/v1`). El header `X-CSRF-Token` que exigen
 * las mutaciones lo pone el `csrf-interceptor`; aquí no se toca.
 */
@Injectable({ providedIn: 'root' })
export class TipoOperacionApi {
  private readonly api = inject(ApiService);
  private readonly base = '/tipos-operacion';

  /** Catálogo completo, ya ordenado desde el backend. */
  list(): Observable<TipoOperacion[]> {
    return this.api.get<TipoOperacion[]>(this.base);
  }

  get(tipooperacionid: number): Observable<TipoOperacion> {
    return this.api.get<TipoOperacion>(`${this.base}/${tipooperacionid}`);
  }

  /** Alta. El backend asigna `orden` (al final) y deja el registro activo; no se le mandan. */
  create(input: TipoOperacionInput): Observable<TipoOperacion> {
    return this.api.post<TipoOperacion>(this.base, input);
  }

  /**
   * Edición. Ni `orden` ni `estado` viajan aquí: cada uno tiene su ruta y ésa es su única
   * fuente de verdad.
   */
  update(tipooperacionid: number, input: TipoOperacionInput): Observable<TipoOperacion> {
    return this.api.put<TipoOperacion>(`${this.base}/${tipooperacionid}`, input);
  }

  /** Elimina (204). Falla con 409 si alguna venta usa el tipo de operación. */
  remove(tipooperacionid: number): Observable<void> {
    return this.api.delete<void>(`${this.base}/${tipooperacionid}`);
  }

  /**
   * Borrado en lote: UNA petición, no N. Responde 200 (no 204) con el resultado por id,
   * porque el lote es parcial por diseño —uno puede fallar mientras el resto sí se borra—,
   * así que el saldo se lee de `ResultadoLoteTipoOperacion[]`. El backend acota a 200.
   */
  removeLote(ids: readonly number[]): Observable<ResultadoLoteTipoOperacion[]> {
    return this.api.post<ResultadoLoteTipoOperacion[]>(`${this.base}/lote/eliminar`, { ids });
  }

  /**
   * Alterna el estado (activo ⇄ inactivo). Es un TOGGLE, no un setter: el backend hace
   * `set estado = not estado`, así que NO recibe el valor deseado y reintentar la petición
   * deshace el cambio. Devuelve el estado RESULTANTE.
   */
  alternarEstado(tipooperacionid: number): Observable<TipoOperacionEstado> {
    return this.api.post<TipoOperacionEstado>(`${this.base}/${tipooperacionid}/estado/alternar`, {});
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
