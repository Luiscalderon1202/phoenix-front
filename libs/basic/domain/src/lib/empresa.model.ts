/**
 * Modelos del dominio Empresa (`basic.empresa`, proceso `EMPRESA`, menuweb 6).
 *
 * La empresa es la persona jurídica que factura. Esto es el MANTENIMIENTO del catálogo: la
 * configuración —certificados, series, correlativos, webservices de SUNAT— es otra pantalla
 * (`EmpresaConfig.php`, ~95 argumentos) y otro tramo.
 *
 * ⚠ NO CONFUNDIR el proceso `EMPRESA` con el ámbito multiempresa. `EMPRESA` decide quién
 * puede MANTENER este catálogo; quién puede OPERAR sobre los datos de una empresa concreta
 * lo decide `basic.permisos_empresa` y viaja como `?empresaid=`.
 */

/**
 * Fila del listado (`GET /empresas`).
 *
 * Ningún campo es opcional: el legacy no usa NULL, usa cadena vacía.
 */
export interface Empresa {
  empresaid: number;
  /** Once dígitos. Es TEXTO, no número: es un identificador. */
  ruc: string;
  /** Razón social. */
  nombre: string;
  nombre_comercial: string;
  abreviatura: string;
  direccion: string;
  url: string;
  email: string;
  telefono: string;

  corporacionid: number;
  corporacion_nombre: string;
  corporacion_abreviatura: string;

  distritoid: number;
  distrito_nombre: string;
  provinciaid: number;
  provincia_nombre: string;
  departamentoid: number;
  departamento_nombre: string;

  /** DERIVADO y de solo lectura: cuenta los locales de la empresa. */
  cantidad_almacenes: number;

  /** Posición en la lista. Se cambia con `PATCH /empresas/orden`, no editando. */
  orden: number;
  /** Se cambia con `POST /empresas/{id}/estado/alternar`, no editando. */
  estado: boolean;
}

/**
 * Ficha del formulario (`GET /empresas/{id}`).
 *
 * ⚠ NO es la fila del listado: añade el país, el ubigeo del distrito y el IGV configurado.
 * Son dos formas distintas a propósito.
 */
export interface EmpresaFicha {
  empresaid: number;
  ruc: string;
  nombre: string;
  nombre_comercial: string;
  abreviatura: string;
  direccion: string;
  url: string;
  email: string;
  telefono: string;

  corporacionid: number;
  corporacion_nombre: string;
  corporacion_abreviatura: string;

  distritoid: number;
  /** Código INEI de seis dígitos. TEXTO: tiene ceros a la izquierda. */
  distrito_ubigeo: string;
  distrito_nombre: string;
  provinciaid: number;
  provincia_nombre: string;
  departamentoid: number;
  departamento_nombre: string;
  paisid: number;
  pais_nombre: string;
  pais_codigo: string;

  /**
   * Tasa de IGV configurada. Sale de `basic.empresa_config`, no de `basic.empresa`, y aquí
   * es de SOLO LECTURA: se cambia en la pantalla de configuración, que es otro tramo.
   *
   * ⚠ Viaja como TEXTO, no como número, por lo mismo que los precios del producto: es un
   * `numeric` y esto factura. Convertirlo a `number` perdería precisión.
   */
  igv: string;

  cantidad_almacenes: number;
  orden: number;
  estado: boolean;
}

/**
 * Cuerpo del alta y de la edición.
 *
 * NO lleva `orden` ni `estado` —cada uno tiene su propia acción— ni `igv`, que no se edita
 * aquí, ni `cantidad_almacenes`, que es derivado.
 */
export interface EmpresaInput {
  corporacionid: number;
  distritoid: number;
  ruc: string;
  nombre: string;
  nombre_comercial: string;
  abreviatura: string;
  direccion: string;
  url: string;
  email: string;
  telefono: string;
}

/** Respuesta del toggle de estado: devuelve el estado RESULTANTE, no el que se pidió. */
export interface EmpresaEstado {
  empresaid: number;
  estado: boolean;
}

/**
 * Límites de las columnas de texto.
 *
 * ⚠ `nombre_comercial` es `varchar(20)` y `abreviatura` es `varchar(100)`: al revés de lo
 * que sugieren los nombres. No es una errata — los límites salen de la columna, no del
 * formulario del legacy.
 */
export const EMPRESA_MAX_NOMBRE = 150;
export const EMPRESA_MAX_NOMBRE_COMERCIAL = 20;
export const EMPRESA_MAX_ABREVIATURA = 100;
export const EMPRESA_MAX_DIRECCION = 250;
export const EMPRESA_MAX_URL = 250;
export const EMPRESA_MAX_EMAIL = 250;
export const EMPRESA_MAX_TELEFONO = 50;

/** Longitud exacta del RUC peruano. Ni diez, ni doce, y solo dígitos. */
export const EMPRESA_LONGITUD_RUC = 11;
