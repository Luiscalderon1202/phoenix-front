/**
 * Modelos del dominio Tipo de Teléfono (`basic.tipotelefono`, bloque Tablas Básicas).
 *
 * La fuente de verdad es `phoenix-api/api/openapi.yaml`, cuyo cliente generado vive en
 * `@phoenix/shared/api-client`. Estos tipos son la vista de dominio de ese contrato; si el
 * spec cambia, hay que regenerar el cliente (`npm run api:client`) y ajustar esto.
 */

/**
 * Fila del catálogo (`GET /tipos-telefono`). Ningún campo es opcional: todas las columnas
 * son NOT NULL en la base.
 */
export interface TipoTelefono {
  tipoid: number;
  nombre: string;
  /** Si el teléfono de este tipo es obligatorio al registrar una persona. */
  requerido: boolean;
  /**
   * Tipo propuesto por omisión. Es EXCLUYENTE: el stored procedure apaga la marca en
   * todas las demás filas al encenderla en una, así que guardar una fila cambia otras.
   */
  pordefecto: boolean;
  /** Posición en la lista. Se cambia con `PATCH /tipos-telefono/orden`, no editando. */
  orden: number;
  /** Se cambia con `POST /tipos-telefono/{id}/estado/alternar`, no editando. */
  estado: boolean;
}

/**
 * Cuerpo del alta y de la edición.
 *
 * NO lleva `orden` ni `estado` a propósito. Con `orden` es lo mismo que en tipos de
 * empresa: el alta lo fija al final y la edición ni lo mira. Con `estado` hay un matiz —
 * el SP del legacy SÍ recibe el estado y lo escribe—, pero el backend le devuelve el valor
 * que la fila ya tenía: el estado se cambia por su propia ruta, y tenerlo también aquí
 * daría dos fuentes de verdad sobre el mismo campo.
 */
export interface TipoTelefonoInput {
  nombre: string;
  requerido: boolean;
  pordefecto: boolean;
}

/**
 * Respuesta de `POST /tipos-telefono/{id}/estado/alternar`. Devuelve el estado RESULTANTE
 * porque es un toggle: al endpoint no se le manda el valor deseado.
 */
export interface TipoTelefonoEstado {
  tipoid: number;
  estado: boolean;
}

/**
 * Resultado por id de `POST /tipos-telefono/lote/eliminar`. Un tipo de teléfono puede
 * fallar (lo usa un `basic.persona_telefono`) mientras el resto del lote sí se elimina, así
 * que el saldo se lee fila a fila y no del código HTTP.
 */
export interface ResultadoLoteTipoTelefono {
  tipoid: number;
  ok: boolean;
  /** Solo cuando `ok` es `false`: mensaje listo para mostrar. */
  mensaje?: string;
  /** Solo cuando `ok` es `false`: código estable del error. */
  codigo?: string;
}

/** Límite de la columna `nombre` (`varchar(50)`), que el backend también valida. */
export const TIPO_TELEFONO_MAX_NOMBRE = 50;
