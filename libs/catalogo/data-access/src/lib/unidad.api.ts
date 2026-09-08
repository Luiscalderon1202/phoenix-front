import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiService } from '@phoenix/shared/http';
import type {
  ResultadoLoteUnidad,
  Unidad,
  UnidadEstado,
  UnidadFiltros,
  UnidadInput,
} from '@phoenix/catalogo/domain';

/**
 * Unidades base (`catalogo.unidad`). Proceso `CAT-UNIDAD`.
 *
 * ⚠ **Otro recurso que `/unidades-medida`** (`catalogo.unidadmedida`, proceso
 * `CAT-UNIDAD-MEDIDA`): dos tablas, dos permisos y dos servicios. Un producto los usa los dos
 * a la vez, así que no se puede sustituir uno por otro.
 *
 * Siete endpoints, no ocho: esta tabla **no tiene columna `orden`**, así que no hay
 * `PATCH /unidades/orden` ni reordenamiento por arrastre.
 *
 * `GET /unidades` devuelve el catálogo COMPLETO y sin `meta`: el stored procedure no pagina y
 * la tabla es de unas pocas filas. Por eso `list()` usa `get` y no `getList`. Los filtros sí
 * van al servidor.
 *
 * Sin `reportePdf`: el legacy no imprime este catálogo.
 *
 * Las rutas son relativas a `API_BASE_URL` (`/api/v1`). El header `X-CSRF-Token` que exigen
 * las mutaciones lo pone el `csrf-interceptor`; aquí no se toca.
 */
@Injectable({ providedIn: 'root' })
export class UnidadApi {
  private readonly api = inject(ApiService);
  private readonly base = '/unidades';

  /**
   * Catálogo filtrado. Sin filtros devuelve sólo las unidades ACTIVAS: el backend interpreta
   * la ausencia de `incluir_inactivas` como `false`.
   *
   * Los parámetros vacíos se omiten en vez de mandarse en blanco, para que la URL diga
   * exactamente lo que se está pidiendo.
   */
  list(filtros: UnidadFiltros = {}): Observable<Unidad[]> {
    const params: Record<string, string> = {};
    if (filtros.q?.trim()) params['q'] = filtros.q.trim();
    if (filtros.incluir_inactivas) params['incluir_inactivas'] = 'true';
    return this.api.get<Unidad[]>(this.base, params);
  }

  get(unidadid: number): Observable<Unidad> {
    return this.api.get<Unidad>(`${this.base}/${unidadid}`);
  }

  /**
   * Alta. El registro nace activo: el stored procedure escribe `true` posicional y no recibe
   * el estado, así que no viaja en el cuerpo.
   */
  create(input: UnidadInput): Observable<Unidad> {
    return this.api.post<Unidad>(this.base, input);
  }

  /**
   * Edición. `estado` no viaja aquí: tiene su propia ruta y ésa es su única fuente de verdad.
   * (En el legacy el formulario lo pedía y luego lo tiraba a la basura; ver el modelo.)
   */
  update(unidadid: number, input: UnidadInput): Observable<Unidad> {
    return this.api.put<Unidad>(`${this.base}/${unidadid}`, input);
  }

  /**
   * Elimina (204). Falla con 409 si algún producto o alguna guía la usa: son las dos claves
   * foráneas reales contra esta tabla, aunque el stored procedure sólo compruebe la primera.
   */
  remove(unidadid: number): Observable<void> {
    return this.api.delete<void>(`${this.base}/${unidadid}`);
  }

  /**
   * Borrado en lote: UNA petición, no N. Responde 200 con el resultado por id porque el lote
   * es parcial por diseño. El backend acota a 200 ids.
   */
  removeLote(ids: readonly number[]): Observable<ResultadoLoteUnidad[]> {
    return this.api.post<ResultadoLoteUnidad[]>(`${this.base}/lote/eliminar`, { ids });
  }

  /**
   * Alterna el estado (activo ⇄ inactivo). Es un TOGGLE, no un setter: el backend hace
   * `set estado = not estado`, así que NO recibe el valor deseado y reintentar la petición
   * deshace el cambio. Devuelve el estado RESULTANTE.
   *
   * Es la única operación de todo el módulo `catalogo` que deja rastro de auditoría
   * (`rastro.campo`).
   */
  alternarEstado(unidadid: number): Observable<UnidadEstado> {
    return this.api.post<UnidadEstado>(`${this.base}/${unidadid}/estado/alternar`, {});
  }
}
