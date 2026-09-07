import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import type { ApiEnvelope } from '@phoenix/shared/api';
import {
  API_BASE_URL,
  AUTH_LOGIN,
  AUTH_LOGOUT,
  AUTH_REFRESH,
  AUTH_SWITCH_TENANT,
  AUTH_CAMBIAR_CLAVE,
} from '@phoenix/shared/http';
import type { AuthSessionPayload, CambioClave } from './auth-user';

/** Body de login que espera el backend (`{ usuario, clave, corporacionId }`). */
export interface LoginRequestBody {
  usuario: string;
  clave: string;
  corporacionId?: number;
  devicePublicJwk?: JsonWebKey;
}

/**
 * Cliente HTTP de los endpoints de autenticación.
 *
 * Las cookies httpOnly viajan por el `credentials-interceptor` (withCredentials global), así
 * que aquí no se setea por request. El `envelope-interceptor` solo valida el envelope; este
 * cliente desempaqueta `data` (los endpoints de auth NO pasan por `ApiService`).
 */
@Injectable({ providedIn: 'root' })
export class AuthApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  login(body: LoginRequestBody): Observable<AuthSessionPayload> {
    return this.http
      .post<ApiEnvelope<AuthSessionPayload>>(`${this.baseUrl}${AUTH_LOGIN}`, body)
      .pipe(map((e) => e.data as AuthSessionPayload));
  }

  refresh(): Observable<AuthSessionPayload> {
    return this.http
      .post<ApiEnvelope<AuthSessionPayload>>(`${this.baseUrl}${AUTH_REFRESH}`, {})
      .pipe(map((e) => e.data as AuthSessionPayload));
  }

  logout(): Observable<void> {
    return this.http
      .post<ApiEnvelope<null>>(`${this.baseUrl}${AUTH_LOGOUT}`, {})
      .pipe(map(() => void 0));
  }

  /**
   * El propio usuario cambia su contraseña. Es la salida del cambio obligatorio:
   * sin esto, quien recibe una clave temporal dependería de un administrador.
   */
  cambiarClave(cambio: CambioClave): Observable<void> {
    return this.http
      .put<ApiEnvelope<unknown>>(`${this.baseUrl}${AUTH_CAMBIAR_CLAVE}`, cambio)
      .pipe(map(() => void 0));
  }

  switchTenant(corporacionId: number): Observable<AuthSessionPayload> {
    return this.http
      .post<ApiEnvelope<AuthSessionPayload>>(`${this.baseUrl}${AUTH_SWITCH_TENANT}`, { corporacionId })
      .pipe(map((e) => e.data as AuthSessionPayload));
  }
}
