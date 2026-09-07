/**
 * Paginación server-side. Acompaña a las respuestas de listas.
 */
export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** Meta vacía por defecto, útil como estado inicial de un store. */
export const EMPTY_META: PageMeta = { page: 1, pageSize: 20, total: 0, totalPages: 0 };
