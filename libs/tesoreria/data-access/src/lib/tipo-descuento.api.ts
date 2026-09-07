import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiService } from '@phoenix/shared/http';
import type {
  ResultadoLoteTipoDescuento,
  TipoDescuento,
  TipoDescuentoEstado,
  TipoDescuentoInput,
} from '@phoenix/tesoreria/domain';

/**
 * Tipos de descuento (`tesoreria.tipodescuento`). CRUD completo: el stored procedure del legacy resuelve el alta y la
 * edición enteras en una llamada.
 *
 * `GET /tipos-descuento` devuelve el catálogo COMPLETO y sin `meta`: la función del legacy no pagina y
 * la tabla es de unas pocas filas. Por eso `list()` usa `get` y no `getList`.
 *
 * Sin `reportePdf`: este recurso no tiene reporte.
 * ⚠ El borrado nunca falla por relaciones: el stored procedure no comprueba nada y contra
 * `tesoreria.tipodescuento` no hay ninguna clave foránea. No es una garantía en la que
 * apoyarse.
 *
 * Las rutas son relativas a `API_BASE_URL` (`/api/v1`). El header `X-CSRF-Token` que exigen
 * las mutaciones lo pone el `csrf-interceptor`; aquí no se toca.
 */
@Injectable({ providedIn: 'root' })
export class TipoDescuentoApi {
  private readonly api = inject(ApiService);
  private readonly base = '/tipos-descuento';

  /** Catálogo completo, ya ordenado por `orden` desde el backend. */
  list(): Observable<TipoDescuento[]> {
    return this.api.get<TipoDescuento[]>(this.base);
  }

  get(tipoid: number): Observable<TipoDescuento> {
    return this.api.get<TipoDescuento>(`${this.base}/${tipoid}`);
  }

  /** Alta. El backend asigna `orden` (al final) y deja el registro activo; no se le mandan. */
  create(input: TipoDescuentoInput): Observable<TipoDescuento> {
    return this.api.post<TipoDescuento>(this.base, input);
  }

  /**
   * Edición. Ni `orden` ni `estado` viajan aquí: cada uno tiene su ruta y ésa es su única
   * fuente de verdad.
   */
  update(tipoid: number, input: TipoDescuentoInput): Observable<TipoDescuento> {
    return this.api.put<TipoDescuento>(`${this.base}/${tipoid}`, input);
  }

  /** Elimina (204). Falla con 409 si hay registros relacionados. */
  remove(tipoid: number): Observable<void> {
    return this.api.delete<void>(`${this.base}/${tipoid}`);
  }

  /**
   * Borrado en lote: UNA petición, no N. Responde 200 con el resultado por id porque el lote
   * es parcial por diseño. El backend acota a 200.
   */
  removeLote(ids: readonly number[]): Observable<ResultadoLoteTipoDescuento[]> {
    return this.api.post<ResultadoLoteTipoDescuento[]>(`${this.base}/lote/eliminar`, { ids });
  }

  /**
   * Alterna el estado (activo ⇄ inactivo). Es un TOGGLE, no un setter: el backend hace
   * `set estado = not estado`, así que NO recibe el valor deseado y reintentar la petición
   * deshace el cambio. Devuelve el estado RESULTANTE.
   */
  alternarEstado(tipoid: number): Observable<TipoDescuentoEstado> {
    return this.api.post<TipoDescuentoEstado>(`${this.base}/${tipoid}/estado/alternar`, {});
  }

  /**
   * Persiste el orden de la lista. `ids` van en el orden deseado y `desde` es la posición
   * 1-based de la primera: el backend calcula `orden = posición + (desde-1)`.
   */
  reordenar(ids: readonly number[], desde = 1): Observable<void> {
    return this.api.patch<void>(`${this.base}/orden`, { ids, desde });
  }
}
