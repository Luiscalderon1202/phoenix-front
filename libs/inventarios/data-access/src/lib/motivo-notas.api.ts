import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiService } from '@phoenix/shared/http';
import type {
  ResultadoLoteMotivoNotas,
  MotivoNotas,
  MotivoNotasEstado,
  MotivoNotasInput,
} from '@phoenix/inventarios/domain';

/**
 * Motivos de notas (`inventarios.motivo_notas`). CRUD completo: el stored procedure del legacy resuelve el
 * alta y la edición enteras en una llamada.
 *
 * `GET /motivos-notas` devuelve el catálogo COMPLETO y sin `meta`: la función del legacy no pagina
 * y la tabla es de unas pocas filas. Por eso `list()` usa `get` y no `getList`.
 *
 * Sin `reportePdf`: este recurso no tiene reporte. El PDF no es estándar —cuesta un endpoint,
 * una definición de columnas y su sitio en el contrato— y solo se añade a los recursos que lo
 * piden.
 * `GET /motivos-notas` trae las DOS mitades del catálogo —crédito y débito—, ordenadas por
 * tipo y luego por orden. Filtrar por tipo es cosa de la pantalla, que ya tiene todas las
 * filas en memoria.
 *
 * ⚠ El borrado casi nunca falla por "en uso": el stored procedure comprueba la tabla
 * equivocada y contra `motivo_notas` no hay ninguna clave foránea. No es una garantía en la
 * que apoyarse.
 *
 * Las rutas son relativas a `API_BASE_URL` (`/api/v1`). El header `X-CSRF-Token` que exigen
 * las mutaciones lo pone el `csrf-interceptor`; aquí no se toca.
 */
@Injectable({ providedIn: 'root' })
export class MotivoNotasApi {
  private readonly api = inject(ApiService);
  private readonly base = '/motivos-notas';

  /** Catálogo completo, ya ordenado desde el backend. */
  list(): Observable<MotivoNotas[]> {
    return this.api.get<MotivoNotas[]>(this.base);
  }

  get(motivoid: number): Observable<MotivoNotas> {
    return this.api.get<MotivoNotas>(`${this.base}/${motivoid}`);
  }

  /** Alta. El backend asigna `orden` (al final) y deja el registro activo; no se le mandan. */
  create(input: MotivoNotasInput): Observable<MotivoNotas> {
    return this.api.post<MotivoNotas>(this.base, input);
  }

  /**
   * Edición. Ni `orden` ni `estado` viajan aquí: cada uno tiene su ruta y ésa es su única
   * fuente de verdad.
   */
  update(motivoid: number, input: MotivoNotasInput): Observable<MotivoNotas> {
    return this.api.put<MotivoNotas>(`${this.base}/${motivoid}`, input);
  }

  /** Elimina (204). Falla con 409 si hay ventas relacionadas. */
  remove(motivoid: number): Observable<void> {
    return this.api.delete<void>(`${this.base}/${motivoid}`);
  }

  /**
   * Borrado en lote: UNA petición, no N. Responde 200 (no 204) con el resultado por id,
   * porque el lote es parcial por diseño —uno puede fallar mientras el resto sí se borra—,
   * así que el saldo se lee de `ResultadoLoteMotivoNotas[]`. El backend acota a 200.
   */
  removeLote(ids: readonly number[]): Observable<ResultadoLoteMotivoNotas[]> {
    return this.api.post<ResultadoLoteMotivoNotas[]>(`${this.base}/lote/eliminar`, { ids });
  }

  /**
   * Alterna el estado (activo ⇄ inactivo). Es un TOGGLE, no un setter: el backend hace
   * `set estado = not estado`, así que NO recibe el valor deseado y reintentar la petición
   * deshace el cambio. Devuelve el estado RESULTANTE.
   */
  alternarEstado(motivoid: number): Observable<MotivoNotasEstado> {
    return this.api.post<MotivoNotasEstado>(`${this.base}/${motivoid}/estado/alternar`, {});
  }

  /**
   * Persiste el orden de la lista. `ids` van en el orden deseado y `desde` es la posición
   * 1-based de la primera: el backend calcula `orden = posición + (desde-1)`, de modo que
   * reordenar el tramo visible no renumera la tabla entera.
   */
  reordenar(ids: readonly number[], desde = 1): Observable<void> {
    return this.api.patch<void>(`${this.base}/orden`, { ids, desde });
  }
}
