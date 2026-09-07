import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiService } from '@phoenix/shared/http';
import type {
  ResultadoLoteCondicionPago,
  CondicionPago,
  CondicionPagoEstado,
  CondicionPagoInput,
} from '@phoenix/tesoreria/domain';

/**
 * Condiciones de pago (`tesoreria.condicionpago`). CRUD completo: el stored procedure del legacy resuelve el alta y la
 * edición enteras en una llamada.
 *
 * `GET /condiciones-pago` devuelve el catálogo COMPLETO y sin `meta`: la función del legacy no pagina y
 * la tabla es de unas pocas filas. Por eso `list()` usa `get` y no `getList`.
 *
 * Sin `reportePdf`: este recurso no tiene reporte.
 *
 * Las rutas son relativas a `API_BASE_URL` (`/api/v1`). El header `X-CSRF-Token` que exigen
 * las mutaciones lo pone el `csrf-interceptor`; aquí no se toca.
 */
@Injectable({ providedIn: 'root' })
export class CondicionPagoApi {
  private readonly api = inject(ApiService);
  private readonly base = '/condiciones-pago';

  /** Catálogo completo, ya ordenado por `orden` desde el backend. */
  list(): Observable<CondicionPago[]> {
    return this.api.get<CondicionPago[]>(this.base);
  }

  get(condicionpagoid: number): Observable<CondicionPago> {
    return this.api.get<CondicionPago>(`${this.base}/${condicionpagoid}`);
  }

  /** Alta. El backend asigna `orden` (al final) y deja el registro activo; no se le mandan. */
  create(input: CondicionPagoInput): Observable<CondicionPago> {
    return this.api.post<CondicionPago>(this.base, input);
  }

  /**
   * Edición. Ni `orden` ni `estado` viajan aquí: cada uno tiene su ruta y ésa es su única
   * fuente de verdad.
   */
  update(condicionpagoid: number, input: CondicionPagoInput): Observable<CondicionPago> {
    return this.api.put<CondicionPago>(`${this.base}/${condicionpagoid}`, input);
  }

  /** Elimina (204). Falla con 409 si alguna venta u orden de compra la usa. */
  remove(condicionpagoid: number): Observable<void> {
    return this.api.delete<void>(`${this.base}/${condicionpagoid}`);
  }

  /**
   * Borrado en lote: UNA petición, no N. Responde 200 con el resultado por id porque el lote
   * es parcial por diseño. El backend acota a 200.
   */
  removeLote(ids: readonly number[]): Observable<ResultadoLoteCondicionPago[]> {
    return this.api.post<ResultadoLoteCondicionPago[]>(`${this.base}/lote/eliminar`, { ids });
  }

  /**
   * Alterna el estado (activo ⇄ inactivo). Es un TOGGLE, no un setter: el backend hace
   * `set estado = not estado`, así que NO recibe el valor deseado y reintentar la petición
   * deshace el cambio. Devuelve el estado RESULTANTE.
   */
  alternarEstado(condicionpagoid: number): Observable<CondicionPagoEstado> {
    return this.api.post<CondicionPagoEstado>(`${this.base}/${condicionpagoid}/estado/alternar`, {});
  }

  /**
   * Persiste el orden de la lista. `ids` van en el orden deseado y `desde` es la posición
   * 1-based de la primera: el backend calcula `orden = posición + (desde-1)`.
   */
  reordenar(ids: readonly number[], desde = 1): Observable<void> {
    return this.api.patch<void>(`${this.base}/orden`, { ids, desde });
  }
}
