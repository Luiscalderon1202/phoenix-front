import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiService } from '@phoenix/shared/http';
import type {
  ResultadoLoteTipoSocialMedia,
  TipoSocialMedia,
  TipoSocialMediaEstado,
  TipoSocialMediaInput,
} from '@phoenix/basic/domain';

/**
 * Tipos de red social (`basic.tiposocialmedia`). CRUD completo, como Tipos de empresa: el
 * stored procedure del legacy resuelve el alta y la edición enteras en una llamada.
 *
 * `GET /tipos-social-media` devuelve el catálogo COMPLETO y sin `meta`: la función del
 * legacy no pagina y son un puñado de filas. Por eso `list()` usa `get` y no `getList`.
 *
 * Sin `reportePdf`: este recurso no tiene reporte en el backend. El PDF no es estándar —cada
 * uno cuesta un endpoint, una definición de columnas y su sitio en el contrato— y aquí el
 * legacy tampoco imprimía nada.
 *
 * Las rutas son relativas a `API_BASE_URL` (`/api/v1`). El header `X-CSRF-Token` que exigen
 * las mutaciones lo pone el `csrf-interceptor`; aquí no se toca.
 */
@Injectable({ providedIn: 'root' })
export class TipoSocialMediaApi {
  private readonly api = inject(ApiService);
  private readonly base = '/tipos-social-media';

  /** Catálogo completo, ya ordenado por `orden` desde el backend. */
  list(): Observable<TipoSocialMedia[]> {
    return this.api.get<TipoSocialMedia[]>(this.base);
  }

  get(tipoid: number): Observable<TipoSocialMedia> {
    return this.api.get<TipoSocialMedia>(`${this.base}/${tipoid}`);
  }

  /** Alta. El backend asigna `orden` (al final) y deja el registro activo; no se le mandan. */
  create(input: TipoSocialMediaInput): Observable<TipoSocialMedia> {
    return this.api.post<TipoSocialMedia>(this.base, input);
  }

  /** Edición. Solo cambia nombre, url e icono: `orden` y `estado` no se tocan aquí. */
  update(tipoid: number, input: TipoSocialMediaInput): Observable<TipoSocialMedia> {
    return this.api.put<TipoSocialMedia>(`${this.base}/${tipoid}`, input);
  }

  /** Elimina (204). Falla con 409 si alguna persona tiene declarada esa red. */
  remove(tipoid: number): Observable<void> {
    return this.api.delete<void>(`${this.base}/${tipoid}`);
  }

  /**
   * Borrado en lote: UNA petición, no N. Responde 200 (no 204) con el resultado por id,
   * porque el lote es parcial por diseño —uno puede estar en uso mientras el resto sí se
   * borra—, así que el saldo se lee de `ResultadoLoteTipoSocialMedia[]`. El backend acota a 200.
   */
  removeLote(ids: readonly number[]): Observable<ResultadoLoteTipoSocialMedia[]> {
    return this.api.post<ResultadoLoteTipoSocialMedia[]>(`${this.base}/lote/eliminar`, { ids });
  }

  /**
   * Alterna el estado (activo ⇄ inactivo). Es un TOGGLE, no un setter: el backend hace
   * `set estado = not estado`, así que NO recibe el valor deseado y reintentar la petición
   * deshace el cambio. Devuelve el estado RESULTANTE.
   */
  alternarEstado(tipoid: number): Observable<TipoSocialMediaEstado> {
    return this.api.post<TipoSocialMediaEstado>(`${this.base}/${tipoid}/estado/alternar`, {});
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
