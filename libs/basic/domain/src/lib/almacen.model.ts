/**
 * Modelos del dominio Local (`basic.almacen`, proceso `ALMACEN`, menuweb 69).
 *
 * ⚠ La tabla se llama `almacen` pero la pantalla habla de LOCALES: no es un depósito de
 * mercadería, es la sede física —con su dirección, su teléfono y su distrito— desde la que
 * se vende. Por eso la referencian la caja, las series, los correlativos de pedido y los
 * precios por almacén.
 *
 * Esto es el MANTENIMIENTO. La configuración de venta por local vive en
 * `basic.empresa_almacen`, tras un procedimiento de ~55 argumentos, y es otro tramo.
 */

/**
 * Fila del listado (`GET /almacenes`), con los catálogos ya resueltos.
 *
 * ⚠ `empresaid` y `grupoid` pueden llegar en **cero**, y es normal: no son columnas de
 * `basic.almacen`, salen de sendos LEFT JOIN contra `basic.empresa_almacen` y
 * `basic.almacen_config`. Un local sin asignar no tiene fila en ninguna de las dos. El
 * backend los normaliza a 0 y cadena vacía; la pantalla los pinta como «—».
 */
export interface Almacen {
  almacenid: number;
  nombre: string;
  abreviatura: string;
  direccion: string;
  telefono: string;
  email: string;
  web: string;

  /** Posición en la lista. Se cambia con `PATCH /almacenes/orden`, no editando. */
  orden: number;
  /** Se cambia con `POST /almacenes/{id}/estado/alternar`, no editando. */
  estado: boolean;

  zonaid: number;
  zona_nombre: string;
  zona_abreviatura: string;

  unidadnegocioid: number;
  unidadnegocio_nombre: string;
  unidadnegocio_abreviatura: string;

  /** 0 si el local no está asignado a ninguna empresa en `basic.empresa_almacen`. */
  empresaid: number;
  empresa_nombre: string;
  empresa_abreviatura: string;

  /** Agrupación de locales que comparten stock y precios. 0 si no tiene configuración. */
  grupoid: number;
  grupo_nombre: string;
  grupo_abreviatura: string;

  distritoid: number;
  distrito_nombre: string;
  provinciaid: number;
  provincia_nombre: string;
  departamentoid: number;
  departamento_nombre: string;

  tipoempresaid: number;
  tipoempresa_nombre: string;

  /** DERIVADO y de solo lectura: el personal asignado al local. */
  cantidad_personas: number;
  /**
   * DERIVADO: los nombres de ese personal, ya concatenados por la base.
   *
   * ⚠ Llega con marcado del legacy dentro, del estilo `Fredd Lopez y [1]22[/1] personas
   * más`: el PHP renderiza esos corchetes como una etiqueta. Aquí se limpian con
   * `limpiarDetallePersonas` antes de pintarlo.
   */
  personas_detalle: string;
}

/**
 * Ficha del formulario (`GET /almacenes/{id}`).
 *
 * ⚠ NO es un subconjunto de `Almacen`: trae `nombre_comercial`, que el listado no devuelve,
 * y le faltan el orden, la empresa, las abreviaturas de los catálogos y los contadores de
 * personal. Por eso son dos interfaces y no una.
 */
export interface AlmacenFicha {
  almacenid: number;
  nombre: string;
  abreviatura: string;
  /** Solo está aquí; el listado no lo devuelve. */
  nombre_comercial: string;
  direccion: string;
  telefono: string;
  email: string;
  web: string;
  estado: boolean;

  zonaid: number;
  zona_nombre: string;
  unidadnegocioid: number;
  unidadnegocio_nombre: string;
  grupoid: number;
  grupo_nombre: string;
  distritoid: number;
  distrito_nombre: string;
  provinciaid: number;
  provincia_nombre: string;
  departamentoid: number;
  departamento_nombre: string;
  tipoempresaid: number;
  tipoempresa_nombre: string;
}

/**
 * Cuerpo del alta y de la edición: los campos que escribe el stored procedure.
 *
 * NO lleva `orden` ni `estado` —cada uno tiene su propia acción— ni `grupoid`, que es de la
 * configuración del local y no de este formulario.
 */
export interface AlmacenInput {
  zonaid: number;
  unidadnegocioid: number;
  tipoempresaid: number;
  distritoid: number;
  nombre: string;
  nombre_comercial: string;
  abreviatura: string;
  direccion: string;
  telefono: string;
  email: string;
  web: string;
}

/** Filtros del listado. Los cuatro los aplica el SERVIDOR. */
export interface AlmacenFiltros {
  /** Coincidencia parcial por nombre. El backend compara ignorando acentos. */
  q?: string;
  unidadnegocioid?: number;
  zonaid?: number;
  tipoempresaid?: number;
}

/** Respuesta del toggle de estado: devuelve el estado RESULTANTE. */
export interface AlmacenEstado {
  almacenid: number;
  estado: boolean;
}

/**
 * Límites de las columnas de texto.
 *
 * ⚠ Salen de la COLUMNA, no del formulario del legacy: `AlmacenEdit.php` declara
 * `maxlength=250` para el nombre sobre un `varchar(50)` y 100 para el nombre comercial sobre
 * un `varchar(250)`. Miente en las dos direcciones a la vez.
 */
export const ALMACEN_MAX_NOMBRE = 50;
export const ALMACEN_MAX_ABREVIATURA = 20;
export const ALMACEN_MAX_NOMBRE_COMERCIAL = 250;
export const ALMACEN_MAX_DIRECCION = 200;
export const ALMACEN_MAX_TELEFONO = 50;
export const ALMACEN_MAX_EMAIL = 150;
export const ALMACEN_MAX_WEB = 250;

/**
 * Quita el marcado del legacy de `personas_detalle`.
 *
 * El backend devuelve el texto tal cual lo arma la base, con pares `[1]…[/1]` que el PHP
 * pintaba como una etiqueta resaltada. Aquí se conserva el texto y se tiran los corchetes:
 * reimplementar el resaltado obligaría a meter HTML sin escapar en la celda.
 */
export function limpiarDetallePersonas(detalle: string): string {
  return detalle.replace(/\[\/?\d+\]/g, '');
}
