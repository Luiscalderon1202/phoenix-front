/**
 * Modelos del dominio Motivo de Anulación (`inventarios.motivo_anulacion`, bloque Tablas Básicas del legacy, grupo
 * Ventas).
 *
 * Guarda por qué se anula un comprobante, y lo referencian `inventarios.venta_anulacion` y
 * `venta_anulacion_detalle`.
 *
 * La fuente de verdad es `phoenix-api/api/openapi.yaml`; estos tipos son la vista de dominio
 * de ese contrato.
 */

/**
 * Fila del catálogo (`GET /motivos-anulacion`). Ningún campo es opcional: todas las columnas son
 * NOT NULL en la base y el legacy nunca guarda NULL, guarda cadena vacía.
 */
export interface MotivoAnulacion {
  motivoid: number;
  nombre: string;
  /** Etiqueta corta. */
  abreviatura: string;
  /** Código con el que se asienta. **Único**: el backend rechaza repetidos, salvo que vaya vacío. */
  codigo_contable: string;
  /** Posición en la lista. Se cambia con `PATCH /motivos-anulacion/orden`, no editando. */
  orden: number;
  estado: boolean;
}

/**
 * Cuerpo del alta y de la edición.
 *
 * NO lleva `orden` ni `estado` a propósito. El alta fija el orden al final y la edición ni lo
 * mira. El stored procedure SÍ recibe el estado y lo escribe, pero el backend le devuelve el valor que la fila ya tenía. El estado se cambia por su propia ruta, y tenerlo también aquí daría dos
 * fuentes de verdad sobre el mismo campo.
 *
 * Solo `nombre` es obligatorio.
 */
export interface MotivoAnulacionInput {
  nombre: string;
  abreviatura: string;
  codigo_contable: string;
}

/**
 * Respuesta de `POST /motivos-anulacion/{id}/estado/alternar`. Devuelve el estado RESULTANTE porque es
 * un toggle: al endpoint no se le manda el valor deseado.
 */
export interface MotivoAnulacionEstado {
  motivoid: number;
  estado: boolean;
}

/**
 * Resultado por id de `POST /motivos-anulacion/lote/eliminar`. Uno puede fallar (hay ventas anuladas con ese motivo)
 * mientras el resto del lote sí se elimina, así que el saldo se lee fila a fila y no del
 * código HTTP.
 */
export interface ResultadoLoteMotivoAnulacion {
  motivoid: number;
  ok: boolean;
  /** Solo cuando `ok` es `false`: mensaje listo para mostrar. */
  mensaje?: string;
  /** Solo cuando `ok` es `false`: código estable del error. */
  codigo?: string;
}

/** Límites de las columnas de texto, que el backend también valida. */
/** Límite de `nombre` (`varchar(50)`). */
export const MOTIVO_ANULACION_MAX_NOMBRE = 50;
/** Límite de `abreviatura` (`varchar(20)`). */
export const MOTIVO_ANULACION_MAX_ABREVIATURA = 20;
/** Límite de `codigo_contable` (`varchar(10)`). */
export const MOTIVO_ANULACION_MAX_CODIGO_CONTABLE = 10;
