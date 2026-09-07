import type { PageMeta } from './page-meta';

/**
 * Error normalizado de la API. Contrato ÚNICO que produce el `error-interceptor` para CUALQUIER
 * fallo (HTTP 4xx/5xx, error de red o `status:'error'` del envelope), de modo que cualquier
 * `catch`/`subscribe` lea estos campos sin re-parsear.
 * `code` es estable para reaccionar sin parsear `message`.
 */
export interface ApiError {
  code: string;
  /** Texto listo para mostrar: seguro en 4xx; genérico en 5xx/red. */
  message: string;
  /** Status HTTP (0 = error de red; 200 = error de negocio del envelope). */
  status?: number;
  /** `request_id` del backend, para correlacionar con su log. */
  requestId?: string;
  details?: unknown;
}

/** Fallback cuando no hay un `message` seguro que mostrar (red, 5xx, error desconocido). */
export const GENERIC_ERROR_MESSAGE = 'Ocurrió un error inesperado.';

/** Type guard: `true` si el valor ya tiene la forma normalizada `ApiError`. */
export function isApiError(e: unknown): e is ApiError {
  return (
    !!e &&
    typeof e === 'object' &&
    typeof (e as ApiError).code === 'string' &&
    typeof (e as ApiError).message === 'string'
  );
}

/**
 * Meta de paginación tal como la emite el backend (snake_case).
 */
export interface ApiMeta {
  page: number;
  page_size: number;
  total: number;
}

/**
 * Envelope estándar del backend (AGENTS.md §10). Misma forma SIEMPRE:
 *   { status, message?, data? | error?, meta?, request_id }
 * - `status: 'error'` debe disparar un ApiError en el interceptor.
 * - el `message` legible vive en la RAÍZ (no dentro de `error`); `error` solo trae `code`.
 * - `meta` solo viaja en listas paginadas.
 * - `request_id` siempre, para correlacionar con el log del servidor.
 */
export interface ApiEnvelope<T> {
  status: 'success' | 'error';
  message?: string;
  data?: T;
  meta?: ApiMeta | null;
  error?: { code: string } | null;
  request_id: string;
}

/** Convierte la meta del backend (snake_case) a la PageMeta del front (camelCase). */
export function toPageMeta(meta: ApiMeta | null | undefined): PageMeta {
  if (!meta) {
    return { page: 1, pageSize: 20, total: 0, totalPages: 0 };
  }
  const pageSize = meta.page_size || 20;
  return {
    page: meta.page,
    pageSize,
    total: meta.total,
    totalPages: pageSize > 0 ? Math.ceil(meta.total / pageSize) : 0,
  };
}
