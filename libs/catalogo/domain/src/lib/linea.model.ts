/**
 * Modelos del dominio Línea (`catalogo.linea`, opción de menú propia bajo el grupo «Catálogo»
 * — menuweb 71, proceso `CAT-LINEA`).
 *
 * La línea la lleva el master (`catalogo.master.lineaid`), no el producto, igual que la marca.
 *
 * ⚠ PAGINA y FILTRA EN SERVIDOR, como marcas y laboratorios: la respuesta trae `meta`. Los
 * otros catálogos de este tramo —grupos, colores y tallas— devuelven el catálogo entero.
 *
 * ⚠ El `orden` de esta pantalla lo hace posible la **migración 0009 de Phoenix**. La columna
 * existía y no servía para nada: no hay `palinea_cambiar_orden`, `palinea_leer` ordena por
 * nombre a fuego, y `palinea_actualizar` inserta `palinea_lastorder()` sin el `+1` que ponen
 * sus hermanas, así que toda alta nacía empatada con la última.
 *
 * La fuente de verdad es `phoenix-api/api/openapi.yaml`; estos tipos son la vista de dominio
 * de ese contrato.
 */

/**
 * Fila del listado paginado (`GET /lineas`). Ningún campo es opcional: las columnas son
 * NOT NULL en la base y el legacy nunca guarda NULL, guarda cadena vacía.
 *
 * Sin contador de productos: al revés que grupos, colores y tallas, el tipo compuesto de este
 * recurso no trae ninguno y el listado del legacy tampoco pinta esa columna.
 */
export interface Linea {
  lineaid: number;
  nombre: string;
  /** Etiqueta corta. La base la deja vacía: es `not null` pero sin default ni check. */
  abreviatura: string;
  /** Código del plan contable. En producción dos de las tres filas lo tienen vacío. */
  codigo_contable: string;
  /** Posición en la lista. Se cambia con `PATCH /lineas/orden`, nunca con el `PUT`. */
  orden: number;
  /**
   * Se cambia con `POST /lineas/{id}/estado/alternar`, nunca con el `PUT`.
   *
   * ⚠ El listado NO oculta las inactivas: el stored procedure no filtra por estado, así que
   * ese filtro lo pone el cliente.
   */
  estado: boolean;
}

/**
 * Cuerpo del alta y de la edición.
 *
 * Sin `estado` ni `orden`: cada uno tiene su propia ruta y ésa es su única fuente de verdad.
 * El stored procedure SÍ recibe el estado, y el backend le devuelve el que la fila ya tenía.
 */
export interface LineaInput {
  nombre: string;
  abreviatura: string;
  codigo_contable: string;
}

/**
 * Filtros + paginación de `GET /lineas`.
 *
 * ⚠ El parámetro del tamaño de página se llama `page_size`, en snake_case: es el nombre que
 * viaja en la URL. No se renombra a `pageSize` para que el mapeo sea rastreable.
 */
export interface LineaListQuery {
  /** Empieza en 1. */
  page: number;
  /** El backend lo acota para que nadie pida la tabla entera. */
  page_size: number;
  /**
   * Búsqueda parcial por nombre, insensible a mayúsculas y a acentos.
   *
   * ⚠ `public.buscar()` tiene dos erratas conocidas que el backend NO corrige —no normaliza la
   * ñ y su bloque de mayúsculas dice `AEOIU` en vez de `AEIOU`—.
   */
  q?: string;
}

/** Respuesta de `POST /lineas/{id}/estado/alternar`: el estado RESULTANTE del toggle. */
export interface LineaEstado {
  lineaid: number;
  estado: boolean;
}

/**
 * Resultado por id de `POST /lineas/lote/eliminar`. Una línea puede fallar (tiene masters
 * colgando) mientras el resto sí se elimina, así que el saldo se lee fila a fila y no del
 * código HTTP.
 */
export interface ResultadoLoteLinea {
  lineaid: number;
  ok: boolean;
  /** Solo cuando `ok` es `false`: mensaje listo para mostrar. */
  mensaje?: string;
  /** Solo cuando `ok` es `false`: código estable del error. */
  codigo?: string;
}

/**
 * Límites de las columnas de texto, que el backend también valida.
 *
 * ⚠ Salen de la COLUMNA, no del formulario del legacy. Aquí `LineaEdit.php` miente en la
 * dirección contraria a la habitual: declara `maxlength=5` para el código contable sobre un
 * `varchar(20)`, o sea que deja escribir la cuarta parte de lo que cabe.
 */
/** Límite de `nombre` (`varchar(50)`). */
export const LINEA_MAX_NOMBRE = 50;
/** Límite de `abreviatura` (`varchar(20)`). Aquí el formulario del legacy sí acierta. */
export const LINEA_MAX_ABREVIATURA = 20;
/** Límite de `codigo_contable` (`varchar(20)`), no los 5 que deja escribir el formulario. */
export const LINEA_MAX_CODIGO_CONTABLE = 20;
