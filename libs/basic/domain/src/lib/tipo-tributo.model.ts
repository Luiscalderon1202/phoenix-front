/**
 * Modelos del dominio Tipo de Tributo (`basic.tipotributo`, bloque Tablas Básicas, grupo
 * Ventas).
 *
 * Guarda los tributos que se aplican a un comprobante —IGV, ICBPER, exonerado— junto con
 * sus códigos de SUNAT. Lo referencian `inventarios.venta.tributo1/2/3_tipoid` y
 * `basic.pais_tipotributo`, y la pantalla de Pedido/Cotización lo lee para calcular el IGV
 * y el tributo de la bolsa. La fuente de verdad es `phoenix-api/api/openapi.yaml`.
 */

/**
 * Fila del catálogo (`GET /tipos-tributo`). Ningún campo es opcional: todas las columnas son
 * NOT NULL en la base y el legacy nunca guarda NULL, guarda cadena vacía.
 */
export interface TipoTributo {
  tipoid: number;
  nombre: string;
  /** Etiqueta corta; es la que se imprime en el comprobante. */
  abreviatura: string;
  /** Id del tributo en el catálogo 05 de SUNAT. Único: el backend rechaza repetidos. */
  codigo_tipo: string;
  /**
   * Categoría en el catálogo 07 de SUNAT. **NO es única**: varios tributos la comparten y
   * el backend no comprueba duplicados aquí, al contrario que con los otros dos códigos.
   */
  codigo_categoria: string;
  /** Cuenta con la que se asienta. Única, como `codigo_tipo`. */
  codigo_contable: string;
  /** Posición en la lista. Se cambia con `PATCH /tipos-tributo/orden`, no editando. */
  orden: number;
  estado: boolean;
}

/**
 * Cuerpo del alta y de la edición.
 *
 * NO lleva `orden` ni `estado`. Con `orden` es como en el resto de los catálogos: el alta lo
 * fija al final y la edición ni lo mira. Con `estado` hay menos que explicar que en sus
 * hermanos: el stored procedure de este recurso ni siquiera lo recibe, así que editar no
 * puede alterarlo.
 *
 * Solo `nombre` es obligatorio; los tres códigos pueden ir vacíos y el legacy tiene filas así.
 */
export interface TipoTributoInput {
  nombre: string;
  abreviatura: string;
  codigo_tipo: string;
  codigo_categoria: string;
  codigo_contable: string;
}

/**
 * Respuesta de `POST /tipos-tributo/{id}/estado/alternar`. Devuelve el estado RESULTANTE
 * porque es un toggle: al endpoint no se le manda el valor deseado.
 */
export interface TipoTributoEstado {
  tipoid: number;
  estado: boolean;
}

/**
 * Resultado por id de `POST /tipos-tributo/lote/eliminar`. Un tributo puede fallar (lo usa
 * alguna venta) mientras el resto del lote sí se elimina, así que el saldo se lee fila a
 * fila y no del código HTTP.
 */
export interface ResultadoLoteTipoTributo {
  tipoid: number;
  ok: boolean;
  /** Solo cuando `ok` es `false`: mensaje listo para mostrar. */
  mensaje?: string;
  /** Solo cuando `ok` es `false`: código estable del error. */
  codigo?: string;
}

/** Límites de las columnas de texto, que el backend también valida. */
export const TIPO_TRIBUTO_MAX_NOMBRE = 50;
export const TIPO_TRIBUTO_MAX_ABREVIATURA = 20;
/** `codigo_tipo`, `codigo_categoria` y `codigo_contable` son `varchar(5)`. */
export const TIPO_TRIBUTO_MAX_CODIGO = 5;
