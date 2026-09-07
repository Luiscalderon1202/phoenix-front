/**
 * Base para parámetros de listado paginado. Los queries de cada módulo extienden de aquí.
 */
export interface PageQuery {
  page: number;
  pageSize: number;
  search?: string;
}
