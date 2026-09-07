import { inject, InjectionToken } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, from, of, switchMap, throwError, type Observable } from 'rxjs';
import type { ApiEnvelope, ApiError } from '@phoenix/shared/api';
import { GENERIC_ERROR_MESSAGE, isApiError } from '@phoenix/shared/api';

/**
 * Sink de notificaciones para errores. Lo provee la app shell (toast real, atado al
 * `NotificationService`). Por defecto sólo loguea, para no acoplar `shared/http` a una
 * librería de UI (evita el ciclo http↔ui; el cableado vive en el composition root).
 */
export interface NotificationSink {
  error(message: string): void;
}

export const NOTIFICATION_SINK = new InjectionToken<NotificationSink>('ERP_NOTIFICATION_SINK', {
  providedIn: 'root',
  factory: () => ({ error: (message: string) => console.error('[ERP]', message) }),
});

/**
 * Normaliza CUALQUIER error del stream HTTP al contrato `ApiError`
 * (`{ code, message, status, requestId }`), sin importar el origen:
 * - `status:'error'` del envelope (HTTP 200) → ya viene como `ApiError`; sólo completa `status`.
 * - `HttpErrorResponse` → extrae `error.message` y `error.error.code` del envelope del backend.
 *   En 4xx el `message` es seguro de mostrar; en 5xx o error de red (status 0) usa el genérico.
 * - Cualquier otra cosa → error genérico.
 */
export function normalizeHttpError(err: unknown): ApiError {
  if (isApiError(err)) {
    return { ...err, status: err.status ?? 200 };
  }
  if (err instanceof HttpErrorResponse) {
    const body = (err.error ?? null) as Partial<ApiEnvelope<unknown>> | null;
    const status = err.status;
    const backendMessage = typeof body?.message === 'string' ? body.message : undefined;
    const message =
      status >= 500 || status === 0
        ? GENERIC_ERROR_MESSAGE
        : backendMessage ?? GENERIC_ERROR_MESSAGE;
    return {
      code: body?.error?.code ?? 'UNKNOWN',
      message,
      status,
      requestId: body?.request_id,
    };
  }
  return { code: 'UNKNOWN', message: GENERIC_ERROR_MESSAGE, status: 0 };
}

/**
 * Normaliza un error asíncronamente porque el cuerpo puede ser un `Blob`: en las peticiones con
 * `responseType: 'blob'` (descargas) el envelope de error llega como Blob y `normalizeHttpError`
 * —síncrono— no puede leerlo, así que el mensaje de negocio del backend se perdía y salía el
 * genérico. Aquí se lee el texto, se rehidrata el envelope y se normaliza como cualquier otro.
 */
function normalizeHttpErrorAsync(err: unknown): Observable<ApiError> {
  if (err instanceof HttpErrorResponse && err.error instanceof Blob) {
    return from(err.error.text()).pipe(
      switchMap((text) => {
        let body: unknown = null;
        try {
          body = JSON.parse(text);
        } catch {
          body = null;
        }
        return of(
          normalizeHttpError(
            new HttpErrorResponse({
              error: body,
              status: err.status,
              statusText: err.statusText,
              url: err.url ?? undefined,
            }),
          ),
        );
      }),
    );
  }
  return of(normalizeHttpError(err));
}

/**
 * Frontera de errores de la app (interceptor MÁS EXTERNO). Normaliza todo lo que escape de la
 * cadena, lo muestra una sola vez (toast) y re-emite el `ApiError` normalizado para que páginas y
 * servicios reaccionen sin re-parsear.
 *
 * - 401 NO se notifica aquí: lo gestiona `refresh-interceptor` (reintento) o el login (UX inline).
 * - 5xx además se loguea para diagnóstico (mensaje al usuario siempre genérico).
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const notifier = inject(NOTIFICATION_SINK);

  return next(req).pipe(
    catchError((err: unknown) =>
      normalizeHttpErrorAsync(err).pipe(
        switchMap((error) => {
          if (error.status !== 401) {
            notifier.error(error.message);
          }
          if ((error.status ?? 0) >= 500) {
            console.error('[ERP] 5xx', req.method, req.url, err);
          }

          return throwError(() => error);
        }),
      ),
    ),
  );
};
