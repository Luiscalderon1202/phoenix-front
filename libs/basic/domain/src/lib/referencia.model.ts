/**
 * Catálogos de apoyo de los formularios de Empresa y Local (`GET /catalogos/*`).
 *
 * ⚠ Los cuatro son de SOLO LECTURA, y no por decisión de Phoenix: **ninguno tiene pantalla
 * de mantenimiento**. `basic.zona` no tiene ni fila en `basic.menuweb`; las de unidad de
 * negocio (menuweb 20) y corporación (95) existen pero están con `estado=false`. Se editan
 * contra la base. Aquí solo se leen para poblar desplegables.
 *
 * Van juntos en un archivo porque no son un dominio: son los selectores de otros dos.
 */

/** Zona geográfica comercial (`basic.zona`). Selector del formulario de un local. */
export interface Zona {
  zonaid: number;
  nombre: string;
  abreviatura: string;
  orden: number;
  estado: boolean;
}

/**
 * Unidad de negocio (`basic.unidad_negocio`). Cuelga de un tipo de empresa, así que en el
 * formulario del local los dos selectores van encadenados: elegido el tipo, se piden las
 * unidades de ese tipo.
 */
export interface UnidadNegocio {
  unidadnegocioid: number;
  tipoempresaid: number;
  /** Resuelto por el backend; sin él la columna del selector saldría vacía. */
  tipoempresa_nombre: string;
  nombre: string;
  abreviatura: string;
  direccion: string;
  telefono: string;
  orden: number;
  estado: boolean;
}

/** Corporación (`basic.corporacion`). Toda empresa cuelga de una. */
export interface Corporacion {
  corporacionid: number;
  nombre: string;
  abreviatura: string;
  telefono: string;
  email: string;
  url: string;
  /** DERIVADO y de solo lectura: cuenta las empresas de la corporación. */
  cantidad_empresas: number;
  orden: number;
  estado: boolean;
}

/**
 * Distrito con su cadena geográfica ya resuelta, tal y como lo devuelve el BUSCADOR
 * `GET /catalogos/distritos`.
 *
 * ⚠ No es un catálogo que se pueda cargar entero: son 1.839 filas y el backend exige acotar
 * (dos caracteres de texto, o un departamento, o una provincia). Sin eso devuelve lista
 * vacía. Ver `DISTRITO_MIN_BUSQUEDA`.
 */
export interface Distrito {
  distritoid: number;
  nombre: string;
  provinciaid: number;
  provincia: string;
  departamentoid: number;
  departamento: string;
  /** Código INEI de seis dígitos. Es TEXTO: tiene ceros a la izquierda. */
  ubigeo: string;
}

/**
 * Caracteres mínimos antes de consultar distritos. El backend aplica el mismo corte; se
 * repite aquí para no gastar una petición que va a volver vacía.
 */
export const DISTRITO_MIN_BUSQUEDA = 2;

/** Etiqueta de un distrito para un desplegable: «DISTRITO (PROVINCIA, DEPARTAMENTO)». */
export function etiquetaDistrito(d: Distrito): string {
  return `${d.nombre} (${d.provincia}, ${d.departamento})`;
}

/**
 * Documento de identidad del catálogo `basic.tipoid` (DNI, RUC, pasaporte, carné
 * de extranjería), para el formulario de persona.
 *
 * ⚠ De solo lectura aquí, y no por falta de pantalla: el mantenimiento existe pero
 * exige el proceso `TABLAS-BASICAS`, y quien da de alta un cliente no tiene por qué
 * tenerlo. Mismo motivo para los dos siguientes.
 */
export interface TipoIDCatalogo {
  tipoid: number;
  nombre: string;
  abreviatura: string;
  /** Código SUNAT del documento. */
  codigo_contable: string;
  /** Dígitos que debe tener: 8 el DNI, 11 el RUC. */
  longitud: number;
  /** A qué clase de persona aplica: N, J o X (ambas). */
  tipopersona: string;
  orden: number;
  estado: boolean;
}

/**
 * Forma que COMPARTEN los catálogos de tipos de teléfono y de email: las dos
 * tablas tienen exactamente las mismas seis columnas.
 *
 * ⚠ Su clave se llama `tipoid` igual que la de los documentos de identidad, y **no
 * son lo mismo**: son espacios de numeración distintos que comparten nombre.
 */
export interface TipoContacto {
  tipoid: number;
  nombre: string;
  /** Los que el formulario del legacy pide obligatoriamente. */
  requerido: boolean;
  /** Cuál se propone al añadir una fila nueva. */
  pordefecto: boolean;
  orden: number;
  estado: boolean;
}

/** Red social del catálogo `basic.tiposocialmedia`. */
export interface TipoRedSocial {
  tipoid: number;
  nombre: string;
  /** Plantilla del perfil; se le concatena el usuario. */
  url: string;
  icono: string;
  orden: number;
  estado: boolean;
}

/**
 * País (`basic.pais`), para el selector del formulario de persona.
 *
 * El tipo compuesto del legacy trae 21 columnas, casi todas contadores de configuración
 * que ningún selector usa. Aquí están solo las que se pintan.
 */
export interface Pais {
  paisid: number;
  nombre: string;
  abreviatura: string;
  /** Nombre de archivo del icono, no una URL. */
  bandera: string;
  pordefecto: boolean;
  orden: number;
  estado: boolean;
}
