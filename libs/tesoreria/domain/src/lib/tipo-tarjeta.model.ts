/**
 * Modelos del dominio Tipo de Tarjeta (`tesoreria.tipo_tarjeta`, bloque Tablas Básicas del legacy, grupo
 * Tesorería).
 *
 * Dice con qué tarjeta se cobró —Visa, Mastercard, American Express— y lo apunta
 * `inventarios.venta_forma_pago.tipotarjetaid`. Se llena cuando la forma de pago es
 * tarjeta.
 *
 * La fuente de verdad es `phoenix-api/api/openapi.yaml`; estos tipos son la vista de dominio
 * de ese contrato.
 */

/**
 * Fila del catálogo (`GET /tipos-tarjeta`). Ningún campo es opcional: todas las columnas son
 * NOT NULL en la base y el legacy nunca guarda NULL, guarda cadena vacía.
 */
export interface TipoTarjeta {
  tipotarjetaid: number;
  nombre: string;
  /** Etiqueta corta. */
  abreviatura: string;
  /** Posición en la lista. Se cambia con `PATCH /tipos-tarjeta/orden`, no editando. */
  orden: number;
  estado: boolean;
}

/**
 * Cuerpo del alta y de la edición.
 *
 * NO lleva `orden` ni `estado` a propósito. El alta fija el orden al final y la edición ni lo
 * mira. El stored procedure SÍ recibe el estado y lo escribe, pero el backend le devuelve el valor que la fila ya tenía. El estado se cambia por su propia ruta, y tenerlo también aquí daría
 * dos fuentes de verdad sobre el mismo campo.
 *
 * Solo `nombre` es obligatorio.
 */
export interface TipoTarjetaInput {
  nombre: string;
  abreviatura: string;
}

/**
 * Respuesta de `POST /tipos-tarjeta/{id}/estado/alternar`. Devuelve el estado RESULTANTE porque es
 * un toggle: al endpoint no se le manda el valor deseado.
 */
export interface TipoTarjetaEstado {
  tipotarjetaid: number;
  estado: boolean;
}

/**
 * Resultado por id de `POST /tipos-tarjeta/lote/eliminar`. Uno puede fallar (alguna forma de pago de una venta lo referencia) mientras el
 * resto del lote sí se elimina, así que el saldo se lee fila a fila y no del código HTTP.
 */
export interface ResultadoLoteTipoTarjeta {
  tipotarjetaid: number;
  ok: boolean;
  /** Solo cuando `ok` es `false`: mensaje listo para mostrar. */
  mensaje?: string;
  /** Solo cuando `ok` es `false`: código estable del error. */
  codigo?: string;
}

/**
 * Límites de las columnas de texto, que el backend también valida.
 *
 * ⚠ Salen de la COLUMNA, no del formulario del legacy: sus `getFormGroupText` declaran
 * `maxlength=100` para el nombre sobre un `varchar(50)`.
 */
/** Límite de `nombre` (`varchar(50)`). */
export const TIPO_TARJETA_MAX_NOMBRE = 50;
/** Límite de `abreviatura` (`varchar(20)`). */
export const TIPO_TARJETA_MAX_ABREVIATURA = 20;
