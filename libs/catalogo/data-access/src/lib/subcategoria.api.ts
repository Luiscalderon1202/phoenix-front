import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiService } from '@phoenix/shared/http';
import type {
  ResultadoLoteSubcategoria,
  Subcategoria,
  SubcategoriaFiltros,
  SubcategoriaInput,
} from '@phoenix/catalogo/domain';

/**
 * Subcategorías de producto (`catalogo.subcategoria`).
 *
 * Seis endpoints y no ocho: esta tabla NO TIENE columnas `estado` ni `orden`, así que no hay
 * `POST /{id}/estado/alternar` ni `PATCH /orden`. (El legacy tiene un `case "change_status"` en
 * `ajSubCategoria.php` que llama a `pasubcategoria_cambiar_estado`, pero esa función no existe
 * en la base: es código muerto en tres capas.)
 *
 * `GET /subcategorias` devuelve el catálogo COMPLETO y sin `meta`: el stored procedure no
 * pagina. Por eso `list()` usa `get` y no `getList`, y la paginación de la pantalla es en
 * cliente. Los FILTROS en cambio sí van al servidor: `pasubcategoria_leer(vnombre,
 * vcategoriaid)` los aplica bien los dos, y el de categoría es el enlace padre→hijo que usa la
 * pantalla de Categorías.
 *
 * ⚠ Exige el proceso `CAT-SUBCATEGORIA`, no `TABLAS-BASICAS`: esta pantalla no cuelga de aquel
 * hub, es una opción de menú propia (`basic.menuweb` 75, padre 70 «Catalogo»).
 *
 * Sin `reportePdf`: el legacy no imprime este catálogo.
 *
 * Las rutas son relativas a `API_BASE_URL` (`/api/v1`). El header `X-CSRF-Token` que exigen las
 * mutaciones lo pone el `csrf-interceptor`; aquí no se toca.
 */
@Injectable({ providedIn: 'root' })
export class SubcategoriaApi {
  private readonly api = inject(ApiService);
  private readonly base = '/subcategorias';

  /**
   * Catálogo completo, filtrado en el servidor y ordenado por nombre.
   *
   * Los filtros vacíos NO se mandan: el backend normaliza cualquier `categoriaid <= 0` a «sin
   * filtro», pero omitir el parámetro deja la intención explícita en la URL y evita heredar el
   * `-1` centinela que manda el desplegable del legacy.
   */
  list(filtros: SubcategoriaFiltros = {}): Observable<Subcategoria[]> {
    const params: Record<string, string | number> = {};
    if (filtros.q?.trim()) params['q'] = filtros.q.trim();
    if (filtros.categoriaid && filtros.categoriaid > 0) params['categoriaid'] = filtros.categoriaid;
    return this.api.get<Subcategoria[]>(this.base, params);
  }

  get(subcategoriaid: number): Observable<Subcategoria> {
    return this.api.get<Subcategoria>(`${this.base}/${subcategoriaid}`);
  }

  /**
   * Alta. `categoriaid` es obligatorio: la columna es NOT NULL con clave foránea y un id
   * inexistente rebota con 409 `subcategoria_categoria_invalid`.
   */
  create(input: SubcategoriaInput): Observable<Subcategoria> {
    return this.api.post<Subcategoria>(this.base, input);
  }

  /**
   * Edición. `categoriaid` viaja TAMBIÉN aquí, y no es opcional: el stored procedure hace
   * `set categoriaid = incategoriaid`, así que omitirlo movería la subcategoría a la categoría 0.
   *
   * ⚠ Un 409 `subcategoria_duplicate` puede venir de una subcategoría de OTRA categoría: la
   * unicidad del nombre es GLOBAL. Ver el modelo de dominio.
   */
  update(subcategoriaid: number, input: SubcategoriaInput): Observable<Subcategoria> {
    return this.api.put<Subcategoria>(`${this.base}/${subcategoriaid}`, input);
  }

  /**
   * Elimina (204). Falla con 409 si algún master o el stock valorado la usan: el chequeo del SP
   * solo mira `catalogo.master`, y el backend traduce el 23503 de
   * `inventarios.stock_valorado` que se le escapa.
   */
  remove(subcategoriaid: number): Observable<void> {
    return this.api.delete<void>(`${this.base}/${subcategoriaid}`);
  }

  /**
   * Borrado en lote: UNA petición, no N. Responde 200 con el resultado por id porque el lote es
   * parcial por diseño. El backend acota a 200 ids.
   */
  removeLote(ids: readonly number[]): Observable<ResultadoLoteSubcategoria[]> {
    return this.api.post<ResultadoLoteSubcategoria[]>(`${this.base}/lote/eliminar`, { ids });
  }
}
