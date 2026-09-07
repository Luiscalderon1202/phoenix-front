import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiService } from '@phoenix/shared/http';
import type {
  ResultadoLoteTipoTelefono,
  TipoTelefono,
  TipoTelefonoEstado,
  TipoTelefonoInput,
} from '@phoenix/basic/domain';

/**
 * Tipos de teléfono (`basic.tipotelefono`). CRUD completo, como tipos de empresa: el
 * stored procedure del legacy resuelve el alta y la edición enteras en una llamada.
 *
 * `GET /tipos-telefono` devuelve el catálogo COMPLETO y sin `meta`: la función del legacy
 * no pagina y la tabla son unas pocas filas. Por eso `list()` usa `get` y no `getList`.
 *
 * Sin `reportePdf`: este catálogo no tiene reporte en el legacy y el backend no expone
 * `/reportes/tipos-telefono`.
 *
 * Las rutas son relativas a `API_BASE_URL` (`/api/v1`). El header `X-CSRF-Token` que
 * exigen las mutaciones lo pone el `csrf-interceptor`; aquí no se toca.
 */
@Injectable({ providedIn: 'root' })
export class TipoTelefonoApi {
  private readonly api = inject(ApiService);
  private readonly base = '/tipos-telefono';

  /** Catálogo completo, ya ordenado por `orden` desde el backend. */
  list(): Observable<TipoTelefono[]> {
    return this.api.get<TipoTelefono[]>(this.base);
  }

  get(tipoid: number): Observable<TipoTelefono> {
    return this.api.get<TipoTelefono>(`${this.base}/${tipoid}`);
  }

  /**
   * Alta. El backend asigna `orden` y deja el registro activo; no se le mandan.
   *
   * ⚠ Con `pordefecto: true` el backend apaga la marca en TODAS las demás filas: el efecto
   * de esta llamada alcanza a registros que no se han tocado.
   */
  create(input: TipoTelefonoInput): Observable<TipoTelefono> {
    return this.api.post<TipoTelefono>(this.base, input);
  }

  /**
   * Edición. Solo cambia nombre, requerido y por defecto: `orden` y `estado` no se tocan
   * aquí. Vale la misma advertencia sobre `pordefecto` que en `create`.
   */
  update(tipoid: number, input: TipoTelefonoInput): Observable<TipoTelefono> {
    return this.api.put<TipoTelefono>(`${this.base}/${tipoid}`, input);
  }

  /** Elimina (204). Falla con 409 si hay personas con un teléfono de este tipo. */
  remove(tipoid: number): Observable<void> {
    return this.api.delete<void>(`${this.base}/${tipoid}`);
  }

  /**
   * Borrado en lote: UNA petición, no N. Responde 200 (no 204) con el resultado por id,
   * porque el lote es parcial por diseño — uno puede estar en uso mientras el resto sí se
   * borra —, así que el saldo se lee de `ResultadoLoteTipoTelefono[]`. El backend acota a 200.
   */
  removeLote(ids: readonly number[]): Observable<ResultadoLoteTipoTelefono[]> {
    return this.api.post<ResultadoLoteTipoTelefono[]>(`${this.base}/lote/eliminar`, { ids });
  }

  /**
   * Alterna el estado (activo ⇄ inactivo). Es un TOGGLE, no un setter: el backend hace
   * `set estado = not estado`, así que NO recibe el valor deseado y reintentar la petición
   * deshace el cambio. Devuelve el estado RESULTANTE.
   */
  alternarEstado(tipoid: number): Observable<TipoTelefonoEstado> {
    return this.api.post<TipoTelefonoEstado>(`${this.base}/${tipoid}/estado/alternar`, {});
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
