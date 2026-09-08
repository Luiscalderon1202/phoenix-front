/**
 * Modelos del dominio Marca (`catalogo.marca`, opción de menú propia bajo el grupo
 * «Catálogo» — menuweb 73, proceso `CAT-MARCA`).
 *
 * La marca la lleva el master (`catalogo.master.marcaid`), no el producto, y el listado la
 * acompaña con el número de productos que la usan.
 *
 * ⚠ Es el ÚNICO de los cinco recursos del módulo que PAGINA y FILTRA EN SERVIDOR: su familia
 * de funciones incluye `pamarca_leer(vinicio, vfin, vnombre)` y `pamarca_count(vnombre)`. Los
 * otros cuatro devuelven el catálogo entero sin `meta`.
 *
 * La tabla tiene tres columnas y nada más —`marcaid`, `nombre`, `abreviatura`—: no hay
 * `estado` ni `orden`, así que el recurso son SEIS endpoints y no ocho.
 *
 * La fuente de verdad es `phoenix-api/api/openapi.yaml`; estos tipos son la vista de dominio
 * de ese contrato.
 */

/**
 * Fila del listado paginado (`GET /marcas`). Ningún campo es opcional: las columnas son
 * NOT NULL en la base y el legacy nunca guarda NULL, guarda cadena vacía.
 */
export interface Marca {
  marcaid: number;
  nombre: string;
  /** Etiqueta corta. La base la deja vacía: es `not null` pero sin default ni check. */
  abreviatura: string;
  /**
   * DERIVADO y de SOLO LECTURA: no existe como columna. El stored procedure lo calcula
   * contando `catalogo.producto` a través de `catalogo.master` y lo une con
   * `coalesce(..., 0)`.
   *
   * Cuenta PRODUCTOS, no masters ni marcas: un master con tres presentaciones suma tres.
   * Ningún cuerpo de entrada lo acepta.
   */
  count_productos: number;
}

/**
 * Cuerpo del alta y de la edición. Son exactamente los dos campos que escribe
 * `pamarca_actualizar`.
 *
 * Sin `count_productos` (derivado) y sin `estado` ni `orden` (esas columnas no existen en
 * esta tabla). Solo `nombre` es obligatorio.
 */
export interface MarcaInput {
  nombre: string;
  abreviatura: string;
}

/**
 * Filtros + paginación de `GET /marcas`.
 *
 * ⚠ El parámetro del tamaño de página se llama `page_size`, en snake_case: es el nombre que
 * viaja en la URL y el que documenta el contrato. No se renombra a `pageSize` para que el
 * mapeo sea rastreable de un vistazo.
 *
 * `page` y `page_size` son obligatorios; `q` se OMITE de la query cuando está vacío, porque
 * mandar `q=` no es lo mismo que no filtrar.
 */
export interface MarcaListQuery {
  /** Empieza en 1. */
  page: number;
  /** El backend lo acota para que nadie pida la tabla entera. */
  page_size: number;
  /**
   * Búsqueda parcial por nombre. El SP compara
   * `upper(buscar(m.nombre)) like '%'||upper(buscar(vnombre))||'%'`: insensible a mayúsculas
   * y a acentos.
   *
   * ⚠ `public.buscar()` tiene dos erratas conocidas que el backend NO corrige —no normaliza
   * la ñ y su bloque de mayúsculas dice `AEOIU` en vez de `AEIOU`—, así que una `Ì` literal
   * se traduce a O. Solo muerde con mayúsculas acentuadas escritas a mano.
   */
  q?: string;
}

/**
 * Resultado por id de `POST /marcas/lote/eliminar`. Una marca puede fallar (tiene masters
 * colgando) mientras el resto del lote sí se elimina, así que el saldo se lee fila a fila y
 * no del código HTTP.
 */
export interface ResultadoLoteMarca {
  marcaid: number;
  ok: boolean;
  /** Solo cuando `ok` es `false`: mensaje listo para mostrar. */
  mensaje?: string;
  /** Solo cuando `ok` es `false`: código estable del error. */
  codigo?: string;
}

/**
 * Límites de las columnas de texto, que el backend también valida.
 *
 * ⚠ Salen de la COLUMNA, no del formulario del legacy: `MarcaEdit.php` declara
 * `maxlength=20` para la abreviatura sobre un `varchar(10)`. El formulario deja escribir el
 * doble de lo que cabe y la base responde con un 22001.
 */
/** Límite de `nombre` (`varchar(50)`). */
export const MARCA_MAX_NOMBRE = 50;
/** Límite de `abreviatura` (`varchar(10)`), no los 20 que promete el formulario del legacy. */
export const MARCA_MAX_ABREVIATURA = 10;
