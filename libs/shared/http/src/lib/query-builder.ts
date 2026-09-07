import { HttpParams } from '@angular/common/http';

export type QueryParams = Record<string, string | number | boolean | undefined | null>;

/**
 * Construye `HttpParams` desde un objeto de query, descartando `undefined`/`null`.
 */
export function buildHttpParams(params: QueryParams = {}): HttpParams {
  let httpParams = new HttpParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      httpParams = httpParams.set(key, String(value));
    }
  }
  return httpParams;
}
