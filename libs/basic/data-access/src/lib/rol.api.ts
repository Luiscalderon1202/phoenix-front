import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiService } from '@phoenix/shared/http';
import type { Rol } from '@phoenix/basic/domain';

/**
 * Catálogo de roles (`GET /catalogos/roles`). Solo lectura: el mantenimiento del catálogo
 * sigue en el legacy. Alimenta el combo de rol del filtro de Personas.
 */
@Injectable({ providedIn: 'root' })
export class RolApi {
  private readonly api = inject(ApiService);

  list(): Observable<Rol[]> {
    return this.api.get<Rol[]>('/catalogos/roles');
  }
}
