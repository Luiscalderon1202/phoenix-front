import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiService, type PagedResult, type QueryParams } from '@phoenix/shared/http';
import type {
  FiltrosCatalogoProducto,
  Producto,
  ProductoEstado,
  ProductoListQuery,
  ResultadoLoteProducto,
} from '@phoenix/catalogo/domain';

/**
 * Aplana los filtros que comparten las dos pestañas.
 *
 * Los vacíos se OMITEN en vez de mandarse: para el backend un id 0 y un `q=` vacío significan
 * «sin filtro», pero gastar el parámetro no aporta nada y ensucia la URL. `buildHttpParams`
 * solo descarta `undefined`/`null`, así que la cadena vacía y el 0 hay que quitarlos aquí.
 *
 * ⚠ El legacy manda `-1` desde sus desplegables («TODAS LAS MARCAS»). Aquí la ausencia de
 * filtro se expresa omitiendo el parámetro, no con un centinela.
 */
export function filtrosCatalogoParams(f: FiltrosCatalogoProducto): QueryParams {
  const params: QueryParams = {};
  const q = f.q?.trim();
  if (q) params['q'] = q;
  if (f.lineaid) params['lineaid'] = f.lineaid;
  if (f.categoriaid) params['categoriaid'] = f.categoriaid;
  if (f.subcategoriaid) params['subcategoriaid'] = f.subcategoriaid;
  if (f.marcaid) params['marcaid'] = f.marcaid;
  if (f.stock) params['stock'] = f.stock;
  if (f.estado) params['estado'] = f.estado;
  return params;
}

/** Aplana la query de productos: los filtros comunes más los suyos y la paginación. */
export function productoQueryParams(query: ProductoListQuery): QueryParams {
  const params: QueryParams = {
    ...filtrosCatalogoParams(query),
    page: query.page,
    page_size: query.page_size,
  };
  if (query.productoid) params['productoid'] = query.productoid;
  if (query.unidadmedidaid) params['unidadmedidaid'] = query.unidadmedidaid;
  if (query.order_by) params['order_by'] = query.order_by;
  return params;
}

/**
 * Productos detallados (`catalogo.producto`), primera pestaña de la pantalla de productos.
 *
 * ⚠ Exige el proceso `CAT-PRODUCTO` (`basic.menuweb` 76). Es la MISMA pantalla que masters, así
 * que los dos comparten permiso.
 *
 * ⚠ CINCO endpoints y ninguno es de escritura de campos: esto es la ADMINISTRACIÓN, no el
 * editor. No hay `create` ni `update`; el alta y la edición viven en otro tramo, contra un
 * stored procedure de 64 argumentos que escribe producto y master a la vez.
 *
 * ⚠ `GET /productos` PAGINA EN SERVIDOR: devuelve `data[]` + `meta`. Por eso `list()` usa
 * `getList`. Y su `meta.total` lo calcula una función de la migración 0010, porque la del
 * legacy no buscaba por código interno y hacía que el total mintiera.
 *
 * Las rutas son relativas a `API_BASE_URL` (`/api/v1`). El header `X-CSRF-Token` lo pone el
 * `csrf-interceptor`.
 */
@Injectable({ providedIn: 'root' })
export class ProductoApi {
  private readonly api = inject(ApiService);
  private readonly base = '/productos';

  /**
   * Una PÁGINA del listado, con su `meta`.
   *
   * Cada fila trae el nombre COMPUESTO (master + presentación), los nombres de categoría,
   * subcategoría y marca ya resueltos, y el stock sumado sobre todos los almacenes.
   */
  list(query: ProductoListQuery): Observable<PagedResult<Producto>> {
    return this.api.getList<Producto>(this.base, productoQueryParams(query));
  }

  /**
   * Elimina (204).
   *
   * Falla con 409 (`producto_has_relations`) si el producto tiene ventas, ingresos, salidas o
   * pedidos —el `message` dice cuál—, y puede fallar con 403 (`producto_delete_forbidden`): el
   * stored procedure comprueba por su cuenta el proceso `producto-delete`, que es otro sistema
   * de permisos distinto del del menú.
   */
  remove(productoid: number): Observable<void> {
    return this.api.delete<void>(`${this.base}/${productoid}`);
  }

  /**
   * Borrado en lote: UNA petición, no N. Responde 200 con el resultado por id porque el lote es
   * parcial por diseño. El backend acota a 200 ids.
   */
  removeLote(ids: readonly number[]): Observable<ResultadoLoteProducto[]> {
    return this.api.post<ResultadoLoteProducto[]>(`${this.base}/lote/eliminar`, { ids });
  }

  /**
   * Alterna el estado. Es un TOGGLE, no un setter: reintentar la petición deshace el cambio.
   * Devuelve el estado RESULTANTE.
   */
  alternarEstado(productoid: number): Observable<ProductoEstado> {
    return this.api.post<ProductoEstado>(`${this.base}/${productoid}/estado/alternar`, {});
  }

  /**
   * Mueve el producto a otro master (204).
   *
   * ⚠ CAMBIA EL NOMBRE VISIBLE del producto, porque el listado lo compone con el nombre del
   * master. Hay que recargar la página, no parchear la fila.
   *
   * La aporta la migración 0010: la función del legacy escribía el nombre del master viejo
   * dentro de la columna `presentacion` del producto y acababa desbordándola.
   *
   * Falla con 422 si el master destino no existe (`producto_master_not_found`) o es el que ya
   * tiene (`producto_master_unchanged`).
   */
  cambiarMaster(productoid: number, masterid: number): Observable<void> {
    return this.api.patch<void>(`${this.base}/${productoid}/master`, { masterid });
  }
}
