import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import type { ApiEnvelope, PageMeta } from '@phoenix/shared/api';
import { toPageMeta } from '@phoenix/shared/api';
import { API_BASE_URL } from './api-config';
import { buildHttpParams, type QueryParams } from './query-builder';

export interface PagedResult<T> {
  data: T[];
  meta: PageMeta;
}

/**
 * Cliente tipado sobre el envelope del backend (§10): `{ status, data, meta, ... }`.
 * - `get<T>`: desempaqueta `data`.
 * - `getList<T>`: **conserva `meta`** (paginación server-side, convertida a PageMeta).
 *
 * El `envelope-interceptor` ya transformó `status:'error'` en un `ApiError`,
 * así que aquí asumimos respuestas exitosas.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  get<T>(url: string, params: QueryParams = {}): Observable<T> {
    return this.http
      .get<ApiEnvelope<T>>(`${this.baseUrl}${url}`, { params: buildHttpParams(params) })
      .pipe(map((envelope) => envelope.data as T));
  }

  getList<T>(url: string, params: QueryParams = {}): Observable<PagedResult<T>> {
    return this.http
      .get<ApiEnvelope<T[]>>(`${this.baseUrl}${url}`, { params: buildHttpParams(params) })
      .pipe(map((envelope) => ({ data: envelope.data ?? [], meta: toPageMeta(envelope.meta) })));
  }

  post<T>(url: string, body: unknown): Observable<T> {
    return this.http
      .post<ApiEnvelope<T>>(`${this.baseUrl}${url}`, body)
      .pipe(map((envelope) => envelope.data as T));
  }

  put<T>(url: string, body: unknown): Observable<T> {
    return this.http
      .put<ApiEnvelope<T>>(`${this.baseUrl}${url}`, body)
      .pipe(map((envelope) => envelope.data as T));
  }

  patch<T>(url: string, body: unknown = {}): Observable<T> {
    return this.http
      .patch<ApiEnvelope<T>>(`${this.baseUrl}${url}`, body)
      .pipe(map((envelope) => envelope.data as T));
  }

  delete<T>(url: string, body?: unknown): Observable<T> {
    return this.http
      .delete<ApiEnvelope<T>>(`${this.baseUrl}${url}`, { body })
      .pipe(map((envelope) => envelope.data as T));
  }

  /** Descarga un recurso como Blob (PDF, Excel, etc.). El llamador aporta el nombre de archivo. */
  getBlob(url: string, params: QueryParams = {}): Observable<Blob> {
    return this.http.get(`${this.baseUrl}${url}`, {
      params: buildHttpParams(params),
      responseType: 'blob',
    });
  }

  /**
   * Igual que {@link getBlob} pero devuelve además el nombre de archivo que manda el backend en
   * `Content-Disposition` (requiere `Access-Control-Expose-Headers` en el servidor). `filename`
   * es `null` cuando la cabecera no viene o no es legible: ahí el llamador pone el suyo.
   */
  getBlobWithName(url: string, params: QueryParams = {}): Observable<NamedBlob> {
    return this.http
      .get(`${this.baseUrl}${url}`, {
        params: buildHttpParams(params),
        responseType: 'blob',
        observe: 'response',
      })
      .pipe(
        map((res) => ({
          blob: res.body ?? new Blob(),
          filename: filenameFromContentDisposition(res.headers.get('Content-Disposition')),
        })),
      );
  }

  /**
   * POST que devuelve un binario (p. ej. generar un PDF). Es POST y no GET
   * porque genera algo: repetirlo no es inocuo y no debe quedar cacheado ni en
   * el historial del navegador.
   */
  postBlob(url: string, params: QueryParams = {}, body: unknown = {}): Observable<NamedBlob> {
    return this.http
      .post(`${this.baseUrl}${url}`, body, {
        params: buildHttpParams(params),
        responseType: 'blob',
        observe: 'response',
      })
      .pipe(
        map((res) => ({
          blob: res.body ?? new Blob(),
          filename: filenameFromContentDisposition(res.headers.get('Content-Disposition')),
        })),
      );
  }
}

/** Blob + el nombre de archivo que dictó el backend (`null` si no lo mandó). */
export interface NamedBlob {
  blob: Blob;
  filename: string | null;
}

/**
 * Extrae el nombre de archivo de un `Content-Disposition`. Prioriza `filename*` (RFC 5987, el
 * que trae acentos percent-encoded) sobre el `filename` simple, con o sin comillas.
 */
export function filenameFromContentDisposition(header: string | null): string | null {
  if (!header) return null;
  const extendido = /filename\*=(?:UTF-8|utf-8)''([^;]+)/.exec(header)?.[1];
  if (extendido) {
    try {
      return decodeURIComponent(extendido.trim());
    } catch {
      return extendido.trim();
    }
  }
  return /filename="?([^";]+)"?/.exec(header)?.[1]?.trim() || null;
}
