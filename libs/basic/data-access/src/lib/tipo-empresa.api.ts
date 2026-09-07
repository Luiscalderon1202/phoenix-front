import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiService, type NamedBlob } from '@phoenix/shared/http';
import type {
  ResultadoLoteTipoEmpresa,
  TipoEmpresa,
  TipoEmpresaEstado,
  TipoEmpresaInput,
} from '@phoenix/basic/domain';

/**
 * Tipos de empresa (`basic.tipo_empresa`). CRUD completo, a diferencia de Personas: aquí
 * el alta y la edición SÍ están migradas, porque el stored procedure del legacy las
 * resuelve enteras en una llamada.
 *
 * `GET /tipos-empresa` devuelve el catálogo COMPLETO y sin `meta`: la función del legacy
 * no pagina y la tabla es de decenas de filas. Por eso `list()` usa `get` y no `getList`.
 *
 * Las rutas son relativas a `API_BASE_URL` (`/api/v1`). El header `X-CSRF-Token` que
 * exigen las mutaciones lo pone el `csrf-interceptor`; aquí no se toca.
 */
@Injectable({ providedIn: 'root' })
export class TipoEmpresaApi {
  private readonly api = inject(ApiService);
  private readonly base = '/tipos-empresa';

  /** Catálogo completo, ya ordenado por `orden` desde el backend. */
  list(): Observable<TipoEmpresa[]> {
    return this.api.get<TipoEmpresa[]>(this.base);
  }

  get(tipoempresaid: number): Observable<TipoEmpresa> {
    return this.api.get<TipoEmpresa>(`${this.base}/${tipoempresaid}`);
  }

  /** Alta. El backend asigna `orden` y deja el registro activo; no se le mandan. */
  create(input: TipoEmpresaInput): Observable<TipoEmpresa> {
    return this.api.post<TipoEmpresa>(this.base, input);
  }

  /** Edición. Solo cambia nombre, tipo y categoría: `orden` y `estado` no se tocan aquí. */
  update(tipoempresaid: number, input: TipoEmpresaInput): Observable<TipoEmpresa> {
    return this.api.put<TipoEmpresa>(`${this.base}/${tipoempresaid}`, input);
  }

  /** Elimina (204). Falla con 409 si hay unidades de negocio o almacenes que lo usan. */
  remove(tipoempresaid: number): Observable<void> {
    return this.api.delete<void>(`${this.base}/${tipoempresaid}`);
  }

  /**
   * Borrado en lote: UNA petición, no N. Responde 200 (no 204) con el resultado por id,
   * porque el lote es parcial por diseño — uno puede estar en uso mientras el resto sí se
   * borra —, así que el saldo se lee de `ResultadoLoteTipoEmpresa[]`. El backend acota a 200.
   */
  removeLote(ids: readonly number[]): Observable<ResultadoLoteTipoEmpresa[]> {
    return this.api.post<ResultadoLoteTipoEmpresa[]>(`${this.base}/lote/eliminar`, { ids });
  }

  /**
   * Alterna el estado (activo ⇄ inactivo). Es un TOGGLE, no un setter: el backend hace
   * `set estado = not estado`, así que NO recibe el valor deseado y reintentar la petición
   * deshace el cambio. Devuelve el estado RESULTANTE.
   */
  alternarEstado(tipoempresaid: number): Observable<TipoEmpresaEstado> {
    return this.api.post<TipoEmpresaEstado>(`${this.base}/${tipoempresaid}/estado/alternar`, {});
  }

  /**
   * Persiste el orden de la lista. `ids` van en el orden deseado y `desde` es la posición
   * 1-based de la primera: el backend calcula `orden = posición + (desde-1)`, de modo que
   * reordenar el tramo visible no renumera la tabla entera.
   */
  reordenar(ids: readonly number[], desde = 1): Observable<void> {
    return this.api.patch<void>(`${this.base}/orden`, { ids, desde });
  }

  /**
   * Reporte PDF del listado.
   *
   * Cuelga de `/reportes`, no del recurso: el backend agrupa ahí los reportes de cada módulo.
   * Exige el mismo permiso que el listado.
   *
   * Usa `getBlobWithName` para respetar el nombre de archivo que dicta el backend en
   * `Content-Disposition` (que el CORS expone explícitamente); si no llegara, el llamador
   * pone el suyo.
   */
  reportePdf(soloActivos = false): Observable<NamedBlob> {
    return this.api.getBlobWithName('/reportes/tipos-empresa', { solo_activos: soloActivos });
  }
}
