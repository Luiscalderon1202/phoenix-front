/**
 * Modelos del dominio Tipo de Red Social (`basic.tiposocialmedia`, bloque Tablas Básicas).
 *
 * Catálogo de las redes sociales que una persona puede declarar; lo referencia
 * `basic.persona_socialmedia`. La fuente de verdad es `phoenix-api/api/openapi.yaml`; si el
 * spec cambia hay que regenerar el cliente (`npm run api:client`) y ajustar esto.
 */

/**
 * Fila del catálogo (`GET /tipos-social-media`). Ningún campo es opcional: las tres columnas
 * de texto son NOT NULL en la base y el legacy guarda cadena vacía en vez de NULL, así que
 * `url` e `icono` llegan en blanco a menudo pero siempre llegan.
 */
export interface TipoSocialMedia {
  tipoid: number;
  nombre: string;
  /** URL base del perfil (p. ej. `https://facebook.com/`). `varchar(250)`. */
  url: string;
  /** Clase o nombre del icono con que se pinta la red. `varchar(250)`. */
  icono: string;
  /** Posición en la lista. Se cambia con `PATCH /tipos-social-media/orden`, no editando. */
  orden: number;
  estado: boolean;
}

/**
 * Cuerpo del alta y de la edición.
 *
 * NO lleva `estado` ni `orden`, aunque el stored procedure del legacy acepte el primero
 * como parámetro y su formulario (`TipoSocialMediaEdit.php`) tenga el checkbox "ACTIVO".
 * Cada uno tiene su propia acción —`POST .../estado/alternar` y `PATCH .../orden`— y ésa es
 * su única fuente de verdad: ofrecerlos también en el PUT daría dos caminos para lo mismo.
 *
 * El alta deja el registro activo; la edición conserva el estado que ya tenía la fila.
 */
export interface TipoSocialMediaInput {
  nombre: string;
  url: string;
  icono: string;
}

/**
 * Respuesta de `POST /tipos-social-media/{id}/estado/alternar`. Devuelve el estado
 * RESULTANTE porque es un toggle: al endpoint no se le manda el valor deseado.
 */
export interface TipoSocialMediaEstado {
  tipoid: number;
  estado: boolean;
}

/**
 * Resultado por id de `POST /tipos-social-media/lote/eliminar`. Un tipo puede fallar (alguna
 * persona lo tiene declarado) mientras el resto del lote sí se elimina, así que el saldo se
 * lee fila a fila y no del código HTTP.
 */
export interface ResultadoLoteTipoSocialMedia {
  tipoid: number;
  ok: boolean;
  /** Solo cuando `ok` es `false`: mensaje listo para mostrar. */
  mensaje?: string;
  /** Solo cuando `ok` es `false`: código estable del error. */
  codigo?: string;
}

/**
 * Límites de las columnas de texto, que el backend también valida. No son los mismos para
 * los tres campos: `nombre` es `varchar(50)`, `url` e `icono` son `varchar(250)`.
 * (El formulario del legacy recorta el icono a 50 en el HTML; manda el catálogo.)
 */
export const TIPO_SOCIAL_MEDIA_MAX_NOMBRE = 50;
export const TIPO_SOCIAL_MEDIA_MAX_URL = 250;
export const TIPO_SOCIAL_MEDIA_MAX_ICONO = 250;
