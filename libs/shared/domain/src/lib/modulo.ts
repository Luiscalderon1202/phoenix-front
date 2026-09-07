import { CatalogoItem } from './catalogo-item';

/**
 * Módulos funcionales del ERP. Catálogo estático y fijo (tabla `modulo`).
 * Se usa como parámetro de intención al pedir filtros org-scope: cada formulario pasa
 * el módulo al que pertenece (p. ej. `MODULO.CONTABILIDAD`) para que el backend recorte.
 * La corporación (tenant) viaja aparte por el contexto; el módulo es lo único que envía el front.
 */
export const MODULO = {
  BASICO: 1,
  CONTABILIDAD: 2,
  TALENTO_HUMANO: 3,
  GESTION_MINISTERIAL: 4,
} as const;

/** Id de módulo (1-4). */
export type Modulo = (typeof MODULO)[keyof typeof MODULO];

/** Catálogo etiqueta/valor por si se necesita mostrar el módulo en un select. */
export const MODULOS: readonly CatalogoItem[] = [
  { label: 'Básico', value: MODULO.BASICO },
  { label: 'Contabilidad', value: MODULO.CONTABILIDAD },
  { label: 'Gestión del Talento Humano', value: MODULO.TALENTO_HUMANO },
  { label: 'Gestión Ministerial', value: MODULO.GESTION_MINISTERIAL },
];
