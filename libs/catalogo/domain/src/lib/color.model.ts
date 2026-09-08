/**
 * Modelos del dominio Color (`catalogo.color`, proceso `CAT-COLOR`).
 *
 * Cuelga directamente del producto (`catalogo.producto.colorid`), como talla y laboratorio.
 *
 * ⚠ ESTA PANTALLA NO TENÍA OPCIÓN DE MENÚ EN EL LEGACY. `Color.php` existe y declara
 * `$segProcesoMenu="CAT-COLOR"`, pero no hay fila en `basic.menuweb` con ese proceso: al PHP
 * solo se llega por URL directa o desde el formulario de producto. La fila la crea Phoenix,
 * con el proceso que el `.php` ya declaraba y no con uno inventado.
 *
 * El listado devuelve el catálogo ENTERO, sin `meta`. La pantalla filtra por estado y pagina
 * en cliente.
 *
 * ⚠ LA COLUMNA `color` DE LA TABLA NO ESTÁ EN ESTE MODELO, y es a propósito. Está muerta en
 * las tres capas del legacy —`ColorEdit.php` no tiene input, `color.js` pinta la celda vacía y
 * `ajColor.php` manda un campo que el formulario nunca envía, con lo que **cada guardado la
 * borra**—. El backend la PRESERVA sin exponerla: relee la fila y le devuelve al stored
 * procedure el valor que ya había. Si algún día se le da pantalla, el dato seguirá ahí.
 *
 * La fuente de verdad es `phoenix-api/api/openapi.yaml`.
 */

/** Fila del listado (`GET /colores`). Nunca hay nulls: el legacy usa cadena vacía. */
export interface Color {
  colorid: number;
  nombre: string;
  /** Etiqueta corta. Puede venir vacía. */
  abreviatura: string;
  /** Posición en la lista. Se cambia con `PATCH /colores/orden`, nunca con el `PUT`. */
  orden: number;
  /**
   * Se cambia con `POST /colores/{id}/estado/alternar`, nunca con el `PUT`.
   *
   * ⚠ El listado NO oculta los inactivos: ese filtro lo pone el cliente.
   */
  estado: boolean;
  /**
   * DERIVADO y de SOLO LECTURA: no existe como columna. Lo calcula la base contando
   * `catalogo.producto` por color.
   */
  cantidad_productos: number;
}

/**
 * Cuerpo del alta y de la edición.
 *
 * Sin `cantidad_productos` (derivado), sin `estado` ni `orden` —cada uno tiene su ruta— y sin
 * la columna `color`, que el backend preserva pero no expone.
 */
export interface ColorInput {
  nombre: string;
  abreviatura: string;
}

/**
 * Filtros de `GET /colores`. Solo el nombre. NO hay paginación: el endpoint devuelve el
 * catálogo entero.
 */
export interface ColorFiltros {
  /** Búsqueda parcial por nombre, insensible a mayúsculas y a acentos. */
  q?: string;
}

/** Respuesta de `POST /colores/{id}/estado/alternar`: el estado RESULTANTE del toggle. */
export interface ColorEstado {
  colorid: number;
  estado: boolean;
}

/**
 * Resultado por id de `POST /colores/lote/eliminar`. Un color puede fallar (tiene productos)
 * mientras el resto sí se elimina.
 */
export interface ResultadoLoteColor {
  colorid: number;
  ok: boolean;
  /** Solo cuando `ok` es `false`: mensaje listo para mostrar. */
  mensaje?: string;
  /** Solo cuando `ok` es `false`: código estable del error. */
  codigo?: string;
}

/**
 * Límites de las columnas de texto, que el backend también valida.
 *
 * ⚠ Salen de la COLUMNA: `ColorEdit.php` declara `maxlength=20` para la abreviatura sobre un
 * `varchar(10)`.
 */
/** Límite de `nombre` (`varchar(50)`). */
export const COLOR_MAX_NOMBRE = 50;
/** Límite de `abreviatura` (`varchar(10)`), no los 20 que promete el formulario del legacy. */
export const COLOR_MAX_ABREVIATURA = 10;
