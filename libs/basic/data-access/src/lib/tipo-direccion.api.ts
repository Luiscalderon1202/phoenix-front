import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiService } from '@phoenix/shared/http';
import type {
  ResultadoLoteTipoDireccion,
  TipoDireccion,
  TipoDireccionEstado,
  TipoDireccionInput,
} from '@phoenix/basic/domain';

/**
 * Tipos de dirección (`basic.tipodireccion`). CRUD completo, como Tipos de empresa: el
 * stored procedure del legacy resuelve el alta y la edición enteras en una llamada.
 *
 * `GET /tipos-direccion` devuelve el catálogo COMPLETO y sin `meta`: la función del legacy
 * no pagina y la tabla es de unas pocas filas. Por eso `list()` usa `get` y no `getList`.
 *
 * **Sin `reportePdf`**: este recurso no tiene reporte en el backend. El PDF no es estándar
 * —cuesta un endpoint, una definición de columnas y su sitio en el contrato—, así que solo
 * lo llevan los recursos que se piden expresamente.
 *
 * Las rutas son relativas a `API_BASE_URL` (`/api/v1`). El header `X-CSRF-Token` que
 * exigen las mutaciones lo pone el `csrf-interceptor`; aquí no se toca.
 */
@Injectable({ providedIn: 'root' })
export class TipoDireccionApi {
  private readonly api = inject(ApiService);
  private readonly base = '/tipos-direccion';

  /** Catálogo completo, ya ordenado por `orden` desde el backend. */
  list(): Observable<TipoDireccion[]> {
    return this.api.get<TipoDireccion[]>(this.base);
  }

  get(tipoid: number): Observable<TipoDireccion> {
    return this.api.get<TipoDireccion>(`${this.base}/${tipoid}`);
  }

  /** Alta. El backend asigna `orden` y deja el registro activo; no se le mandan. */
  create(input: TipoDireccionInput): Observable<TipoDireccion> {
    return this.api.post<TipoDireccion>(this.base, input);
  }

  /**
   * Edición. Cambia nombre, requerido y pordefecto: `orden` y `estado` no se tocan aquí.
   *
   * Ojo: si `pordefecto` va en `true`, el backend apaga el de todas las demás filas. La
   * respuesta trae solo la fila editada, así que el llamador tiene que recargar el listado.
   */
  update(tipoid: number, input: TipoDireccionInput): Observable<TipoDireccion> {
    return this.api.put<TipoDireccion>(`${this.base}/${tipoid}`, input);
  }

  /** Elimina (204). Falla con 409 si alguna dirección de persona lo usa. */
  remove(tipoid: number): Observable<void> {
    return this.api.delete<void>(`${this.base}/${tipoid}`);
  }

  /**
   * Borrado en lote: UNA petición, no N. Responde 200 (no 204) con el resultado por id,
   * porque el lote es parcial por diseño — uno puede estar en uso mientras el resto sí se
   * borra —, así que el saldo se lee de `ResultadoLoteTipoDireccion[]`. El backend acota a 200.
   */
  removeLote(ids: readonly number[]): Observable<ResultadoLoteTipoDireccion[]> {
    return this.api.post<ResultadoLoteTipoDireccion[]>(`${this.base}/lote/eliminar`, { ids });
  }

  /**
   * Alterna el estado (activo ⇄ inactivo). Es un TOGGLE, no un setter: el backend hace
   * `set estado = not estado`, así que NO recibe el valor deseado y reintentar la petición
   * deshace el cambio. Devuelve el estado RESULTANTE.
   */
  alternarEstado(tipoid: number): Observable<TipoDireccionEstado> {
    return this.api.post<TipoDireccionEstado>(`${this.base}/${tipoid}/estado/alternar`, {});
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
