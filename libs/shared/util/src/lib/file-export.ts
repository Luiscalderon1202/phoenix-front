/**
 * Exportadores de tabla SIN dependencias. Reciben una matriz (la primera fila = encabezados)
 * y disparan la descarga en el navegador.
 *  - `exportCsv`: CSV real (UTF-8 con BOM para que Excel respete los acentos).
 *  - `exportXls`: tabla HTML con extensión `.xls`; Excel la abre (muestra un aviso menor de
 *    "formato no coincide"). Evita meter una librería de xlsx solo para esto.
 *
 * Los números van crudos (sin separador de miles) para que Excel los interprete como números.
 */
export type ExportCell = string | number;

function triggerDownload(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function csvCell(v: ExportCell, sep: string): string {
  const s = v == null ? '' : String(v);
  return s.includes('"') || s.includes(sep) || s.includes('\n') || s.includes('\r')
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

/** Exporta a CSV. Separador por defecto `;` (lo que abre directo en Excel es-PE). */
export function exportCsv(filename: string, matrix: ExportCell[][], sep = ';'): void {
  const csv = matrix.map((row) => row.map((c) => csvCell(c, sep)).join(sep)).join('\r\n');
  triggerDownload(filename, new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }));
}

/** Columna para exportar respuestas-objeto: `key` extrae el valor, `label` es el encabezado. */
export interface ExportColumn {
  key: string;
  label?: string;
}

/**
 * Convierte filas-objeto en matriz `[encabezados, ...filas]`. Si se pasan `columns`, define el
 * orden y los encabezados (label, con tildes/ñ); si no, usa las claves de la primera fila.
 */
export function objectsToMatrix(
  rows: readonly Record<string, ExportCell>[],
  columns?: readonly ExportColumn[],
): ExportCell[][] {
  const cols: readonly ExportColumn[] =
    columns && columns.length
      ? columns
      : rows.length
        ? Object.keys(rows[0]).map((key) => ({ key }))
        : [];
  const header = cols.map((c) => c.label ?? c.key);
  return [header, ...rows.map((r) => cols.map((c) => r[c.key]))];
}

function htmlCell(v: ExportCell): string {
  return (v == null ? '' : String(v))
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function exportXls(filename: string, matrix: ExportCell[][]): void {
  const body = matrix
    .map((row, i) => {
      const tag = i === 0 ? 'th' : 'td';
      return `<tr>${row.map((c) => `<${tag}>${htmlCell(c)}</${tag}>`).join('')}</tr>`;
    })
    .join('');
  const html = `<html><head><meta charset="utf-8"></head><body><table border="1">${body}</table></body></html>`;
  // BOM + meta utf-8: Excel respeta tildes/ñ al abrir el .xls.
  triggerDownload(filename, new Blob(['﻿' + html], { type: 'application/vnd.ms-excel' }));
}

/** Máximo de caracteres de un tramo variable (p. ej. la entidad) en el nombre del archivo. */
const MAX_SLUG = 40;

/**
 * Etiqueta → tramo seguro para un nombre de archivo: sin tildes, en minúsculas y con guiones.
 * Se recorta a {@link MAX_SLUG} para que nombres largos no revienten el límite del sistema.
 */
export function fileSlug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG)
    .replace(/-+$/, '');
}
