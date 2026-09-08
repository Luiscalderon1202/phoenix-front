import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiService } from '@phoenix/shared/http';
import type {
  Empresa,
  EmpresaEstado,
  EmpresaFicha,
  EmpresaInput,
} from '@phoenix/basic/domain';

/**
 * Empresas del grupo (`basic.empresa`, proceso `EMPRESA`). CRUD completo.
 *
 * ⚠ `GET /empresas` devuelve el catálogo COMPLETO, sin `meta` y **sin aceptar ningún
 * filtro**. No es una decisión de diseño: `basic.paempresa_leer()` no acepta ningún
 * argumento —ni texto, ni estado, ni página—, al contrario que su hermana de locales, que
 * tiene cuatro. Por eso `list()` no recibe nada y la pantalla filtra en cliente.
 *
 * ⚠ **No hay borrado en lote**, y no por omisión: contra `basic.empresa` apuntan más de
 * veinte claves foráneas. Borrar la persona jurídica que factura no se hace marcando
 * casillas.
 *
 * El header `X-CSRF-Token` de las mutaciones lo pone el `csrf-interceptor`.
 */
@Injectable({ providedIn: 'root' })
export class EmpresaApi {
  private readonly api = inject(ApiService);
  private readonly base = '/empresas';

  /** Catálogo completo, ya ordenado por `orden` desde el backend. */
  list(): Observable<Empresa[]> {
    return this.api.get<Empresa[]>(this.base);
  }

  /**
   * Ficha del formulario. ⚠ NO es la fila del listado: añade país, ubigeo e IGV. Devuelve la
   * empresa esté activa o no, que hace falta para poder editar una desactivada.
   */
  get(empresaid: number): Observable<EmpresaFicha> {
    return this.api.get<EmpresaFicha>(`${this.base}/${empresaid}`);
  }

  /** Alta. El backend asigna `orden` y la deja activa; no se le mandan. */
  create(input: EmpresaInput): Observable<EmpresaFicha> {
    return this.api.post<EmpresaFicha>(this.base, input);
  }

  /** Edición. No toca `orden`, `estado` ni el IGV. */
  update(empresaid: number, input: EmpresaInput): Observable<EmpresaFicha> {
    return this.api.put<EmpresaFicha>(`${this.base}/${empresaid}`, input);
  }

  /** Elimina (204). Falla con 409 si la empresa tiene ventas o series registradas. */
  remove(empresaid: number): Observable<void> {
    return this.api.delete<void>(`${this.base}/${empresaid}`);
  }

  /**
   * Alterna el estado. Es un TOGGLE, no un setter: no recibe el valor deseado y reintentar
   * la petición deshace el cambio. Devuelve el estado RESULTANTE.
   */
  alternarEstado(empresaid: number): Observable<EmpresaEstado> {
    return this.api.post<EmpresaEstado>(`${this.base}/${empresaid}/estado/alternar`, {});
  }

  /**
   * Persiste el orden. `ids` en el orden deseado y `desde` la posición 1-based de la
   * primera: el backend calcula `orden = posición + (desde-1)`.
   */
  reordenar(ids: readonly number[], desde = 1): Observable<void> {
    return this.api.patch<void>(`${this.base}/orden`, { ids, desde });
  }
}
