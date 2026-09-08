import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiService, type QueryParams } from '@phoenix/shared/http';
import type {
  ResultadoLoteTalla,
  Talla,
  TallaEstado,
  TallaFiltros,
  TallaInput,
} from '@phoenix/catalogo/domain';

/**
 * Tallas de producto (`catalogo.talla`). Los OCHO endpoints del molde: CRUD, borrado en lote,
 * alternar estado y reordenar. Es el gemelo de colores sin la columna muerta.
 *
 * ⚠ Exige el proceso `CAT-TALLA`, que en el legacy **no tenía fila en `basic.menuweb`**: al PHP
 * solo se llega por URL directa o desde el formulario de producto. La fila la crea Phoenix, con
 * el proceso que `Talla.php` ya declaraba.
 *
 * ⚠ `list()` FILTRA en el servidor pero NO PAGINA: devuelve el catálogo completo, sin `meta`, y
 * este recurso ni siquiera tiene un `patalla_count`. Por eso usa `get` y no `getList`. Tampoco
 * filtra por estado: ese filtro es de cliente.
 *
 * `reordenar` apunta a `catalogo.patalla_cambiar_orden`, que es del legacy y ya recibe `vstart`.
 *
 * Sin `reportePdf`: este recurso no tiene reporte.
 *
 * Las rutas son relativas a `API_BASE_URL` (`/api/v1`). El header `X-CSRF-Token` lo pone el
 * `csrf-interceptor`.
 */
@Injectable({ providedIn: 'root' })
export class TallaApi {
  private readonly api = inject(ApiService);
  private readonly base = '/tallas';

  /**
   * Catálogo filtrado y COMPLETO —sin `meta`—, ya ordenado por `orden` desde el backend.
   *
   * Devuelve activas e inactivas. `q` vacío se omite: `?q=` no es «sin filtro», es un filtro
   * por la cadena vacía.
   */
  list(filtros: TallaFiltros = {}): Observable<Talla[]> {
    const params: QueryParams = {};
    if (filtros.q?.trim()) params['q'] = filtros.q.trim();
    return this.api.get<Talla[]>(this.base, params);
  }

  get(tallaid: number): Observable<Talla> {
    return this.api.get<Talla>(`${this.base}/${tallaid}`);
  }

  /** Alta. El backend deja el registro activo y le asigna `orden` (último+1); no se le mandan. */
  create(input: TallaInput): Observable<Talla> {
    return this.api.post<Talla>(this.base, input);
  }

  /**
   * Edición. Ni `estado` ni `orden` viajan aquí: cada uno tiene su ruta. El stored procedure sí
   * recibe el estado, y el backend le devuelve el que la fila ya tenía.
   */
  update(tallaid: number, input: TallaInput): Observable<Talla> {
    return this.api.put<Talla>(`${this.base}/${tallaid}`, input);
  }

  /** Elimina (204). Falla con 409 si algún producto la usa. */
  remove(tallaid: number): Observable<void> {
    return this.api.delete<void>(`${this.base}/${tallaid}`);
  }

  /**
   * Borrado en lote: UNA petición, no N. Responde 200 con el resultado por id porque el lote es
   * parcial por diseño. El backend acota a 200 ids.
   */
  removeLote(ids: readonly number[]): Observable<ResultadoLoteTalla[]> {
    return this.api.post<ResultadoLoteTalla[]>(`${this.base}/lote/eliminar`, { ids });
  }

  /**
   * Alterna el estado (activa ⇄ inactiva). Es un TOGGLE, no un setter: reintentar la petición
   * deshace el cambio. Devuelve el estado RESULTANTE.
   */
  alternarEstado(tallaid: number): Observable<TallaEstado> {
    return this.api.post<TallaEstado>(`${this.base}/${tallaid}/estado/alternar`, {});
  }

  /**
   * Persiste el orden de la lista. `ids` van en el orden deseado y `desde` es la posición
   * 1-based de la primera: el backend calcula `orden = posición + (desde-1)`.
   *
   * ⚠ El backend RECHAZA el lote entero (422 `talla_reserved_id`) si algún id es menor o igual
   * que 0: el stored procedure del legacy no protege la fila centinela, y filtrar el id aquí
   * desplazaría la posición de todas las que van detrás.
   */
  reordenar(ids: readonly number[], desde = 1): Observable<void> {
    return this.api.patch<void>(`${this.base}/orden`, { ids, desde });
  }
}
