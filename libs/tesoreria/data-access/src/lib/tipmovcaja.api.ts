import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiService } from '@phoenix/shared/http';
import type {
  ResultadoLoteTipMovCaja,
  TipMovCaja,
  TipMovCajaEstado,
  TipMovCajaFiltros,
  TipMovCajaInput,
  TipMovCajaRequerirMesAnio,
} from '@phoenix/tesoreria/domain';

/**
 * Tipos de movimiento de caja (`tesoreria.tipmovcaja`).
 *
 * Se sale del molde del resto del módulo en tres cosas:
 *
 * - **Filtra en el servidor.** `list()` acepta nombre, tipo y estado, que el backend resuelve
 *   en Go. No los resuelve el stored procedure: su traducción de `tipo` está rota —espera `E`
 *   para los egresos y la tabla guarda `S`—, así que en el legacy filtrar por egreso no
 *   devuelve nada.
 * - **No se reordena.** La tabla no tiene columna `orden`; el listado llega por nombre y no
 *   hay `PATCH /orden`.
 * - **Tiene DOS interruptores.** Además del estado, `requerir_mesanio` tiene su propia ruta,
 *   porque el legacy le dedica una función aparte y también es un toggle.
 *
 * ⚠ Exige el proceso `TIPMOVCAJA`, no `TABLAS-BASICAS`.
 *
 * Las rutas son relativas a `API_BASE_URL` (`/api/v1`). El header `X-CSRF-Token` que exigen
 * las mutaciones lo pone el `csrf-interceptor`; aquí no se toca.
 */
@Injectable({ providedIn: 'root' })
export class TipMovCajaApi {
  private readonly api = inject(ApiService);
  private readonly base = '/tipos-movimiento-caja';

  /**
   * Catálogo filtrado, ordenado por nombre. Sin filtros devuelve la tabla entera.
   *
   * Los filtros van al backend aunque la pantalla podría resolverlos en memoria: son los que
   * el legacy manda al servidor, y mantenerlos en el contrato deja la puerta abierta a que un
   * día la tabla crezca sin cambiar el cliente.
   */
  list(filtros: TipMovCajaFiltros = {}): Observable<TipMovCaja[]> {
    const params: Record<string, string> = {};
    if (filtros.nombre?.trim()) params['nombre'] = filtros.nombre.trim();
    if (filtros.tipo) params['tipo'] = filtros.tipo;
    if (filtros.estado) params['estado'] = filtros.estado;
    return this.api.get<TipMovCaja[]>(this.base, params);
  }

  get(tipoid: number): Observable<TipMovCaja> {
    return this.api.get<TipMovCaja>(`${this.base}/${tipoid}`);
  }

  /**
   * Alta. El backend deja el registro activo y sin exigir mes/año; ninguno de los dos viaja en
   * el cuerpo, porque cada uno tiene su ruta.
   */
  create(input: TipMovCajaInput): Observable<TipMovCaja> {
    return this.api.post<TipMovCaja>(this.base, input);
  }

  /**
   * Edición.
   *
   * No viajan `estado` ni `requerir_mesanio` —cada uno tiene su ruta— ni `estructura`,
   * `pcgr_general` o `pcgr_empresarial`: el backend las conserva solo. Eso CORRIGE al legacy,
   * que las borra en cada guardado porque su formulario las tiene comentadas.
   */
  update(tipoid: number, input: TipMovCajaInput): Observable<TipMovCaja> {
    return this.api.put<TipMovCaja>(`${this.base}/${tipoid}`, input);
  }

  /** Elimina (204). Falla con 409 si hay movimientos de caja con ese tipo. */
  remove(tipoid: number): Observable<void> {
    return this.api.delete<void>(`${this.base}/${tipoid}`);
  }

  /**
   * Borrado en lote: UNA petición, no N. Responde 200 con el resultado por id porque el lote
   * es parcial por diseño. El backend acota a 200.
   */
  removeLote(ids: readonly number[]): Observable<ResultadoLoteTipMovCaja[]> {
    return this.api.post<ResultadoLoteTipMovCaja[]>(`${this.base}/lote/eliminar`, { ids });
  }

  /** Alterna el estado. Es un TOGGLE: devuelve el estado RESULTANTE. */
  alternarEstado(tipoid: number): Observable<TipMovCajaEstado> {
    return this.api.post<TipMovCajaEstado>(`${this.base}/${tipoid}/estado/alternar`, {});
  }

  /**
   * Alterna si el movimiento exige mes y año. El SEGUNDO interruptor del recurso; también es
   * un toggle y también devuelve el valor RESULTANTE.
   */
  alternarRequerirMesAnio(tipoid: number): Observable<TipMovCajaRequerirMesAnio> {
    return this.api.post<TipMovCajaRequerirMesAnio>(
      `${this.base}/${tipoid}/requerir-mes-anio/alternar`,
      {},
    );
  }
}
