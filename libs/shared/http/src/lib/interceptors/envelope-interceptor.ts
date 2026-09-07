import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { map } from 'rxjs';
import type { ApiEnvelope, ApiError } from '@phoenix/shared/api';

function isEnvelope(body: unknown): body is ApiEnvelope<unknown> {
  return !!body && typeof body === 'object' && 'status' in body && 'request_id' in body;
}

/**
 * Detecta `status:'error'` en el envelope del backend (§10) y lanza el `ApiError`.
 *
 * El `message` legible viene en la raíz del envelope; `error.code` es el identificador
 * estable. NO desempaqueta `data` (eso lo hace `ApiService`), para no perder `meta` en listas.
 */
export const envelopeInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    map((event) => {
      if (event instanceof HttpResponse && isEnvelope(event.body)) {
        if (event.body.status === 'error') {
          const error: ApiError = {
            code: event.body.error?.code ?? 'UNKNOWN',
            message: event.body.message ?? 'Operación no exitosa',
          };
          throw error;
        }
      }
      return event;
    }),
  );
};
