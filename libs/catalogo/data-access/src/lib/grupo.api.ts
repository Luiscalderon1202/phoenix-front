import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiService, type QueryParams } from '@phoenix/shared/http';
import type {
  Grupo,
  GrupoEstado,
  GrupoFiltros,
  GrupoInput,
  ResultadoLoteGrupo,
} from '@phoenix/catalogo/domain';

/**
 * Grupos de producto (`catalogo.grupo`). Los OCHO endpoints del molde: CRUD, borrado en lote,
 * alternar estado y reordenar.
 *
 * ⚠ Exige el proceso `CAT-GRUPO`, no `TABLAS-BASICAS`: es una opción de menú propia
 * (`basic.menuweb` 81, padre 70 «Catálogo»).
 *
 * ⚠ `list()` FILTRA en el servidor pero NO PAGINA: devuelve el catálogo completo, sin `meta`.
 * No existe `pagrupo_count`. Por eso usa `get` y no `getList`, y el troceado se hace en el
 * cliente. Tampoco filtra por estado: ese filtro es de cliente.
 *
 * ⚠ `reordenar` apunta a `phoenix.pagrupo_cambiar_orden`, de la **migración 0009**. La función
 * del legacy existe pero no recibe `vstart` y numera siempre desde 1: mandarle un tramo lo
 * colaría delante de todo lo demás.
 *
 * Sin `reportePdf`: este recurso no tiene reporte. Y no se expone `GrupoProductos.php` —la
 * pantalla que asigna productos a un grupo—: es parte del caso de uso de producto.
 *
 * Las rutas son relativas a `API_BASE_URL` (`/api/v1`). El header `X-CSRF-Token` lo pone el
 * `csrf-interceptor`.
 */
@Injectable({ providedIn: 'root' })
export class GrupoApi {
  private readonly api = inject(ApiService);
  private readonly base = '/grupos';

  /**
   * Catálogo filtrado y COMPLETO —sin `meta`—, ya ordenado por `orden` desde el backend.
   *
   * Devuelve activos e inactivos. `q` vacío se omite: `?q=` no es «sin filtro», es un filtro
   * por la cadena vacía, y `buildHttpParams` solo descarta `undefined`/`null`.
   */
  list(filtros: GrupoFiltros = {}): Observable<Grupo[]> {
    const params: QueryParams = {};
    if (filtros.q?.trim()) params['q'] = filtros.q.trim();
    return this.api.get<Grupo[]>(this.base, params);
  }

  get(grupoid: number): Observable<Grupo> {
    return this.api.get<Grupo>(`${this.base}/${grupoid}`);
  }

  /**
   * Alta. El backend deja el registro activo y le asigna `orden` (último+1, que aquí sí lo
   * resuelve el propio stored procedure); no se le mandan.
   */
  create(input: GrupoInput): Observable<Grupo> {
    return this.api.post<Grupo>(this.base, input);
  }

  /**
   * Edición. Ni `estado` ni `orden` viajan aquí: cada uno tiene su ruta. El stored procedure sí
   * recibe el estado, y el backend le devuelve el que la fila ya tenía.
   */
  update(grupoid: number, input: GrupoInput): Observable<Grupo> {
    return this.api.put<Grupo>(`${this.base}/${grupoid}`, input);
  }

  /** Elimina (204). Falla con 409 si el grupo tiene productos asignados. */
  remove(grupoid: number): Observable<void> {
    return this.api.delete<void>(`${this.base}/${grupoid}`);
  }

  /**
   * Borrado en lote: UNA petición, no N. Responde 200 con el resultado por id porque el lote es
   * parcial por diseño. El backend acota a 200 ids.
   */
  removeLote(ids: readonly number[]): Observable<ResultadoLoteGrupo[]> {
    return this.api.post<ResultadoLoteGrupo[]>(`${this.base}/lote/eliminar`, { ids });
  }

  /**
   * Alterna el estado (activo ⇄ inactivo). Es un TOGGLE, no un setter: reintentar la petición
   * deshace el cambio. Devuelve el estado RESULTANTE.
   */
  alternarEstado(grupoid: number): Observable<GrupoEstado> {
    return this.api.post<GrupoEstado>(`${this.base}/${grupoid}/estado/alternar`, {});
  }

  /**
   * Persiste el orden de la lista. `ids` van en el orden deseado y `desde` es la posición
   * 1-based de la primera: el backend calcula `orden = posición + (desde-1)`.
   */
  reordenar(ids: readonly number[], desde = 1): Observable<void> {
    return this.api.patch<void>(`${this.base}/orden`, { ids, desde });
  }
}
