/**
 * Modelos del dominio Tipo de Consumo (`inventarios.tipoconsumo`, bloque Tablas Básicas del legacy).
 *
 * Dice cómo se consume una venta —en el local, para llevar, delivery— y lo referencian
 * `inventarios.venta.tipoconsumoid` y `inventarios.pedido.tipoconsumoid`. La pantalla de
 * Pedido/Cotización lo lee para poblar su desplegable.
 *
 * La fuente de verdad es `phoenix-api/api/openapi.yaml`; estos tipos son la vista de dominio
 * de ese contrato.
 */

/**
 * Fila del catálogo (`GET /tipos-consumo`). Ningún campo es opcional: todas las columnas son
 * NOT NULL en la base y el legacy nunca guarda NULL, guarda cadena vacía.
 */
export interface TipoConsumo {
  tipoid: number;
  nombre: string;
  /** Etiqueta corta, para donde no cabe el nombre. */
  abreviatura: string;
  /** Posición en la lista. Se cambia con `PATCH /tipos-consumo/orden`, no editando. */
  orden: number;
  estado: boolean;
}

/**
 * Cuerpo del alta y de la edición.
 *
 * NO lleva `orden` ni `estado` a propósito. El alta fija el orden al final y la edición ni lo
 * mira. Con `estado` hay un matiz: el stored procedure del legacy SÍ lo recibe y lo escribe,
 * pero el backend le devuelve el valor que la fila ya tenía — el estado se cambia por su
 * propia ruta, y tenerlo también aquí daría dos fuentes de verdad sobre el mismo campo.
 *
 * `abreviatura` puede ir vacía: ni el backend ni el legacy la exigen.
 */
export interface TipoConsumoInput {
  nombre: string;
  abreviatura: string;
}

/**
 * Respuesta de `POST /tipos-consumo/{id}/estado/alternar`. Devuelve el estado RESULTANTE porque es
 * un toggle: al endpoint no se le manda el valor deseado.
 */
export interface TipoConsumoEstado {
  tipoid: number;
  estado: boolean;
}

/**
 * Resultado por id de `POST /tipos-consumo/lote/eliminar`. Uno puede fallar (lo usa alguna venta o algún pedido)
 * mientras el resto del lote sí se elimina, así que el saldo se lee fila a fila y no del
 * código HTTP.
 */
export interface ResultadoLoteTipoConsumo {
  tipoid: number;
  ok: boolean;
  /** Solo cuando `ok` es `false`: mensaje listo para mostrar. */
  mensaje?: string;
  /** Solo cuando `ok` es `false`: código estable del error. */
  codigo?: string;
}

/** Límites de las columnas de texto, que el backend también valida. */
export const TIPO_CONSUMO_MAX_NOMBRE = 50;
export const TIPO_CONSUMO_MAX_ABREVIATURA = 20;
