/**
 * Primer filtro de subida de archivos en el cliente. Espeja la regla del backend
 * (`internal/shared/fileguard`): es una comodidad de UX (feedback inmediato), NO
 * una barrera de seguridad — el servidor siempre re-valida por contenido.
 */

/** Techo duro global de tamaño por archivo (25 MiB), igual que el backend. */
export const MAX_UPLOAD_MB = 25;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

/**
 * Extensiones bloqueadas siempre (markup activo, scripts y ejecutables),
 * sin importar el `allowed_mime` de la definición. Espeja `extPeligrosas` del
 * backend.
 */
const EXT_PELIGROSAS = new Set([
  'html', 'htm', 'xhtml', 'shtml', 'svg', 'xml', 'js', 'mjs', 'cjs', 'htaccess',
  'php', 'php3', 'php4', 'php5', 'phtml', 'phar', 'jsp', 'asp', 'aspx', 'cgi',
  'exe', 'dll', 'so', 'bat', 'cmd', 'com', 'sh', 'bash', 'ps1', 'msi', 'jar',
  'vbs', 'wsf', 'hta', 'scr',
]);

/** Extrae la extensión en minúsculas (sin punto) del nombre del archivo. */
function extname(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? '';
  const i = base.lastIndexOf('.');
  return i > 0 ? base.slice(i + 1).toLowerCase() : '';
}

/**
 * Reglas DURAS universales, independientes de la config: archivo no vacío,
 * extensión no peligrosa y tope global de 25 MB. Devuelve el error o `null`.
 * Úsala en cualquier input de archivo aunque tenga su propia validación de tipo.
 */
export function checkUploadHardLimits(file: File): string | null {
  if (file.size === 0) {
    return 'El archivo está vacío.';
  }
  if (EXT_PELIGROSAS.has(extname(file.name))) {
    return 'El tipo de archivo no está permitido por seguridad.';
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `El archivo supera el máximo de ${MAX_UPLOAD_MB} MB.`;
  }
  return null;
}

export interface UploadLimits {
  /** Máx. MB de la definición; se aplica el menor entre esto y MAX_UPLOAD_MB. */
  maxMb?: number | null;
  /** Lista blanca de MIME de la definición (vacío/null = cualquiera permitido). */
  allowedMime?: string[] | null;
}

/**
 * Valida un archivo elegido contra el tope duro global, el límite de la
 * definición y la lista blanca de tipos. Devuelve el mensaje de error o `null`.
 */
export function validateUploadFile(file: File, limits: UploadLimits = {}): string | null {
  const hard = checkUploadHardLimits(file);
  if (hard) return hard;
  // Límite de negocio por debajo del techo duro (ya cubierto por checkUploadHardLimits).
  if (limits.maxMb != null && limits.maxMb > 0 && file.size > limits.maxMb * 1024 * 1024) {
    return `El archivo supera el máximo de ${limits.maxMb} MB.`;
  }
  const mimes = limits.allowedMime;
  if (mimes && mimes.length && !mimes.includes(file.type)) {
    return `Tipo de archivo no permitido. Permitidos: ${mimes.join(', ')}.`;
  }
  return null;
}
