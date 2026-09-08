/**
 * Modelos del dominio Categoría (`catalogo.categoria`).
 *
 * Es el primer nivel de la clasificación del maestro de productos: cada categoría agrupa
 * subcategorías (`catalogo.subcategoria.categoriaid`) y son las subcategorías las que cuelgan
 * de `catalogo.master`.
 *
 * ⚠ **No es una tabla básica.** No cuelga del hub `TABLAS-BASICAS`: es una opción de menú
 * propia (`basic.menuweb` 72, «Categorías», bajo el padre 70 «Catalogo») con su propio proceso
 * de permiso, `CAT-CATEGORIA`.
 *
 * La fuente de verdad es `phoenix-api/api/openapi.yaml`; estos tipos son la vista de dominio
 * de ese contrato.
 */

/**
 * Fila del catálogo (`GET /categorias`). Ningún campo es opcional: las dos columnas de texto
 * son NOT NULL en la base y el legacy nunca guarda NULL, guarda cadena vacía.
 */
export interface Categoria {
  categoriaid: number;
  nombre: string;
  abreviatura: string;
  /**
   * Número de subcategorías que cuelgan de esta categoría. Es **derivado y de solo lectura**:
   * no es una columna de la tabla, lo calcula el stored procedure agrupando
   * `catalogo.subcategoria`. Nunca viaja en el cuerpo del alta ni de la edición.
   *
   * En el listado del legacy es el botón que abre `SubCategoria.php?categoriaid=<id>`, o sea,
   * el enlace padre → hijo; aquí es el enlace a `/mantenimiento/subcategorias`.
   */
  cantidad_subcategorias: number;
}

/**
 * Cuerpo del alta y de la edición: los dos únicos campos que escribe el stored procedure.
 *
 * No lleva `estado` ni `orden` porque **la tabla no los tiene**: son tres columnas y nada más.
 * Este recurso no tiene por tanto ni interruptor de estado ni reordenar. Tampoco lleva
 * `cantidad_subcategorias`, que es derivado.
 *
 * Solo `nombre` es obligatorio; la abreviatura puede ir vacía.
 */
export interface CategoriaInput {
  nombre: string;
  abreviatura: string;
}

/**
 * Filtros del listado. Los resuelve el SERVIDOR (`GET /categorias?q=`), que se los pasa tal
 * cual al stored procedure.
 */
export interface CategoriaFiltros {
  /** Búsqueda parcial por nombre. Vacío = catálogo completo, no «nombre igual a ''». */
  q?: string;
}

/**
 * Resultado por id de `POST /categorias/lote/eliminar`. Una categoría puede fallar por tener
 * subcategorías mientras el resto del lote sí se elimina, así que el saldo se lee fila a fila
 * y no del código HTTP.
 */
export interface ResultadoLoteCategoria {
  categoriaid: number;
  ok: boolean;
  /** Solo cuando `ok` es `false`: mensaje listo para mostrar, lo redacta el backend. */
  mensaje?: string;
  /** Solo cuando `ok` es `false`: código estable del error (p. ej. `categoria_has_relations`). */
  codigo?: string;
}

/**
 * Límites de las columnas de texto, que el backend también valida.
 *
 * Salen de la COLUMNA, no del formulario del legacy. Aquí coinciden por casualidad
 * —`CategoriaEdit.php` declara 50 y 20 sobre `varchar(50)` y `varchar(20)`—, pero en sus
 * hermanas del módulo el formulario declara 20 sobre `varchar(10)`, y el modal de alta rápida
 * `SubCategoriaEdit-CategoriaAdd.php` no declara ninguno.
 */
/** Límite de `nombre` (`varchar(50)`). */
export const CATEGORIA_MAX_NOMBRE = 50;
/** Límite de `abreviatura` (`varchar(20)`). */
export const CATEGORIA_MAX_ABREVIATURA = 20;
