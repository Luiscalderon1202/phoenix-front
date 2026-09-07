/**
 * Utilidades base64url (sin padding), usadas por los proofs DPoP-style del device-key.
 * TypeScript puro, sin dependencias de Angular.
 */
export function base64UrlEncode(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < view.length; i++) {
    binary += String.fromCharCode(view[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function utf8ToBase64Url(value: string): string {
  return base64UrlEncode(new TextEncoder().encode(value));
}
