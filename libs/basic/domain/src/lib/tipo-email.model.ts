/**
 * Modelos del dominio Tipo de Email (`basic.tipoemail`, bloque Tablas Básicas).
 *
 * Clasifica los correos de una persona (personal, laboral, facturación…) y lo referencia
 * `basic.persona_email`. La fuente de verdad es `phoenix-api/api/openapi.yaml`; estos tipos
 * son la vista de dominio de ese contrato, así que si el spec cambia hay que regenerar el
 * cliente (`npm run api:client`) y ajustar esto.
 */

/**
 * Fila del catálogo (`GET /tipos-email`). Ningún campo es opcional: todas las columnas son
 * NOT NULL en la base y el legacy nunca guarda NULL.
 */
export interface TipoEmail {
  tipoid: number;
  nombre: string;
  /** Si el email de este tipo es obligatorio al registrar una persona. */
  requerido: boolean;
  /**
   * Tipo propuesto por defecto. Es EXCLUYENTE: el backend desmarca al anterior cuando se
   * marca otro, así que la lista nunca tiene dos.
   */
  pordefecto: boolean;
  /** Posición en la lista. Se cambia con `PATCH /tipos-email/orden`, no editando. */
  orden: number;
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
export interface TipoEmailInput {
  nombre: string;
  requerido: boolean;
  pordefecto: boolean;
}

/**
 * Respuesta de `POST /tipos-email/{id}/estado/alternar`. Devuelve el estado RESULTANTE
 * porque es un toggle: al endpoint no se le manda el valor deseado.
 */
export interface TipoEmailEstado {
  tipoid: number;
  estado: boolean;
}

/**
 * Resultado por id de `POST /tipos-email/lote/eliminar`. Un tipo de email puede fallar
 * (lo usa el correo de alguna persona) mientras el resto del lote sí se elimina, así que el
 * saldo se lee fila a fila y no del código HTTP.
 */
export interface ResultadoLoteTipoEmail {
  tipoid: number;
  ok: boolean;
  /** Solo cuando `ok` es `false`: mensaje listo para mostrar. */
  mensaje?: string;
  /** Solo cuando `ok` es `false`: código estable del error. */
  codigo?: string;
}

/** Límite de `nombre` (`varchar(50)`), que el backend también valida. */
export const TIPO_EMAIL_MAX_NOMBRE = 50;
