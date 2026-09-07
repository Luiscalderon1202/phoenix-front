/**
 * Modelos del dominio Tipo de Forma de Pago (`tesoreria.tipo_forma_pago`, bloque Tablas Básicas del legacy, grupo
 * Tesorería).
 *
 * Dice con qué se paga —efectivo, tarjeta, cheque, depósito, anticipo— y lo apuntan
 * `inventarios.venta_forma_pago`, `basic.empresa_almacen_fp` y
 * `tesoreria.cajaplanilla_detalle`. El pedido guarda un `tipoformapagoid`, así que está en
 * el camino directo a pedidos.
 *
 * La fuente de verdad es `phoenix-api/api/openapi.yaml`; estos tipos son la vista de dominio
 * de ese contrato.
 */

/**
 * Fila del catálogo (`GET /tipos-forma-pago`). Ningún campo es opcional: todas las columnas son
 * NOT NULL en la base y el legacy nunca guarda NULL, guarda cadena vacía.
 */
export interface TipoFormaPago {
  tipoformapagoid: number;
  nombre: string;
  /** Etiqueta corta. */
  abreviatura: string;
  /** Código interno que agrupa la forma de pago. En producción toma EFE, TAR, CHE, BCO y ANT, pero es texto libre: no hay check en la base. */
  estructura: string;
  /** Texto libre. Vacío en todas las filas de producción; el formulario del legacy lo ofrece igualmente. */
  tipo: string;
  /** Cuenta del Plan Contable General. */
  pcgr_general: string;
  /** Cuenta del Plan Contable Empresarial. */
  pcgr_empresarial: string;
  /** Posición en la lista. Se cambia con `PATCH /tipos-forma-pago/orden`, no editando. */
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
export interface TipoFormaPagoInput {
  nombre: string;
  abreviatura: string;
  estructura: string;
  tipo: string;
  pcgr_general: string;
  pcgr_empresarial: string;
}

/**
 * Respuesta de `POST /tipos-forma-pago/{id}/estado/alternar`. Devuelve el estado RESULTANTE porque es
 * un toggle: al endpoint no se le manda el valor deseado.
 */
export interface TipoFormaPagoEstado {
  tipoformapagoid: number;
  estado: boolean;
}

/**
 * Resultado por id de `POST /tipos-forma-pago/lote/eliminar`. Uno puede fallar (lo usa una venta, un almacén o un detalle de caja) mientras el
 * resto del lote sí se elimina, así que el saldo se lee fila a fila y no del código HTTP.
 */
export interface ResultadoLoteTipoFormaPago {
  tipoformapagoid: number;
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
export const TIPO_FORMA_PAGO_MAX_NOMBRE = 50;
/** Límite de `abreviatura` (`varchar(20)`). */
export const TIPO_FORMA_PAGO_MAX_ABREVIATURA = 20;
/** Límite de `estructura` (`varchar(10)`). */
export const TIPO_FORMA_PAGO_MAX_ESTRUCTURA = 10;
/** Límite de `tipo` (`varchar(20)`). */
export const TIPO_FORMA_PAGO_MAX_TIPO = 20;
/** Límite de las dos cuentas contables (`varchar(50)`). */
export const TIPO_FORMA_PAGO_MAX_PCGR = 50;
