import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiService } from '@phoenix/shared/http';
import type {
  ResultadoLoteTipoTarjeta,
  TipoTarjeta,
  TipoTarjetaEstado,
  TipoTarjetaInput,
} from '@phoenix/tesoreria/domain';

/**
 * Tipos de tarjeta (`tesoreria.tipo_tarjeta`). CRUD completo: el stored procedure del legacy resuelve el alta y la
 * edición enteras en una llamada.
 *
 * `GET /tipos-tarjeta` devuelve el catálogo COMPLETO y sin `meta`: la función del legacy no pagina y
 * la tabla es de unas pocas filas. Por eso `list()` usa `get` y no `getList`.
 *
 * Sin `reportePdf`: este recurso no tiene reporte.
 *
 * Las rutas son relativas a `API_BASE_URL` (`/api/v1`). El header `X-CSRF-Token` que exigen
 * las mutaciones lo pone el `csrf-interceptor`; aquí no se toca.
 */
@Injectable({ providedIn: 'root' })
export class TipoTarjetaApi {
  private readonly api = inject(ApiService);
  private readonly base = '/tipos-tarjeta';

  /** Catálogo completo, ya ordenado por `orden` desde el backend. */
  list(): Observable<TipoTarjeta[]> {
    return this.api.get<TipoTarjeta[]>(this.base);
  }

  get(tipotarjetaid: number): Observable<TipoTarjeta> {
    return this.api.get<TipoTarjeta>(`${this.base}/${tipotarjetaid}`);
  }

  /** Alta. El backend asigna `orden` (al final) y deja el registro activo; no se le mandan. */
  create(input: TipoTarjetaInput): Observable<TipoTarjeta> {
    return this.api.post<TipoTarjeta>(this.base, input);
  }

  /**
   * Edición. Ni `orden` ni `estado` viajan aquí: cada uno tiene su ruta y ésa es su única
   * fuente de verdad.
   */
  update(tipotarjetaid: number, input: TipoTarjetaInput): Observable<TipoTarjeta> {
    return this.api.put<TipoTarjeta>(`${this.base}/${tipotarjetaid}`, input);
  }

  /** Elimina (204). Falla con 409 si alguna forma de pago de una venta lo referencia. */
  remove(tipotarjetaid: number): Observable<void> {
    return this.api.delete<void>(`${this.base}/${tipotarjetaid}`);
  }

  /**
   * Borrado en lote: UNA petición, no N. Responde 200 con el resultado por id porque el lote
   * es parcial por diseño. El backend acota a 200.
   */
  removeLote(ids: readonly number[]): Observable<ResultadoLoteTipoTarjeta[]> {
    return this.api.post<ResultadoLoteTipoTarjeta[]>(`${this.base}/lote/eliminar`, { ids });
  }

  /**
   * Alterna el estado (activo ⇄ inactivo). Es un TOGGLE, no un setter: el backend hace
   * `set estado = not estado`, así que NO recibe el valor deseado y reintentar la petición
   * deshace el cambio. Devuelve el estado RESULTANTE.
   */
  alternarEstado(tipotarjetaid: number): Observable<TipoTarjetaEstado> {
    return this.api.post<TipoTarjetaEstado>(`${this.base}/${tipotarjetaid}/estado/alternar`, {});
  }

  /**
   * Persiste el orden de la lista. `ids` van en el orden deseado y `desde` es la posición
   * 1-based de la primera: el backend calcula `orden = posición + (desde-1)`.
   */
  reordenar(ids: readonly number[], desde = 1): Observable<void> {
    return this.api.patch<void>(`${this.base}/orden`, { ids, desde });
  }
}
