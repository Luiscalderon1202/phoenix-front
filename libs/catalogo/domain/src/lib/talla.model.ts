/**
 * Modelos del dominio Talla (`catalogo.talla`, proceso `CAT-TALLA`).
 *
 * Cuelga directamente del producto (`catalogo.producto.tallaid`). Es el gemelo de Color sin la
 * columna muerta.
 *
 * ⚠ ESTA PANTALLA NO TENÍA OPCIÓN DE MENÚ EN EL LEGACY. `Talla.php` existe y declara
 * `$segProcesoMenu="CAT-TALLA"`, pero no hay fila en `basic.menuweb` con ese proceso. La fila
 * la crea Phoenix, con el proceso que el `.php` ya declaraba.
 *
 * El listado devuelve el catálogo ENTERO, sin `meta`, y este recurso ni siquiera tiene un
 * `patalla_count`. La pantalla filtra por estado y pagina en cliente.
 *
 * ⚠ Detalle del legacy que no se copia: `Talla.php:35` pinta una cabecera de columna que dice
 * «COLOR», copiada de `Color.php`, y `talla.js` la rellena con una celda vacía.
 *
 * La fuente de verdad es `phoenix-api/api/openapi.yaml`.
 */

/** Fila del listado (`GET /tallas`). Nunca hay nulls: el legacy usa cadena vacía. */
export interface Talla {
  tallaid: number;
  nombre: string;
  /** Etiqueta corta. Puede venir vacía. */
  abreviatura: string;
  /** Posición en la lista. Se cambia con `PATCH /tallas/orden`, nunca con el `PUT`. */
  orden: number;
  /**
   * Se cambia con `POST /tallas/{id}/estado/alternar`, nunca con el `PUT`.
   *
   * ⚠ El listado NO oculta las inactivas: ese filtro lo pone el cliente.
   */
  estado: boolean;
  /**
   * DERIVADO y de SOLO LECTURA: no existe como columna. Lo calcula la base contando
   * `catalogo.producto` por talla.
   */
  cantidad_productos: number;
}

/**
 * Cuerpo del alta y de la edición.
 *
 * Sin `cantidad_productos` (derivado) y sin `estado` ni `orden`: cada uno tiene su propia ruta.
 */
export interface TallaInput {
  nombre: string;
  abreviatura: string;
}

/**
 * Filtros de `GET /tallas`. Solo el nombre. NO hay paginación: el endpoint devuelve el catálogo
 * entero.
 */
export interface TallaFiltros {
  /** Búsqueda parcial por nombre, insensible a mayúsculas y a acentos. */
  q?: string;
}

/** Respuesta de `POST /tallas/{id}/estado/alternar`: el estado RESULTANTE del toggle. */
export interface TallaEstado {
  tallaid: number;
  estado: boolean;
}

/**
 * Resultado por id de `POST /tallas/lote/eliminar`. Una talla puede fallar (tiene productos)
 * mientras el resto sí se elimina.
 */
export interface ResultadoLoteTalla {
  tallaid: number;
  ok: boolean;
  /** Solo cuando `ok` es `false`: mensaje listo para mostrar. */
  mensaje?: string;
  /** Solo cuando `ok` es `false`: código estable del error. */
  codigo?: string;
}

/**
 * Límites de las columnas de texto, que el backend también valida.
 *
 * ⚠ Salen de la COLUMNA: `TallaEdit.php` declara `maxlength=20` para la abreviatura sobre un
 * `varchar(10)`.
 */
/** Límite de `nombre` (`varchar(50)`). */
export const TALLA_MAX_NOMBRE = 50;
/** Límite de `abreviatura` (`varchar(10)`), no los 20 que promete el formulario del legacy. */
export const TALLA_MAX_ABREVIATURA = 10;
