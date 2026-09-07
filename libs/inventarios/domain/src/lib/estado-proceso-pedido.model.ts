/**
 * Modelos del dominio Estado de Proceso de Pedido (`inventarios.estado_proceso_pedido`, bloque Tablas Básicas del legacy).
 *
 * Marca en qué fase está un pedido —recibido, en producción, listo, entregado— y lo leen
 * `Pedido.php`, `PedidoAtencion.php` y `PedidoProduccion.php` del legacy para pintar sus
 * filtros y sus botones de avance. Es la pieza más directa del camino a pedidos.
 *
 * La fuente de verdad es `phoenix-api/api/openapi.yaml`; estos tipos son la vista de dominio
 * de ese contrato.
 */

/**
 * Fila del catálogo (`GET /estados-proceso-pedido`). Ningún campo es opcional: todas las columnas son
 * NOT NULL en la base y el legacy nunca guarda NULL, guarda cadena vacía.
 * ⚠ La clave es `procesoid`, no `tipoid` como en el resto de los catálogos de este dominio.
 */
export interface EstadoProcesoPedido {
  procesoid: number;
  nombre: string;
  /** Etiqueta corta, para donde no cabe el nombre. */
  abreviatura: string;
  /** Posición en la lista. Se cambia con `PATCH /estados-proceso-pedido/orden`, no editando. */
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
export interface EstadoProcesoPedidoInput {
  nombre: string;
  abreviatura: string;
}

/**
 * Respuesta de `POST /estados-proceso-pedido/{id}/estado/alternar`. Devuelve el estado RESULTANTE porque es
 * un toggle: al endpoint no se le manda el valor deseado.
 */
export interface EstadoProcesoPedidoEstado {
  procesoid: number;
  estado: boolean;
}

/**
 * Resultado por id de `POST /estados-proceso-pedido/lote/eliminar`. Uno puede fallar (hay algún pedido en ese estado)
 * mientras el resto del lote sí se elimina, así que el saldo se lee fila a fila y no del
 * código HTTP.
 */
export interface ResultadoLoteEstadoProcesoPedido {
  procesoid: number;
  ok: boolean;
  /** Solo cuando `ok` es `false`: mensaje listo para mostrar. */
  mensaje?: string;
  /** Solo cuando `ok` es `false`: código estable del error. */
  codigo?: string;
}

/** Límites de las columnas de texto, que el backend también valida. */
export const ESTADO_PROCESO_PEDIDO_MAX_NOMBRE = 50;
export const ESTADO_PROCESO_PEDIDO_MAX_ABREVIATURA = 20;
