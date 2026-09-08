/**
 * Modelos del dominio Laboratorio (`catalogo.laboratorio`, opción de menú propia bajo el grupo
 * «Catálogo» — menuweb 91, proceso `CAT-LABORATORIO`).
 *
 * A diferencia de la línea y la marca, el laboratorio cuelga DIRECTAMENTE del producto
 * (`catalogo.producto.laboratorioid`).
 *
 * ⚠ Es el gemelo exacto de Marca: la tabla son tres columnas —`laboratorioid`, `nombre`,
 * `abreviatura`— y no tiene ni `estado` ni `orden`, así que el recurso son SEIS endpoints. El
 * legacy aparenta lo contrario con código muerto en sus tres capas: un `change_status` que
 * invoca `catalogo.palaboratorio_cambiar_estado` —función que no existe, sobre una columna que
 * tampoco— y un `change_order` que llama a un método ausente de la clase.
 *
 * ⚠ PAGINA y FILTRA EN SERVIDOR, como marcas y líneas: la respuesta trae `meta`.
 *
 * La fuente de verdad es `phoenix-api/api/openapi.yaml`.
 */

/** Fila del listado paginado (`GET /laboratorios`). Nunca hay nulls: el legacy usa cadena vacía. */
export interface Laboratorio {
  laboratorioid: number;
  nombre: string;
  /** Etiqueta corta. Puede venir vacía. */
  abreviatura: string;
  /**
   * DERIVADO y de SOLO LECTURA: no existe como columna. Lo calcula la base contando
   * `catalogo.producto` por laboratorio.
   *
   * ⚠ Se llama `count_productos` —como en marcas— y no `cantidad_productos` como en grupos,
   * colores y tallas. Es el nombre del tipo compuesto del legacy.
   */
  count_productos: number;
}

/**
 * Cuerpo del alta y de la edición. Son exactamente los dos campos que escribe el stored
 * procedure. Sin `estado` ni `orden`: esas columnas no existen en esta tabla.
 */
export interface LaboratorioInput {
  nombre: string;
  abreviatura: string;
}

/**
 * Filtros + paginación de `GET /laboratorios`.
 *
 * ⚠ El tamaño de página viaja como `page_size`, en snake_case.
 */
export interface LaboratorioListQuery {
  /** Empieza en 1. */
  page: number;
  /** El backend lo acota para que nadie pida la tabla entera. */
  page_size: number;
  /**
   * Búsqueda parcial por nombre, insensible a mayúsculas y a acentos.
   *
   * ⚠ En el legacy este filtro NO FUNCIONA: `ajLaboratorio.php:19` llama `Leer($vNombre)`
   * contra una firma `Leer($vInicio, $vFin, $vNombre)`, así que el texto cae en el offset y se
   * convierte en 0. Phoenix lo cablea como el stored procedure fue diseñado.
   */
  q?: string;
}

/**
 * Resultado por id de `POST /laboratorios/lote/eliminar`. Un laboratorio puede fallar (tiene
 * productos) mientras el resto sí se elimina.
 */
export interface ResultadoLoteLaboratorio {
  laboratorioid: number;
  ok: boolean;
  /** Solo cuando `ok` es `false`: mensaje listo para mostrar. */
  mensaje?: string;
  /** Solo cuando `ok` es `false`: código estable del error. */
  codigo?: string;
}

/**
 * Límites de las columnas de texto, que el backend también valida.
 *
 * ⚠ Salen de la COLUMNA: `LaboratorioEdit.php` declara `maxlength=20` para la abreviatura
 * sobre un `varchar(10)`, el mismo error que `MarcaEdit.php`.
 */
/** Límite de `nombre` (`varchar(50)`). */
export const LABORATORIO_MAX_NOMBRE = 50;
/** Límite de `abreviatura` (`varchar(10)`), no los 20 que promete el formulario del legacy. */
export const LABORATORIO_MAX_ABREVIATURA = 10;
