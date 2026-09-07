/**
 * Modelos del dominio Tipo de Dirección (`basic.tipodireccion`, bloque Tablas Básicas).
 *
 * La fuente de verdad es `phoenix-api/api/openapi.yaml`, cuyo cliente generado vive en
 * `@phoenix/shared/api-client`. Estos tipos son la vista de dominio de ese contrato; si el
 * spec cambia, hay que regenerar el cliente (`npm run api:client`) y ajustar esto.
 */

/**
 * Fila del catálogo (`GET /tipos-direccion`). Ningún campo es opcional: todas las columnas
 * son NOT NULL en la base.
 *
 * Ojo con la clave: se llama `tipoid`, no `tipodireccionid`. Es el nombre real de la
 * columna del legacy y el que devuelve el backend.
 */
export interface TipoDireccion {
  tipoid: number;
  nombre: string;
  /** Marca los tipos que la ficha de persona exige rellenar. */
  requerido: boolean;
  /**
   * Es EXCLUSIVO en toda la tabla: al guardar uno con `pordefecto`, el backend apaga el de
   * TODOS los demás. Por eso el listado se recarga tras guardar en vez de parchear la fila.
   */
  pordefecto: boolean;
  /** Posición en la lista. Se cambia con `PATCH /tipos-direccion/orden`, no editando. */
  orden: number;
  /** Se cambia con `POST /tipos-direccion/{id}/estado/alternar`, no editando. */
  estado: boolean;
}

/**
 * Cuerpo del alta y de la edición.
 *
 * NO lleva `orden` ni `estado` a propósito. El alta los fija sola (orden al final, estado
 * activo) y la edición conserva el estado que tenga la fila: el backend se lo devuelve al
 * stored procedure tal cual para que guardar el formulario no deshaga lo que hizo el toggle.
 *
 * `requerido` y `pordefecto` son obligatorios, no opcionales: el backend escribe las dos
 * columnas siempre, así que omitirlas las apagaría sin querer.
 */
export interface TipoDireccionInput {
  nombre: string;
  requerido: boolean;
  pordefecto: boolean;
}

/**
 * Respuesta de `POST /tipos-direccion/{id}/estado/alternar`. Devuelve el estado RESULTANTE
 * porque es un toggle: al endpoint no se le manda el valor deseado.
 */
export interface TipoDireccionEstado {
  tipoid: number;
  estado: boolean;
}

/**
 * Resultado por id de `POST /tipos-direccion/lote/eliminar`. Un tipo de dirección puede
 * fallar (lo usa la dirección de alguna persona) mientras el resto del lote sí se elimina,
 * así que el saldo se lee fila a fila y no del código HTTP.
 */
export interface ResultadoLoteTipoDireccion {
  tipoid: number;
  ok: boolean;
  /** Solo cuando `ok` es `false`: mensaje listo para mostrar. */
  mensaje?: string;
  /** Solo cuando `ok` es `false`: código estable del error. */
  codigo?: string;
}

/** Límite de `nombre` (`varchar(50)`), que el backend también valida. */
export const TIPO_DIRECCION_MAX_TEXTO = 50;
