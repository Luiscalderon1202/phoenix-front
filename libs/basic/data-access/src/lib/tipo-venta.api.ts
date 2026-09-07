import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiService } from '@phoenix/shared/http';
import type {
  ResultadoLoteTipoVenta,
  TipoVenta,
  TipoVentaEstado,
  TipoVentaInput,
} from '@phoenix/basic/domain';

/**
 * Tipos de venta (`basic.tipoventa`). CRUD completo: el stored procedure del legacy resuelve el
 * alta y la edición enteras en una llamada.
 *
 * `GET /tipos-venta` devuelve el catálogo COMPLETO y sin `meta`: la función del legacy no pagina
 * y la tabla es de unas pocas filas. Por eso `list()` usa `get` y no `getList`.
 *
 * Sin `reportePdf`: este recurso no tiene reporte. El PDF no es estándar —cuesta un endpoint,
 * una definición de columnas y su sitio en el contrato— y solo se añade a los recursos que lo
 * piden.
 * El borrado tiene efectos laterales que vienen del legacy: al eliminar un tipo de venta, el
 * stored procedure lo desasigna de los formatos de comprobante y de los países.
 *
 * Las rutas son relativas a `API_BASE_URL` (`/api/v1`). El header `X-CSRF-Token` que exigen
 * las mutaciones lo pone el `csrf-interceptor`; aquí no se toca.
 */
@Injectable({ providedIn: 'root' })
export class TipoVentaApi {
  private readonly api = inject(ApiService);
  private readonly base = '/tipos-venta';

  /** Catálogo completo, ya ordenado desde el backend. */
  list(): Observable<TipoVenta[]> {
    return this.api.get<TipoVenta[]>(this.base);
  }

  get(tipoventaid: number): Observable<TipoVenta> {
    return this.api.get<TipoVenta>(`${this.base}/${tipoventaid}`);
  }

  /** Alta. El backend asigna `orden` (al final) y deja el registro activo; no se le mandan. */
  create(input: TipoVentaInput): Observable<TipoVenta> {
    return this.api.post<TipoVenta>(this.base, input);
  }

  /**
   * Edición. Ni `orden` ni `estado` viajan aquí: cada uno tiene su ruta y ésa es su única
   * fuente de verdad.
   */
  update(tipoventaid: number, input: TipoVentaInput): Observable<TipoVenta> {
    return this.api.put<TipoVenta>(`${this.base}/${tipoventaid}`, input);
  }

  /** Elimina (204). Falla con 409 si alguna venta usa el tipo. */
  remove(tipoventaid: number): Observable<void> {
    return this.api.delete<void>(`${this.base}/${tipoventaid}`);
  }

  /**
   * Borrado en lote: UNA petición, no N. Responde 200 (no 204) con el resultado por id,
   * porque el lote es parcial por diseño —uno puede fallar mientras el resto sí se borra—,
   * así que el saldo se lee de `ResultadoLoteTipoVenta[]`. El backend acota a 200.
   */
  removeLote(ids: readonly number[]): Observable<ResultadoLoteTipoVenta[]> {
    return this.api.post<ResultadoLoteTipoVenta[]>(`${this.base}/lote/eliminar`, { ids });
  }

  /**
   * Alterna el estado (activo ⇄ inactivo). Es un TOGGLE, no un setter: el backend hace
   * `set estado = not estado`, así que NO recibe el valor deseado y reintentar la petición
   * deshace el cambio. Devuelve el estado RESULTANTE.
   */
  alternarEstado(tipoventaid: number): Observable<TipoVentaEstado> {
    return this.api.post<TipoVentaEstado>(`${this.base}/${tipoventaid}/estado/alternar`, {});
  }

  /**
   * Persiste el orden de la lista. **Sin `desde`**: el stored procedure de este recurso no
   * recibe `vstart` y numera desde 1, así que el endpoint espera la LISTA COMPLETA en el orden
   * deseado. Mandarle un tramo suelto lo colaría delante de las filas que no van en él.
   */
  reordenar(ids: readonly number[]): Observable<void> {
    return this.api.patch<void>(`${this.base}/orden`, { ids });
  }
}
