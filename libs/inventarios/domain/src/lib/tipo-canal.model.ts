/**
 * Modelos del dominio Canal de Atención (`inventarios.tipocanal`, bloque Tablas Básicas del legacy).
 *
 * Dice por qué vía llegó la venta —mostrador, teléfono, web— y lo referencia
 * `inventarios.venta.tipocanalid`. La pantalla de Pedido/Cotización lo lee para poblar su
 * desplegable. En el hub de Tablas Básicas del legacy la opción se llama "Canales de
 * atención", aunque la tabla se llame `tipocanal`.
 *
 * La fuente de verdad es `phoenix-api/api/openapi.yaml`; estos tipos son la vista de dominio
 * de ese contrato.
 */

/**
 * Fila del catálogo (`GET /canales-atencion`). Ningún campo es opcional: todas las columnas son
 * NOT NULL en la base y el legacy nunca guarda NULL, guarda cadena vacía.
 */
export interface TipoCanal {
  tipoid: number;
  nombre: string;
  /** Etiqueta corta, para donde no cabe el nombre. */
  abreviatura: string;
  /** Posición en la lista. Se cambia con `PATCH /canales-atencion/orden`, no editando. */
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
export interface TipoCanalInput {
  nombre: string;
  abreviatura: string;
}

/**
 * Respuesta de `POST /canales-atencion/{id}/estado/alternar`. Devuelve el estado RESULTANTE porque es
 * un toggle: al endpoint no se le manda el valor deseado.
 */
export interface TipoCanalEstado {
  tipoid: number;
  estado: boolean;
}

/**
 * Resultado por id de `POST /canales-atencion/lote/eliminar`. Uno puede fallar (lo usa alguna venta)
 * mientras el resto del lote sí se elimina, así que el saldo se lee fila a fila y no del
 * código HTTP.
 */
export interface ResultadoLoteTipoCanal {
  tipoid: number;
  ok: boolean;
  /** Solo cuando `ok` es `false`: mensaje listo para mostrar. */
  mensaje?: string;
  /** Solo cuando `ok` es `false`: código estable del error. */
  codigo?: string;
}

/** Límites de las columnas de texto, que el backend también valida. */
export const TIPO_CANAL_MAX_NOMBRE = 50;
export const TIPO_CANAL_MAX_ABREVIATURA = 20;
