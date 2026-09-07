/**
 * Modelos del dominio Tipo de Operación (`basic.tipooperacion`, bloque Tablas Básicas del legacy, grupo
 * Ventas).
 *
 * Clasifica la operación de un comprobante —venta interna, exportación, gratuita— y es de lo
 * más referenciado del esquema: lo apuntan `inventarios.venta`, los formatos de impresión de
 * empresa y almacén, `basic.pais_tipooperacion` y `catalogo.producto_tipooperacion`.
 *
 * La fuente de verdad es `phoenix-api/api/openapi.yaml`; estos tipos son la vista de dominio
 * de ese contrato.
 */

/**
 * Fila del catálogo (`GET /tipos-operacion`). Ningún campo es opcional: todas las columnas son
 * NOT NULL en la base y el legacy nunca guarda NULL, guarda cadena vacía.
 */
export interface TipoOperacion {
  tipooperacionid: number;
  nombre: string;
  /** Etiqueta corta. */
  abreviatura: string;
  /** Cuenta con la que se asienta. **Única**: el backend rechaza repetidos, salvo que vaya vacía. */
  codigo_contable: string;
  /** Posición en la lista. Se cambia con `PATCH /tipos-operacion/orden`, no editando. */
  orden: number;
  estado: boolean;
}

/**
 * Cuerpo del alta y de la edición.
 *
 * NO lleva `orden` ni `estado` a propósito. El alta fija el orden al final y la edición ni lo
 * mira. El backend ni siquiera le pasa el estado al stored procedure, así que editar no puede alterarlo. El estado se cambia por su propia ruta, y tenerlo también aquí daría dos
 * fuentes de verdad sobre el mismo campo.
 *
 * Solo `nombre` es obligatorio.
 */
export interface TipoOperacionInput {
  nombre: string;
  abreviatura: string;
  codigo_contable: string;
}

/**
 * Respuesta de `POST /tipos-operacion/{id}/estado/alternar`. Devuelve el estado RESULTANTE porque es
 * un toggle: al endpoint no se le manda el valor deseado.
 */
export interface TipoOperacionEstado {
  tipooperacionid: number;
  estado: boolean;
}

/**
 * Resultado por id de `POST /tipos-operacion/lote/eliminar`. Uno puede fallar (lo usa alguna venta)
 * mientras el resto del lote sí se elimina, así que el saldo se lee fila a fila y no del
 * código HTTP.
 */
export interface ResultadoLoteTipoOperacion {
  tipooperacionid: number;
  ok: boolean;
  /** Solo cuando `ok` es `false`: mensaje listo para mostrar. */
  mensaje?: string;
  /** Solo cuando `ok` es `false`: código estable del error. */
  codigo?: string;
}

/** Límites de las columnas de texto, que el backend también valida. */
/** Límite de `nombre` (`varchar(50)`). */
export const TIPO_OPERACION_MAX_NOMBRE = 50;
/** Límite de `abreviatura` (`varchar(20)`). */
export const TIPO_OPERACION_MAX_ABREVIATURA = 20;
/** Límite de `codigo_contable` (`varchar(20)`). */
export const TIPO_OPERACION_MAX_CODIGO_CONTABLE = 20;
