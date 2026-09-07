/**
 * Modelos del dominio Condición de Pago (`tesoreria.condicionpago`, bloque Tablas Básicas del legacy, grupo
 * Tesorería).
 *
 * Dice a cuántos días vence un comprobante —contado, 15 días, 30 días— y lo apuntan
 * `inventarios.venta.condicionpagoid` e `inventarios.ordencompra`. El pedido guarda su
 * `condicion` y sus `diasplazo`, así que está en el camino directo a pedidos.
 *
 * La fuente de verdad es `phoenix-api/api/openapi.yaml`; estos tipos son la vista de dominio
 * de ese contrato.
 */

/**
 * Fila del catálogo (`GET /condiciones-pago`). Ningún campo es opcional: todas las columnas son
 * NOT NULL en la base y el legacy nunca guarda NULL, guarda cadena vacía.
 */
export interface CondicionPago {
  condicionpagoid: number;
  nombre: string;
  /** Etiqueta corta. **Única**: el backend rechaza repetidas, salvo que vaya vacía. */
  abreviatura: string;
  /** Días de plazo. Así lo etiqueta el formulario del legacy. No puede ser negativo. */
  cantidad: number;
  /** Posición en la lista. Se cambia con `PATCH /condiciones-pago/orden`, no editando. */
  orden: number;
  estado: boolean;
}

/**
 * Cuerpo del alta y de la edición.
 *
 * NO lleva `orden` ni `estado` a propósito. El alta fija el orden al final y la edición ni lo
 * mira. El backend ni siquiera le pasa el estado al stored procedure, así que editar no puede alterarlo. El estado se cambia por su propia ruta, y tenerlo también aquí daría
 * dos fuentes de verdad sobre el mismo campo.
 *
 * Solo `nombre` es obligatorio.
 */
export interface CondicionPagoInput {
  nombre: string;
  abreviatura: string;
  cantidad: number;
}

/**
 * Respuesta de `POST /condiciones-pago/{id}/estado/alternar`. Devuelve el estado RESULTANTE porque es
 * un toggle: al endpoint no se le manda el valor deseado.
 */
export interface CondicionPagoEstado {
  condicionpagoid: number;
  estado: boolean;
}

/**
 * Resultado por id de `POST /condiciones-pago/lote/eliminar`. Uno puede fallar (la usa alguna venta u orden de compra) mientras el
 * resto del lote sí se elimina, así que el saldo se lee fila a fila y no del código HTTP.
 */
export interface ResultadoLoteCondicionPago {
  condicionpagoid: number;
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
export const CONDICION_PAGO_MAX_NOMBRE = 50;
/** Límite de `abreviatura` (`varchar(20)`). */
export const CONDICION_PAGO_MAX_ABREVIATURA = 20;
