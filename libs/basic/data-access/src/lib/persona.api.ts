import { inject, Injectable, InjectionToken } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiService, type PagedResult, type QueryParams } from '@phoenix/shared/http';
import type {
  PersonaEstado,
  PersonaListQuery,
  PersonaListRow,
  ResultadoLote,
} from '@phoenix/basic/domain';

/**
 * Base pública donde el backend sirve las fotos de perfil. `PersonaListRow.foto` es un
 * NOMBRE DE ARCHIVO, no una URL, y el contrato de `phoenix-api` todavía no publica el
 * endpoint (ni la ruta estática) que las expone.
 *
 * Por defecto queda vacía: con eso el listado pinta el avatar por defecto en vez de
 * inventarse una ruta que daría 404 en todas las filas. En cuanto el backend documente
 * dónde viven, basta con proveer el token en `app.config.ts` —
 * `{ provide: PERSONA_FOTO_BASE_URL, useValue: '/media/personas/' }` — y las fotos
 * aparecen sin tocar la pantalla.
 */
export const PERSONA_FOTO_BASE_URL = new InjectionToken<string>('PERSONA_FOTO_BASE_URL', {
  providedIn: 'root',
  factory: () => '',
});

/** Filtros opcionales de `PersonaListQuery`, en el orden en que los documenta el contrato. */
const FILTROS = [
  'q',
  'apemat',
  'nombre',
  'paisid',
  'sexo',
  'estado',
  'con_foto',
  'tipo',
  'rolid',
  'orderby',
] as const;

/**
 * Aplana la query a los parámetros que viajan en la URL.
 *
 * Los filtros vacíos se OMITEN en vez de mandarse en blanco: `q=` es un filtro por cadena
 * vacía para el backend, y no lo que pide un combo en "Todos". `buildHttpParams` solo
 * descarta `undefined`/`null`, así que la cadena vacía hay que quitarla aquí.
 */
export function personaQueryParams(query: PersonaListQuery): QueryParams {
  const params: QueryParams = { page: query.page, page_size: query.page_size };
  for (const key of FILTROS) {
    const value = query[key];
    if (value === undefined || value === null || value === '') continue;
    params[key] = value;
  }
  return params;
}

/**
 * Personas. Listado paginado server-side (`GET /personas`) más las mutaciones que expone
 * el contrato: alternar el estado y eliminar (una o un lote). NO hay alta ni edición: esas
 * pantallas siguen en el legacy PHP (estrategia strangler).
 *
 * Las rutas son relativas a `API_BASE_URL` (`/api/v1` en runtime). El header `X-CSRF-Token`
 * que exigen las mutaciones lo pone el `csrf-interceptor` a partir de la cookie legible;
 * aquí no se toca.
 */
@Injectable({ providedIn: 'root' })
export class PersonaApi {
  private readonly api = inject(ApiService);
  private readonly fotoBaseUrl = inject(PERSONA_FOTO_BASE_URL);
  private readonly base = '/personas';

  /** Listado paginado con filtros. Conserva `meta` (total) para el pie de grilla. */
  list(query: PersonaListQuery): Observable<PagedResult<PersonaListRow>> {
    return this.api.getList<PersonaListRow>(this.base, personaQueryParams(query));
  }

  /**
   * URL de la foto de una fila, o `null` si no hay foto o no se sabe dónde se sirven.
   * Resolver el nombre de archivo es responsabilidad de esta capa, no de la pantalla.
   */
  fotoUrl(foto: string): string | null {
    if (!foto || !this.fotoBaseUrl) return null;
    return `${this.fotoBaseUrl}${foto}`;
  }

  /**
   * Alterna el estado (activo ⇄ inactivo). Es un TOGGLE, no un setter: el backend hace
   * `set estado = not estado`, así que NO recibe el valor deseado y reintentar la petición
   * deshace el cambio. Devuelve el estado RESULTANTE para que el cliente no lo suponga.
   */
  alternarEstado(personaid: number): Observable<PersonaEstado> {
    return this.api.post<PersonaEstado>(`${this.base}/${personaid}/estado/alternar`, {});
  }

  /**
   * Elimina una persona (204). Falla con 409 si tiene ventas, salidas o fotos asociadas
   * (lo comprueba el stored procedure); ese `message` es seguro de mostrar y el
   * `error-interceptor` ya lo saca por toast además de re-emitir el `ApiError`.
   */
  remove(personaid: number): Observable<void> {
    return this.api.delete<void>(`${this.base}/${personaid}`);
  }

  /**
   * Borrado en lote. Responde 200 (no 204) con el resultado POR ID: una persona puede
   * fallar por tener registros relacionados mientras el resto sí se elimina, así que el
   * saldo se lee de `ResultadoLote[]` y no del código HTTP. El backend acota a 200 ids.
   */
  removeLote(ids: readonly number[]): Observable<ResultadoLote[]> {
    return this.api.post<ResultadoLote[]>(`${this.base}/lote/eliminar`, { ids });
  }
}
