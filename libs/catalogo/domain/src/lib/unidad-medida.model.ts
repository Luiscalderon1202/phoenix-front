/**
 * Modelos del dominio Unidad de medida (`catalogo.unidadmedida`, opción de menú propia bajo el
 * padre «Catalogo», proceso `CAT-UNIDAD-MEDIDA`).
 *
 * Es la presentación en que se vende un producto —UNIDAD, CAJA, DOCENA, BALDE— y la apuntan
 * `catalogo.producto.unidadmedidaid` e `inventarios.pedido_detalle.unidadmedidaid`, así que
 * está en el camino directo a pedidos.
 *
 * ⚠ NO CONFUNDIR CON `catalogo.unidad` («Unidad Base»): son dos tablas y dos pantallas
 * distintas, con permisos distintos, y un producto necesita las dos a la vez.
 *
 * La fuente de verdad es `phoenix-api/api/openapi.yaml`; estos tipos son la vista de dominio de
 * ese contrato.
 */

/**
 * Fila del catálogo (`GET /unidades-medida`). Ningún campo es opcional: todas las columnas son
 * NOT NULL en la base y el legacy nunca guarda NULL, guarda cadena vacía.
 */
export interface UnidadMedida {
  unidadmedidaid: number;
  nombre: string;
  /** Etiqueta corta (UND, CJA, DOC…). */
  abreviatura: string;
  /**
   * Código del plan contable. ⚠ Solo DOS caracteres, y guarda el cero a la izquierda
   * ('01'…'15', '99'). No es único: DOCENA, CIENTO y CAJAS comparten el '12'.
   */
  codigo_contable: string;
  /** Código de la tabla 6 de SUNAT (NIU, ZZ, BX…). */
  codigo_internacional: string;
  /**
   * ⚠ Columna que existía en la tabla pero que NINGUNA función del legacy sabía escribir ni
   * leer. La desentierra la migración 0008. Se cambia con
   * `POST /unidades-medida/{id}/estado/alternar`, no editando.
   */
  estado: boolean;
  /**
   * Posición en la lista. Mismo caso que `estado`: la columna existía y nadie la tocaba. Se
   * cambia con `PATCH /unidades-medida/orden`, no editando.
   */
  orden: number;
}

/**
 * Cuerpo del alta y de la edición.
 *
 * NO lleva `estado` ni `orden` a propósito: el stored procedure ni siquiera los recibe —su
 * insert es posicional de cinco valores sobre una tabla de siete columnas— y cada uno tiene su
 * propia ruta, que es su única fuente de verdad.
 *
 * Solo `nombre` es obligatorio: las otras tres columnas son `not null` pero con default vacío, y
 * el legacy da de alta unidades con los códigos en blanco.
 */
export interface UnidadMedidaInput {
  nombre: string;
  abreviatura: string;
  codigo_contable: string;
  codigo_internacional: string;
}

/**
 * Filtros del listado. Los resuelve el SP (`phoenix.paunidadmedida_leer`), no el cliente: el
 * endpoint devuelve el catálogo ya filtrado.
 */
export interface UnidadMedidaFiltros {
  /**
   * Búsqueda parcial por nombre. La compara `public.buscar()`, que ignora mayúsculas y tildes
   * —con dos erratas conocidas: la `ñ` no se normaliza y su tabla de mayúsculas cruza `Ì` con
   * `Ò`—. Se hereda tal cual para que el filtro case con el resto del sistema.
   */
  q?: string;
  /**
   * `false` (el default del backend) devuelve solo las activas, que es lo que hacía el legacy.
   * ⚠ El backend NO sabe devolver «solo las inactivas»: para eso hay que pedir todas y filtrar
   * en cliente.
   */
  incluir_inactivas?: boolean;
}

/**
 * Respuesta de `POST /unidades-medida/{id}/estado/alternar`. Devuelve el estado RESULTANTE
 * porque es un toggle: al endpoint no se le manda el valor deseado.
 */
export interface UnidadMedidaEstado {
  unidadmedidaid: number;
  estado: boolean;
}

/**
 * Resultado por id de `POST /unidades-medida/lote/eliminar`. Uno puede fallar (lo usa algún
 * producto o alguna línea de pedido) mientras el resto del lote sí se elimina, así que el saldo
 * se lee fila a fila y no del código HTTP.
 */
export interface ResultadoLoteUnidadMedida {
  unidadmedidaid: number;
  ok: boolean;
  /** Solo cuando `ok` es `false`: mensaje listo para mostrar. */
  mensaje?: string;
  /** Solo cuando `ok` es `false`: código estable del error. */
  codigo?: string;
}

/**
 * Límites de las columnas de texto, que el backend también valida.
 *
 * ⚠ Salen de la COLUMNA, no del formulario del legacy, que MIENTE EN DOS: `UnidadMedidaEdit.php`
 * declara `maxlength=20` tanto para `txtAbreviatura` como para `txtCodigoContable`, sobre un
 * `varchar(10)` y un `varchar(2)`. Deja escribir hasta diez veces lo que cabe y la base responde
 * con un 22001.
 */
/** Límite de `nombre` (`varchar(50)`). */
export const UNIDAD_MEDIDA_MAX_NOMBRE = 50;
/** Límite de `abreviatura` (`varchar(10)`). */
export const UNIDAD_MEDIDA_MAX_ABREVIATURA = 10;
/** Límite de `codigo_contable` (`varchar(2)`). */
export const UNIDAD_MEDIDA_MAX_CODIGO_CONTABLE = 2;
/** Límite de `codigo_internacional` (`varchar(20)`). */
export const UNIDAD_MEDIDA_MAX_CODIGO_INTERNACIONAL = 20;
