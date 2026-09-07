/**
 * Item genérico de catálogo (par etiqueta/valor) para selects, filtros y dropdowns.
 * Sin dependencias de Angular. El valor puede ser número o string segun el catálogo.
 *
 * Para catálogos estáticos y fijos (no cambian: meses, géneros, tipos de documento…)
 * declara la constante en `shared/domain`. Los catálogos dinámicos (servidor) viven
 * en master-data.
 */
export interface CatalogoItem<T = number> {
  label: string;
  value: T;
}
