/**
 * Modelos del dominio Persona (módulo `basic`, mantenimiento de tablas básicas).
 *
 * Espejan los DTO del backend: los campos viajan en snake_case porque así los serializa
 * la API, y no se renombran aquí para que el contrato sea rastreable de un vistazo.
 *
 * La fuente de verdad es `phoenix-api/api/openapi.yaml`, cuyo cliente generado vive en
 * `@phoenix/shared/api-client` (`PersonaListRow`, `Rol`, `ResultadoLote`). Estos tipos son
 * la vista de dominio de ese contrato: los campos que el spec deja opcionales aquí son
 * obligatorios porque el propio spec aclara que "nunca son null: el legacy usa cadena
 * vacía". Si el contrato cambia, hay que regenerar el cliente y ajustar esto.
 */

/**
 * Bandera booleana de los filtros. El legacy expresa los sí/no con `'Y'`/`'N'`, no con
 * `true`/`false`; en el listado sí llega un booleano real (`PersonaListRow.estado`).
 */
export type Flag = 'Y' | 'N';

/** Tipo de persona: natural o jurídica. */
export type TipoPersona = 'N' | 'J';

/** Orden que admite `GET /personas`. */
export type PersonaOrderBy = 'codigo' | 'nombre';

/**
 * Fila del listado paginado (`GET /personas`). Salida ya denormalizada por el backend:
 * `dni_ruc` y `nombre_persona` llegan resueltos según el tipo (documento / razón social),
 * `rol` viene como los roles separados por coma y el país expandido (`pais_nombre`,
 * `pais_bandera`) para no tener que pedir el catálogo.
 */
export interface PersonaListRow {
  personaid: number;
  /** `'N'` natural | `'J'` jurídica. */
  tipo: string;
  /** DNI si es natural, RUC si es jurídica. */
  dni_ruc: string;
  /** Apellidos y nombres, o razón social si es jurídica. */
  nombre_persona: string;
  direccion: string;
  /** Denormalizado del teléfono principal. */
  telefono: string;
  /** Denormalizado del email principal. */
  email: string;
  /** Denormalizado: los roles separados por coma. */
  rol: string;
  /** `'M'`, `'F'`, o `'PJ'` en personas jurídicas. */
  sexo: string;
  /**
   * NOMBRE DE ARCHIVO, no una URL, y puede venir vacío. Para pintarlo hace falta la base
   * pública donde el backend sirve las fotos (`PERSONA_FOTO_BASE_URL` en data-access);
   * mientras no esté configurada, la fila cae al avatar por defecto.
   */
  foto: string;
  nacimiento: string;
  paisid: number;
  pais_nombre: string;
  pais_bandera: string;
  estado: boolean;
}

/**
 * Respuesta de `POST /personas/{id}/estado/alternar`. El endpoint devuelve el estado
 * RESULTANTE precisamente para que el cliente no tenga que suponerlo (es un toggle: no
 * se le manda el valor deseado).
 */
export interface PersonaEstado {
  personaid: number;
  estado: boolean;
}

/**
 * Resultado por id de `POST /personas/lote/eliminar`. Una persona puede fallar (tiene
 * ventas o salidas relacionadas) mientras el resto del lote sí se elimina, así que el
 * saldo se lee fila a fila y no del código HTTP.
 */
export interface ResultadoLote {
  personaid: number;
  ok: boolean;
  /** Solo cuando `ok` es `false`: mensaje listo para mostrar. */
  mensaje?: string;
  /** Solo cuando `ok` es `false`: código estable del error. */
  codigo?: string;
}

/**
 * Filtros + paginación de `GET /personas`. Solo `page` y `page_size` son obligatorios;
 * el resto son opcionales y se OMITEN de la query cuando están vacíos (ver
 * `personaQueryParams` en data-access), porque mandar `q=` no es lo mismo que no filtrar.
 */
export interface PersonaListQuery {
  /** Empieza en 1. */
  page: number;
  /** El backend lo acota a 200 para que nadie pida la tabla entera. */
  page_size: number;
  /** Búsqueda global: apellido, razón social, id, email, teléfono o documento. */
  q?: string;
  /** Apellido materno (el paterno entra por `q`). */
  apemat?: string;
  nombre?: string;
  paisid?: number;
  sexo?: 'M' | 'F' | '';
  /** `'Y'` activos | `'N'` inactivos. */
  estado?: Flag | '';
  /** `'Y'` solo con foto | `'N'` solo sin foto. */
  con_foto?: Flag | '';
  tipo?: TipoPersona | '';
  /**
   * El contrato lo admite REPETIBLE (varios roles). El filtro de esta pantalla es de
   * selección única, así que aquí viaja uno solo; para varios haría falta que
   * `buildHttpParams` de `shared/http` supiera repetir un parámetro.
   */
  rolid?: number;
  orderby?: PersonaOrderBy | '';
}
