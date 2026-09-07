import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiService } from '@phoenix/shared/http';
import type {
  ResultadoLoteTipoTributo,
  TipoTributo,
  TipoTributoEstado,
  TipoTributoInput,
} from '@phoenix/basic/domain';

/**
 * Tipos de tributo (`basic.tipotributo`). CRUD completo: el stored procedure del legacy resuelve el
 * alta y la edición enteras en una llamada.
 *
 * `GET /tipos-tributo` devuelve el catálogo COMPLETO y sin `meta`: la función del legacy no pagina
 * y la tabla es de unas pocas filas. Por eso `list()` usa `get` y no `getList`.
 *
 * Sin `reportePdf`: este recurso no tiene reporte. El PDF no es estándar —cuesta un endpoint,
 * una definición de columnas y su sitio en el contrato— y solo se añade a los recursos que lo
 * piden.
 * El borrado tiene un efecto lateral que viene del legacy: al eliminar un tributo, el stored
 * procedure lo desasigna también de los países (`basic.pais_tipotributo`).
 *
 * Las rutas son relativas a `API_BASE_URL` (`/api/v1`). El header `X-CSRF-Token` que exigen
 * las mutaciones lo pone el `csrf-interceptor`; aquí no se toca.
 */
@Injectable({ providedIn: 'root' })
export class TipoTributoApi {
  private readonly api = inject(ApiService);
  private readonly base = '/tipos-tributo';

  /** Catálogo completo, ya ordenado por `orden` desde el backend. */
  list(): Observable<TipoTributo[]> {
    return this.api.get<TipoTributo[]>(this.base);
  }

  get(tipoid: number): Observable<TipoTributo> {
    return this.api.get<TipoTributo>(`${this.base}/${tipoid}`);
  }

  /** Alta. El backend asigna `orden` (al final) y deja el registro activo; no se le mandan. */
  create(input: TipoTributoInput): Observable<TipoTributo> {
    return this.api.post<TipoTributo>(this.base, input);
  }

  /**
   * Edición. Ni `orden` ni `estado` viajan aquí: cada uno tiene su ruta y ésa es su única
   * fuente de verdad.
   */
  update(tipoid: number, input: TipoTributoInput): Observable<TipoTributo> {
    return this.api.put<TipoTributo>(`${this.base}/${tipoid}`, input);
  }

  /** Elimina (204). Falla con 409 si alguna venta usa el tributo en cualquiera de sus tres posiciones. */
  remove(tipoid: number): Observable<void> {
    return this.api.delete<void>(`${this.base}/${tipoid}`);
  }

  /**
   * Borrado en lote: UNA petición, no N. Responde 200 (no 204) con el resultado por id,
   * porque el lote es parcial por diseño —uno puede estar en uso mientras el resto sí se
   * borra—, así que el saldo se lee de `ResultadoLoteTipoTributo[]`. El backend acota a 200.
   */
  removeLote(ids: readonly number[]): Observable<ResultadoLoteTipoTributo[]> {
    return this.api.post<ResultadoLoteTipoTributo[]>(`${this.base}/lote/eliminar`, { ids });
  }

  /**
   * Alterna el estado (activo ⇄ inactivo). Es un TOGGLE, no un setter: el backend hace
   * `set estado = not estado`, así que NO recibe el valor deseado y reintentar la petición
   * deshace el cambio. Devuelve el estado RESULTANTE.
   */
  alternarEstado(tipoid: number): Observable<TipoTributoEstado> {
    return this.api.post<TipoTributoEstado>(`${this.base}/${tipoid}/estado/alternar`, {});
  }

  /**
   * Persiste el orden de la lista. **Sin `desde`**, al contrario que el resto de los
   * catálogos: `patipotributo_change_order` no recibe `vstart` y numera desde 1, así que el
   * endpoint espera la LISTA COMPLETA en el orden deseado. Mandar solo un tramo lo colaría
   * delante de las filas que no van en él.
   */
  reordenar(ids: readonly number[]): Observable<void> {
    return this.api.patch<void>(`${this.base}/orden`, { ids });
  }
}
