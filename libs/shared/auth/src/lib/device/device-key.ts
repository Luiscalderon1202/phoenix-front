import { Injectable } from '@angular/core';
import { utf8ToBase64Url, base64UrlEncode } from '@phoenix/shared/util';
import { idbGet, idbSet } from './idb';

const KEY_PRIVATE = 'erp.device.key';
const KEY_PUBLIC = 'erp.device.pub';

interface DeviceProofClaims {
  htm: string; // HTTP method
  htu: string; // HTTP target URI
  iat: number; // issued-at (epoch seconds)
  nonce: string;
}

/**
 * Clave de dispositivo (proof-of-possession anti-exfiltración).
 *
 * - Genera un par ECDSA P-256 con la PRIVADA **no-extraíble** (`extractable=false`).
 *   `exportKey()` sobre la privada lanza error → no se puede copiar por JS ni con XSS.
 * - La `CryptoKey` privada vive en IndexedDB (sigue siendo no-extraíble). Esto NO es un token.
 * - La pública (JWK) se registra en el servidor en el login para ligar la sesión a esta clave.
 * - En refresh (y requests sensibles) se firma un proof DPoP-style.
 */
@Injectable({ providedIn: 'root' })
export class DeviceKey {
  /** Garantiza que exista el par de claves; lo crea en el primer arranque/login. */
  async ensure(): Promise<void> {
    const existing = await idbGet<CryptoKey>(KEY_PRIVATE);
    if (existing) {
      return;
    }
    const pair = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      false, // extractable=false → aplica a la PRIVADA; la pública siempre es exportable
      ['sign', 'verify'],
    );
    const publicJwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
    await idbSet(KEY_PRIVATE, pair.privateKey); // CryptoKey no-extraíble en IndexedDB
    await idbSet(KEY_PUBLIC, publicJwk);
  }

  /** Clave pública (JWK) para registrar en el login. `undefined` si aún no hay clave. */
  async publicJwk(): Promise<JsonWebKey | undefined> {
    return idbGet<JsonWebKey>(KEY_PUBLIC);
  }

  /**
   * Firma un proof DPoP-style para `method`+`url`.
   * Devuelve `<base64url(payload)>.<base64url(sig)>` o `null` si no hay clave
   * (navegador nuevo / borrado → el servidor pedirá login). Comportamiento esperado.
   */
  async createProof(method: string, url: string): Promise<string | null> {
    const privateKey = await idbGet<CryptoKey>(KEY_PRIVATE);
    if (!privateKey) {
      return null;
    }
    const claims: DeviceProofClaims = {
      htm: method.toUpperCase(),
      htu: url,
      iat: Math.floor(Date.now() / 1000),
      nonce: crypto.randomUUID(),
    };
    const payloadB64 = utf8ToBase64Url(JSON.stringify(claims));
    const signature = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      privateKey,
      new TextEncoder().encode(payloadB64),
    );
    return `${payloadB64}.${base64UrlEncode(signature)}`;
  }
}
