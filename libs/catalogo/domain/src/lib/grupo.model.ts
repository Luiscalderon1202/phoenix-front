/**
 * Modelos del dominio Grupo (`catalogo.grupo`, opción de menú propia bajo el grupo «Catálogo»
 * — menuweb 81, proceso `CAT-GRUPO`). Es el primer nodo de ese menú (orden 1).
 *
 * ⚠ Un grupo NO cuelga del producto por clave foránea: la relación es N:M a través de
 * `catalogo.producto_grupo`, que es también la única FK que apunta a esta tabla.
 *
 * El listado devuelve el catálogo ENTERO, sin `meta`: no existe `pagrupo_count`. La pantalla
 * filtra por estado y pagina en cliente.
 *
 * ⚠ El reordenamiento lo aporta la **migración 0009 de Phoenix**. La función del legacy sí
 * existe, pero `catalogo.pagrupo_cambiar_orden(myarr)` no recibe `vstart` y numera siempre
 * desde 1: reordenar un tramo lo colaría delante de todo lo demás.
 *
 * La fuente de verdad es `phoenix-api/api/openapi.yaml`.
 */

/** Fila del listado (`GET /grupos`). Nunca hay nulls: el legacy usa cadena vacía. */
export interface Grupo {
  grupoid: number;
  nombre: string;
  /** Etiqueta corta. Puede venir vacía. */
  abreviatura: string;
  /** Posición en la lista. Se cambia con `PATCH /grupos/orden`, nunca con el `PUT`. */
  orden: number;
  /**
   * Se cambia con `POST /grupos/{id}/estado/alternar`, nunca con el `PUT`.
   *
   * ⚠ El listado NO oculta los inactivos: ese filtro lo pone el cliente.
   */
  estado: boolean;
  /**
   * DERIVADO y de SOLO LECTURA: no existe como columna. Lo calcula la base contando
   * `catalogo.producto_grupo`, o sea los PRODUCTOS ASIGNADOS a este grupo.
   *
   * ⚠ El campo se llama `cantidad_productos` y no `count_productos` como en marcas y
   * laboratorios: es el nombre que le da el tipo compuesto del legacy y se respeta.
   */
  cantidad_productos: number;
}

/**
 * Cuerpo del alta y de la edición.
 *
 * Sin `cantidad_productos` (derivado) y sin `estado` ni `orden`: cada uno tiene su propia ruta.
 */
export interface GrupoInput {
  nombre: string;
  abreviatura: string;
}

/**
 * Filtros de `GET /grupos`. Solo el nombre, que es el único parámetro del stored procedure.
 * NO hay paginación: el endpoint devuelve el catálogo entero.
 */
export interface GrupoFiltros {
  /** Búsqueda parcial por nombre, insensible a mayúsculas y a acentos. */
  q?: string;
}

/** Respuesta de `POST /grupos/{id}/estado/alternar`: el estado RESULTANTE del toggle. */
export interface GrupoEstado {
  grupoid: number;
  estado: boolean;
}

/**
 * Resultado por id de `POST /grupos/lote/eliminar`. Un grupo puede fallar (tiene productos
 * asignados) mientras el resto sí se elimina.
 */
export interface ResultadoLoteGrupo {
  grupoid: number;
  ok: boolean;
  /** Solo cuando `ok` es `false`: mensaje listo para mostrar. */
  mensaje?: string;
  /** Solo cuando `ok` es `false`: código estable del error. */
  codigo?: string;
}

/**
 * Límites de las columnas de texto, que el backend también valida. Salen de la COLUMNA; aquí,
 * por una vez, `GrupoEdit.php` no miente.
 */
/** Límite de `nombre` (`varchar(50)`). */
export const GRUPO_MAX_NOMBRE = 50;
/** Límite de `abreviatura` (`varchar(20)`). */
export const GRUPO_MAX_ABREVIATURA = 20;
