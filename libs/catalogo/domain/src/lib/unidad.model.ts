/**
 * Modelos del dominio Unidad Base (`catalogo.unidad`).
 *
 * ⚠ **NO es `catalogo.unidadmedida`.** Son DOS tablas, dos pantallas y dos permisos
 * distintos: ésta es «Unidad Base» (`menuweb` 92, `Unidad.php`, proceso `CAT-UNIDAD`) y
 * aquélla es «Unidades de Medida» (`menuweb` 74, proceso `CAT-UNIDAD-MEDIDA`). Y no son
 * alternativas: `ProductoEdit.php:150-164` pinta los dos selectores lado a lado, porque un
 * producto usa las dos a la vez —la de medida es obligatoria (`producto.unidadmedidaid`) y la
 * base es opcional (`producto.unidadid`)—. El parecido de los nombres es la trampa más fácil
 * de pisar de este módulo.
 *
 * Diferencias con sus hermanas del módulo:
 *
 * - Es la ÚNICA del esquema `catalogo` con `pa*_cambiar_estado` en la base, y la única cuyo
 *   stored procedure escribe en `rastro.campo`. Por eso esta pantalla sí tiene interruptor de
 *   estado por fila.
 * - Su tabla **no tiene columna `orden`**: no se reordena arrastrando y no hay
 *   `PATCH /unidades/orden`. Son siete endpoints, no los ocho de unidades de medida.
 *
 * La fuente de verdad es `phoenix-api/api/openapi.yaml`; estos tipos son la vista de dominio
 * de ese contrato.
 */

/**
 * Fila del catálogo (`GET /unidades`). Ningún campo es opcional: las seis columnas son NOT
 * NULL y el legacy nunca guarda NULL, guarda cadena vacía.
 *
 * **Sin `orden`**: esa columna no existe en `catalogo.unidad`.
 *
 * ⚠ `estado` sólo llega porque la migración 0008 añade `phoenix.paunidad_leer`. El tipo del
 * legacy, `catalogo.type_unidad_leer`, **no incluye esa columna**, así que el listado del
 * legacy no podía pintar un interruptor para el estado que `catalogo.paunidad_cambiar_estado`
 * sí sabía mover.
 */
export interface Unidad {
  unidadid: number;
  nombre: string;
  /** Etiqueta corta. Puede ir vacía. */
  abreviatura: string;
  /**
   * Código del plan contable. Aquí son 20 caracteres; ⚠ en la tabla hermana `unidadmedida` la
   * misma columna es un `varchar(2)`. No se copia el límite de una a otra.
   */
  codigo_contable: string;
  /** Código de la tabla internacional de unidades (SUNAT). */
  codigo_internacional: string;
  estado: boolean;
}

/**
 * Cuerpo del alta y de la edición. Cuatro campos, y sólo `nombre` es obligatorio.
 *
 * NO lleva `estado` a propósito, y esto CORRIGE al legacy además de seguir la convención:
 * `UnidadEdit.php:45` pinta un switch «ACTIVO» (`chkEstado`) y `ajUnidad.php:31` lo lee en
 * `$oU->pEstado`, pero `Acceso.clsUnidad.php` **nunca se lo pasa al stored procedure** —la
 * llamada tiene seis argumentos y ninguno es el estado—. En el legacy ese interruptor del
 * formulario no hace nada: se rellena, se envía y se descarta. Aquí el estado se cambia desde
 * el listado, por `POST /unidades/{id}/estado/alternar`, y ésa es su única fuente de verdad.
 */
export interface UnidadInput {
  nombre: string;
  abreviatura: string;
  codigo_contable: string;
  codigo_internacional: string;
}

/**
 * Filtros del listado. Los dos viajan al SERVIDOR: `phoenix.paunidad_leer` los aplica, y el
 * del nombre pasa por `public.buscar()`, que normaliza acentos (no la ñ).
 */
export interface UnidadFiltros {
  /** Texto libre contra el nombre. Vacío = todas. */
  q?: string;
  /**
   * Si es `false` —el valor por defecto del backend— el listado sólo trae las activas.
   *
   * ⚠ No hay forma de pedir «sólo las inactivas»: el backend no ofrece ese filtro. Quien lo
   * necesite pide todas y descarta las activas en cliente.
   */
  incluir_inactivas?: boolean;
}

/**
 * Respuesta de `POST /unidades/{id}/estado/alternar`. Devuelve el estado RESULTANTE porque es
 * un toggle: al endpoint no se le manda el valor deseado.
 */
export interface UnidadEstado {
  unidadid: number;
  estado: boolean;
}

/**
 * Resultado por id de `POST /unidades/lote/eliminar`. Una unidad puede fallar —la usa un
 * producto o una guía— mientras el resto del lote sí se elimina, así que el saldo se lee fila
 * a fila y no del código HTTP.
 */
export interface ResultadoLoteUnidad {
  unidadid: number;
  ok: boolean;
  /** Sólo cuando `ok` es `false`: mensaje listo para mostrar. */
  mensaje?: string;
  /** Sólo cuando `ok` es `false`: código estable del error. */
  codigo?: string;
}

/**
 * Límites de las columnas de texto, que el backend también valida.
 *
 * Salen de la COLUMNA, no del formulario del legacy. Aquí, por una vez, los dos coinciden
 * —`UnidadEdit.php:41-44` declara 50/20/20/20 y las columnas son
 * `varchar(50)/(20)/(20)/(20)`—, pero se dejan escritos igualmente porque el formulario miente
 * en tres de los otros cuatro recursos del módulo.
 */
/** Límite de `nombre` (`varchar(50)`). */
export const UNIDAD_MAX_NOMBRE = 50;
/** Límite de `abreviatura` (`varchar(20)`). */
export const UNIDAD_MAX_ABREVIATURA = 20;
/** Límite de `codigo_contable` (`varchar(20)`; ⚠ en `unidadmedida` es `varchar(2)`). */
export const UNIDAD_MAX_CODIGO_CONTABLE = 20;
/** Límite de `codigo_internacional` (`varchar(20)`). */
export const UNIDAD_MAX_CODIGO_INTERNACIONAL = 20;
