import { CatalogoItem } from './catalogo-item';

/**
 * Meses del año (1-12). Catálogo estático y fijo, reutilizable como filtro en
 * cualquier formulario. El `value` es el número de mes (1 = Enero … 12 = Diciembre).
 */
export const MESES: readonly CatalogoItem[] = [
  { label: 'Enero', value: 1 },
  { label: 'Febrero', value: 2 },
  { label: 'Marzo', value: 3 },
  { label: 'Abril', value: 4 },
  { label: 'Mayo', value: 5 },
  { label: 'Junio', value: 6 },
  { label: 'Julio', value: 7 },
  { label: 'Agosto', value: 8 },
  { label: 'Setiembre', value: 9 },
  { label: 'Octubre', value: 10 },
  { label: 'Noviembre', value: 11 },
  { label: 'Diciembre', value: 12 },
];
