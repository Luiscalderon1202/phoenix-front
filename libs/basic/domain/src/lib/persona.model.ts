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

// ─── Ficha, alta y edición ───────────────────────────────────────────────────

/**
 * Ficha del formulario (`GET /personas/{id}`).
 *
 * ⚠ NO es la fila del listado: separa los campos por tipo de persona y añade las
 * cuatro listas hijas más los roles. El backend la arma con seis consultas, porque
 * el stored procedure de lectura no devuelve los hijos aunque el de escritura sí
 * los reciba todos juntos.
 */
export interface PersonaFicha {
  personaid: number;
  /** `N` natural, `J` jurídica. Decide qué mitad del formulario aplica. */
  tipo: TipoPersona;

  direccion: string;
  distritoid: number;
  paisid: number;
  /** Se cambia con el interruptor del listado, no editando. */
  estado: boolean;
  /**
   * Fecha de alta, de SOLO LECTURA.
   *
   * ⚠ Llega como `dd/mm/aaaa hh:mm AM`, ya formateada por la base — la columna del
   * tipo compuesto es texto, no `date` —, y NO en ISO como `nacimiento`. No intentes
   * parsearla con `new Date()`.
   */
  registro: string;

  // Solo persona natural.
  titulo: string;
  ape_pat: string;
  ape_mat: string;
  nombre: string;
  sexo: string;
  est_civil: string;
  /** ISO `aaaa-mm-dd`. Obligatoria para una persona natural. */
  nacimiento: string;

  // Solo persona jurídica.
  raz_soc: string;
  nombre_comercial: string;

  // Cadena geográfica resuelta, para pintarla sin otra petición.
  distrito_nombre: string;
  provinciaid: number;
  provincia_nombre: string;
  departamentoid: number;
  departamento_nombre: string;
  pais_nombre: string;

  /**
   * Nombre de archivo, de SOLO LECTURA. Se cambia con su propio endpoint del
   * legacy, que exige el permiso `persona-photo` y **no está migrado**.
   */
  foto: string;

  telefonos: PersonaTelefono[];
  emails: PersonaEmail[];
  social_media: PersonaSocialMedia[];
  documentos: PersonaDocumento[];
  /** Solo los ids: el nombre lo tiene el cliente por `/catalogos/roles`. */
  roles: number[];
}

/** Teléfono de una persona. */
export interface PersonaTelefono {
  telefonoid: number;
  personaid: number;
  /**
   * Apunta a `basic.tipotelefono`.
   *
   * ⚠ NO es el mismo espacio de numeración que el `tipoid` de un documento de
   * identidad ni el de un email, aunque las tres columnas se llamen igual.
   */
  tipoid: number;
  tipo_nombre: string;
  /** Lo aporta el catálogo, no la fila. */
  tipo_requerido: boolean;
  numero: string;
  nombre: string;
  /** El principal, que es el que sube a la columna `telefono` de la persona. */
  main: boolean;
  publico: boolean;
}

/** Email de una persona. */
export interface PersonaEmail {
  emailid: number;
  personaid: number;
  /** Apunta a `basic.tipoemail`. */
  tipoid: number;
  tipo_nombre: string;
  tipo_requerido: boolean;
  email: string;
  nombre: string;
  main: boolean;
  publico: boolean;
}

/**
 * Red social de una persona.
 *
 * ⚠ No tiene id propio: la tabla se identifica por (personaid, tipoid). Por eso el
 * guardado la borra entera y la reinserta.
 */
export interface PersonaSocialMedia {
  personaid: number;
  /** Apunta a `basic.tiposocialmedia`. */
  tipoid: number;
  tipo_nombre: string;
  /** Plantilla del perfil; se le concatena el usuario. */
  tipo_url: string;
  usuario: string;
}

/** Documento de identidad de una persona. */
export interface PersonaDocumento {
  personaid: number;
  /** Apunta a `basic.tipoid` (DNI, RUC…). Otro espacio de numeración. */
  tipoid: number;
  tipo_nombre: string;
  numero: string;
  /** «DNI 12345678», ya compuesto por la base. */
  tipo_nombre_numero: string;
  main: boolean;
}

/**
 * Cuerpo del alta y de la edición. Escribe la persona ENTERA en una llamada.
 *
 * ⚠ **LAS CINCO LISTAS SE GUARDAN POR REEMPLAZO, NO POR ACUMULACIÓN.** Hay que
 * mandar siempre el juego completo, también al editar:
 *
 * - **Teléfonos y emails** se actualizan por su id (`telefonoid`/`emailid` en `0`
 *   da de alta) y **lo que no se envíe se BORRA**.
 * - **Redes, documentos y roles** se borran enteros y se reinsertan.
 *
 * Mandar una lista vacía significa «quítalos todos», no «no los toques».
 *
 * No lleva `estado` ni `foto`: cada uno tiene su ruta y su permiso.
 */
export interface PersonaInput {
  tipo: TipoPersona;
  direccion: string;
  distritoid: number;
  paisid: number;

  titulo: string;
  ape_pat: string;
  ape_mat: string;
  nombre: string;
  sexo: string;
  est_civil: string;
  /** ISO `aaaa-mm-dd`. OBLIGATORIA si `tipo` es `N`: la columna es NOT NULL. */
  nacimiento: string;

  raz_soc: string;
  nombre_comercial: string;
  sunat_activo: boolean;
  sunat_habido: boolean;

  telefonos: PersonaTelefonoInput[];
  emails: PersonaEmailInput[];
  social_media: PersonaSocialMediaInput[];
  documentos: PersonaDocumentoInput[];
  roles: number[];
}

/** `telefonoid` en 0 da de alta; con valor, actualiza esa fila. */
export interface PersonaTelefonoInput {
  telefonoid: number;
  tipoid: number;
  numero: string;
  nombre: string;
  main: boolean;
  publico: boolean;
}

/** `emailid` en 0 da de alta; con valor, actualiza esa fila. */
export interface PersonaEmailInput {
  emailid: number;
  tipoid: number;
  email: string;
  main: boolean;
  publico: boolean;
}

export interface PersonaSocialMediaInput {
  tipoid: number;
  usuario: string;
}

export interface PersonaDocumentoInput {
  tipoid: number;
  numero: string;
}

/**
 * Límites de las columnas de texto.
 *
 * ⚠ Salen de la COLUMNA, comprobados uno a uno contra el catálogo. Fíjate en que
 * el nombre y los apellidos son 50, no 100, y el título 20.
 */
export const PERSONA_MAX_TITULO = 20;
export const PERSONA_MAX_APELLIDO = 50;
export const PERSONA_MAX_NOMBRE = 50;
export const PERSONA_MAX_RAZ_SOC = 250;
export const PERSONA_MAX_NOMBRE_COMERCIAL = 100;
export const PERSONA_MAX_DIRECCION = 255;
