import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiService, type QueryParams } from '@phoenix/shared/http';
import type {
  Almacen,
  AlmacenEstado,
  AlmacenFicha,
  AlmacenFiltros,
  AlmacenInput,
} from '@phoenix/basic/domain';

/**
 * Aplana los filtros del listado de locales.
 *
 * Los vacíos se OMITEN en vez de mandarse: para el backend un id 0 y un `q=` vacío significan
 * «sin filtro», así que gastar el parámetro solo ensucia la URL. `buildHttpParams` únicamente
 * descarta `undefined`/`null`, de modo que el 0 y la cadena vacía hay que quitarlos aquí.
 */
export function almacenQueryParams(f: AlmacenFiltros): QueryParams {
  const params: QueryParams = {};
  const q = f.q?.trim();
  if (q) params['q'] = q;
  if (f.unidadnegocioid) params['unidadnegocioid'] = f.unidadnegocioid;
  if (f.zonaid) params['zonaid'] = f.zonaid;
  if (f.tipoempresaid) params['tipoempresaid'] = f.tipoempresaid;
  return params;
}

/**
 * Locales y tiendas (`basic.almacen`, proceso `ALMACEN`). CRUD completo.
 *
 * ⚠ La tabla se llama `almacen` pero esto son LOCALES: la sede física desde la que se vende.
 *
 * `GET /almacenes` FILTRA en servidor —texto, zona, unidad de negocio y tipo de empresa— pero
 * **no pagina**: devuelve el catálogo entero, sin `meta`. El stored procedure no acepta
 * `vinicio`/`vfin` y no hay `_count` con el que emparejarlo. Por eso `list()` usa `get` y no
 * `getList`, y la pantalla pagina en cliente.
 *
 * ⚠ **No hay borrado en lote**: `paalmacen_eliminar` comprueba cinco tablas y limpia catorce
 * satélites antes de borrar la fila. Eso no se hace marcando casillas.
 */
@Injectable({ providedIn: 'root' })
export class AlmacenApi {
  private readonly api = inject(ApiService);
  private readonly base = '/almacenes';

  /**
   * Catálogo filtrado. Devuelve activos e inactivos: el stored procedure no filtra por
   * estado, así que ese interruptor lo resuelve la pantalla.
   */
  list(filtros: AlmacenFiltros = {}): Observable<Almacen[]> {
    return this.api.get<Almacen[]>(this.base, almacenQueryParams(filtros));
  }

  /**
   * Ficha del formulario. ⚠ NO es un subconjunto de la fila del listado: trae
   * `nombre_comercial`, que el listado no devuelve.
   */
  get(almacenid: number): Observable<AlmacenFicha> {
    return this.api.get<AlmacenFicha>(`${this.base}/${almacenid}`);
  }

  /** Alta. El backend asigna `orden` y lo deja activo; no se le mandan. */
  create(input: AlmacenInput): Observable<AlmacenFicha> {
    return this.api.post<AlmacenFicha>(this.base, input);
  }

  /** Edición. No toca `orden` ni `estado`. */
  update(almacenid: number, input: AlmacenInput): Observable<AlmacenFicha> {
    return this.api.put<AlmacenFicha>(`${this.base}/${almacenid}`, input);
  }

  /**
   * Elimina (204). Falla con 409 si el local tiene ventas, ingresos, salidas, transferencias
   * o caja; cuál de las cinco viaja en el mensaje.
   */
  remove(almacenid: number): Observable<void> {
    return this.api.delete<void>(`${this.base}/${almacenid}`);
  }

  /** Alterna el estado. Es un TOGGLE: devuelve el estado RESULTANTE. */
  alternarEstado(almacenid: number): Observable<AlmacenEstado> {
    return this.api.post<AlmacenEstado>(`${this.base}/${almacenid}/estado/alternar`, {});
  }

  /** Persiste el orden: `orden = posición + (desde-1)`. */
  reordenar(ids: readonly number[], desde = 1): Observable<void> {
    return this.api.patch<void>(`${this.base}/orden`, { ids, desde });
  }
}
