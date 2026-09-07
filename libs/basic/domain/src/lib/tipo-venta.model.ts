/**
 * Modelos del dominio Tipo de Venta (`basic.tipoventa`, bloque Tablas Básicas del legacy, grupo
 * Ventas).
 *
 * Dice de qué clase es la venta —contado, crédito, anticipo— y lo apuntan `inventarios.venta`,
 * los formatos de comprobante de empresa y almacén y `basic.pais_tipoventa`.
 *
 * La fuente de verdad es `phoenix-api/api/openapi.yaml`; estos tipos son la vista de dominio
 * de ese contrato.
 */

/**
 * Fila del catálogo (`GET /tipos-venta`). Ningún campo es opcional: todas las columnas son
 * NOT NULL en la base y el legacy nunca guarda NULL, guarda cadena vacía.
 */
export interface TipoVenta {
  tipoventaid: number;
  nombre: string;
  /** Etiqueta corta. */
  abreviatura: string;
  /** Cuenta con la que se asienta. **Única**: el backend rechaza repetidos, salvo que vaya vacía. */
  codigo_contable: string;
  /** Marca los tipos de venta que son un anticipo, para que la facturación los trate aparte. Es un campo del formulario como cualquier otro, no un interruptor con ruta propia. */
  anticipo: boolean;
  /** Posición en la lista. Se cambia con `PATCH /tipos-venta/orden`, no editando. */
  orden: number;
  estado: boolean;
}

/**
 * Cuerpo del alta y de la edición.
 *
 * NO lleva `orden` ni `estado` a propósito. El alta fija el orden al final y la edición ni lo
 * mira. La versión vigente del stored procedure —la de 8 argumentos— no recibe el estado. El estado se cambia por su propia ruta, y tenerlo también aquí daría dos
 * fuentes de verdad sobre el mismo campo.
 *
 * Solo `nombre` es obligatorio.
 */
export interface TipoVentaInput {
  nombre: string;
  abreviatura: string;
  codigo_contable: string;
  anticipo: boolean;
}

/**
 * Respuesta de `POST /tipos-venta/{id}/estado/alternar`. Devuelve el estado RESULTANTE porque es
 * un toggle: al endpoint no se le manda el valor deseado.
 */
export interface TipoVentaEstado {
  tipoventaid: number;
  estado: boolean;
}

/**
 * Resultado por id de `POST /tipos-venta/lote/eliminar`. Uno puede fallar (lo usa alguna venta)
 * mientras el resto del lote sí se elimina, así que el saldo se lee fila a fila y no del
 * código HTTP.
 */
export interface ResultadoLoteTipoVenta {
  tipoventaid: number;
  ok: boolean;
  /** Solo cuando `ok` es `false`: mensaje listo para mostrar. */
  mensaje?: string;
  /** Solo cuando `ok` es `false`: código estable del error. */
  codigo?: string;
}

/** Límites de las columnas de texto, que el backend también valida. */
/** Límite de `nombre` (`varchar(50)`). */
export const TIPO_VENTA_MAX_NOMBRE = 50;
/** Límite de `abreviatura` (`varchar(20)`). */
export const TIPO_VENTA_MAX_ABREVIATURA = 20;
/** Límite de `codigo_contable` (`varchar(20)`). */
export const TIPO_VENTA_MAX_CODIGO_CONTABLE = 20;
