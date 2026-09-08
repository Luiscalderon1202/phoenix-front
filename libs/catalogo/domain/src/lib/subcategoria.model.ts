/**
 * Modelos del dominio Subcategoría (`catalogo.subcategoria`, opción de menú propia bajo el
 * padre «Catalogo», proceso `CAT-SUBCATEGORIA`).
 *
 * Es el segundo escalón de la clasificación del maestro: `catalogo.master` apunta a una
 * subcategoría y de ahí cuelgan los productos. Es además el ÚNICO de los cinco catálogos del
 * módulo que cuelga de otro: toda subcategoría pertenece a una `catalogo.categoria`, y esa
 * relación es obligatoria y con clave foránea de verdad.
 *
 * ⚠⚠ LA UNICIDAD DEL NOMBRE ES GLOBAL, NO POR CATEGORÍA. Teniendo un padre uno espera que dos
 * categorías puedan tener cada una su «GENÉRICOS»; no pueden. Ver `SubcategoriaInput`.
 *
 * La fuente de verdad es `phoenix-api/api/openapi.yaml`; estos tipos son la vista de dominio de
 * ese contrato.
 */

/**
 * Fila del catálogo (`GET /subcategorias`). Ningún campo es opcional: todas las columnas son
 * NOT NULL en la base y el legacy nunca guarda NULL, guarda cadena vacía.
 */
export interface Subcategoria {
  subcategoriaid: number;
  nombre: string;
  /** Etiqueta corta. ⚠ Solo DIEZ caracteres, aunque el formulario del legacy deje escribir 20. */
  abreviatura: string;
  /** La categoría de la que cuelga. Obligatoria: columna NOT NULL con clave foránea. */
  categoriaid: number;
  /**
   * Nombre de la categoría padre, para que el listado no tenga que cruzarlo en el cliente.
   * DERIVADO del join con `catalogo.categoria`: de solo lectura, ningún endpoint lo escribe.
   */
  categoria_nombre: string;
  /**
   * Cuántos PRODUCTOS cuelgan de esta subcategoría, contados vía `producto ⋈ master`. No son
   * masters: un master con tres productos cuenta tres. DERIVADO: de solo lectura.
   */
  count_productos: number;
}

/**
 * Cuerpo del alta y de la edición.
 *
 * `categoriaid` es OBLIGATORIO también en la edición: el stored procedure hace
 * `set categoriaid = incategoriaid` en los dos casos, así que omitirlo en un PUT reasignaría la
 * subcategoría a la categoría 0 («NO DEFINIDO»). Por eso el backend lo valida con `> 0` y no
 * con un simple «presente»: el 0 existe como fila centinela y pasaría la clave foránea.
 *
 * NO lleva `estado` ni `orden`: esta tabla NO TIENE esas columnas —no es que se omitan por
 * convención—, y por eso el recurso se queda en seis endpoints.
 *
 * Tampoco lleva `categoria_nombre` ni `count_productos`: son derivados.
 *
 * ⚠⚠ EL NOMBRE ES ÚNICO EN TODA LA TABLA, NO DENTRO DE LA CATEGORÍA.
 * `pasubcategoria_actualizar` compara `trim(upper(buscar(nombre)))` contra TODAS las filas, sin
 * `and categoriaid = incategoriaid`. Un 409 `subcategoria_duplicate` puede venir de una
 * subcategoría de OTRA categoría, y eso no es un fallo: es el stored procedure del legacy. Es
 * exactamente lo contrario de `inventarios.motivo_notas`, donde la columna `tipo` sí parte el
 * catálogo y la unicidad. Ningún mensaje de esta pantalla debe sugerir que la restricción es
 * por categoría.
 */
export interface SubcategoriaInput {
  categoriaid: number;
  nombre: string;
  abreviatura: string;
}

/**
 * Filtros del listado. Los dos van al SERVIDOR y los resuelve el stored procedure
 * (`pasubcategoria_leer(vnombre, vcategoriaid)`), que sí aplica los dos.
 *
 * ⚠ No confundir con `pasubcategoria_consulta`, que declara `vcategoriaid` y no lo usa nunca.
 */
export interface SubcategoriaFiltros {
  /** Texto libre contra el nombre. El SP lo compara con `buscar()`, que ignora acentos. */
  q?: string;
  /**
   * Categoría por la que acotar. `undefined` = sin filtro.
   *
   * ⚠ El desplegable del legacy manda literalmente `-1` para «TODAS LAS CATEGORIAS». Aquí la
   * ausencia de filtro se expresa omitiendo el parámetro, no mandando un centinela.
   */
  categoriaid?: number;
}

/**
 * Resultado por id de `POST /subcategorias/lote/eliminar`. Una subcategoría puede fallar (la usa
 * algún master o el stock valorado) mientras el resto del lote sí se elimina, así que el saldo
 * se lee fila a fila y no del código HTTP.
 */
export interface ResultadoLoteSubcategoria {
  subcategoriaid: number;
  ok: boolean;
  /** Solo cuando `ok` es `false`: mensaje listo para mostrar. */
  mensaje?: string;
  /** Solo cuando `ok` es `false`: código estable del error. */
  codigo?: string;
}

/**
 * Límites de las columnas de texto, que el backend también valida.
 *
 * ⚠ Salen de la COLUMNA, no del formulario del legacy: `SubCategoriaEdit.php` declara
 * `maxlength=20` para la abreviatura sobre un `varchar(10)`. El formulario deja escribir el
 * doble de lo que cabe y la base respondería con un 22001.
 */
/** Límite de `nombre` (`varchar(50)`). */
export const SUBCATEGORIA_MAX_NOMBRE = 50;
/** Límite de `abreviatura` (`varchar(10)`). El formulario del legacy dice 20 y miente. */
export const SUBCATEGORIA_MAX_ABREVIATURA = 10;
