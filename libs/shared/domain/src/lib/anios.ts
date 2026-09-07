import { CatalogoItem } from './catalogo-item';

/**
 * Genera el catálogo de años en runtime (sin BD). A diferencia de los meses —fijos—, los años
 * "se mueven": una lista constante quedaría obsoleta cada 1 de enero, por eso es una función
 * relativa al año actual.
 *
 * Por defecto: 5 años hacia atrás incluyendo el actual, en orden descendente (el más reciente
 * primero, que es lo habitual en un filtro). Ajusta `back`/`forward` por formulario.
 *
 * @param back    años hacia atrás desde `base` (incluido el actual). Default 5.
 * @param forward años hacia adelante desde `base`. Default 0.
 * @param base    año de referencia. Default: año actual (parametrizable para tests).
 */
export function aniosCatalogo(
  back = 5,
  forward = 0,
  base: number = new Date().getFullYear(),
): CatalogoItem[] {
  const items: CatalogoItem[] = [];
  for (let year = base + forward; year >= base - back + 1; year--) {
    items.push({ label: String(year), value: year });
  }
  return items;
}
