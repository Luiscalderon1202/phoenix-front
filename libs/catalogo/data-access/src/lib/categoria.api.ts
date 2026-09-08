import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiService } from '@phoenix/shared/http';
import type {
  Categoria,
  CategoriaFiltros,
  CategoriaInput,
  ResultadoLoteCategoria,
} from '@phoenix/catalogo/domain';

/**
 * Categorías de producto (`catalogo.categoria`). Seis endpoints y no ocho: la tabla son TRES
 * columnas (`categoriaid`, `nombre`, `abreviatura`), sin `estado` ni `orden`, así que no hay
 * `/estado/alternar` ni `PATCH /orden`. Las funciones `pacategoria_cambiar_estado` y
 * `pacategoria_cambiar_orden` que invoca `ajCategoria.php` NO EXISTEN en la base: es código
 * muerto que la UI del legacy tampoco engancha.
 *
 * `GET /categorias` devuelve el catálogo COMPLETO y sin `meta`: no existe `pacategoria_count`.
 * Por eso `list()` usa `get` y no `getList`, y la paginación es cosa de la pantalla. El filtro
 * `?q=` sí va al servidor, que se lo pasa tal cual al stored procedure.
 *
 * ⚠ Exige el proceso `CAT-CATEGORIA`, no `TABLAS-BASICAS`: esta pantalla no cuelga de ese hub.
 *
 * ⚠ Este servicio es además el catálogo padre del selector de la pantalla de subcategorías:
 * `list()` sin argumentos devuelve la tabla entera y sirve para poblarlo. Cualquier cambio de
 * su firma rompe esa pantalla.
 *
 * Las rutas son relativas a `API_BASE_URL` (`/api/v1`). El header `X-CSRF-Token` que exigen
 * las mutaciones lo pone el `csrf-interceptor`; aquí no se toca.
 */
@Injectable({ providedIn: 'root' })
export class CategoriaApi {
  private readonly api = inject(ApiService);
  private readonly base = '/categorias';

  /**
   * Catálogo completo, ordenado por nombre desde el backend. Sin filtro devuelve toda la tabla.
   *
   * Los parámetros vacíos se OMITEN: mandar `?q=` sería filtrar por la cadena vacía, no «sin
   * filtro».
   */
  list(filtros: CategoriaFiltros = {}): Observable<Categoria[]> {
    const params: Record<string, string> = {};
    if (filtros.q?.trim()) params['q'] = filtros.q.trim();
    return this.api.get<Categoria[]>(this.base, params);
  }

  get(categoriaid: number): Observable<Categoria> {
    return this.api.get<Categoria>(`${this.base}/${categoriaid}`);
  }

  /** Alta. Solo los dos campos de texto; `cantidad_subcategorias` es derivado. */
  create(input: CategoriaInput): Observable<Categoria> {
    return this.api.post<Categoria>(this.base, input);
  }

  /** Edición. Mismo cuerpo que el alta: no hay nada más que editar. */
  update(categoriaid: number, input: CategoriaInput): Observable<Categoria> {
    return this.api.put<Categoria>(`${this.base}/${categoriaid}`, input);
  }

  /**
   * Elimina (204). Falla con 409 `categoria_has_relations` si la categoría tiene subcategorías
   * registradas; el mensaje lo redacta el backend.
   */
  remove(categoriaid: number): Observable<void> {
    return this.api.delete<void>(`${this.base}/${categoriaid}`);
  }

  /**
   * Borrado en lote: UNA petición, no N. Responde 200 con el resultado por id porque el lote
   * es parcial por diseño —una con subcategorías falla y el resto se borra—. El backend acota
   * a 200 ids.
   */
  removeLote(ids: readonly number[]): Observable<ResultadoLoteCategoria[]> {
    return this.api.post<ResultadoLoteCategoria[]>(`${this.base}/lote/eliminar`, { ids });
  }
}
