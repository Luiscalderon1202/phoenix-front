/**
 * Modelos del dominio Producto (`catalogo.producto`, menuweb 76, proceso `CAT-PRODUCTO`).
 *
 * ⚠ `Producto.php` es UNA pantalla con DOS grillas —«Productos Detallados» y «Productos
 * Master»— que comparten siete filtros y el mismo permiso. Este archivo es la primera; la
 * segunda está en `master.model.ts`.
 *
 * ⚠ ESTO ES LA ADMINISTRACIÓN, NO EL EDITOR. Las operaciones son listar, filtrar, alternar
 * estado, borrar y cambiar de master. El alta y la edición viven en
 * `plantillas/ProductoMasterEdit.php`, contra un stored procedure de 64 argumentos que escribe
 * producto y master a la vez, y son otro tramo: por eso no hay `ProductoInput`.
 *
 * La fuente de verdad es `phoenix-api/api/openapi.yaml`.
 */

/**
 * Fila de la grilla de productos, que NO es la tabla: trae los nombres de categoría,
 * subcategoría y marca ya resueltos por sus joins, el stock y el contador de fotos.
 */
export interface Producto {
  productoid: number;
  masterid: number;
  /**
   * DERIVADO: el stored procedure lo compone como `master.nombre + ", " + presentacion`. No es
   * una columna, así que no se puede ordenar ni filtrar por él tal cual; la búsqueda por texto
   * lo cubre.
   */
  nombre: string;
  /** 0 = gravado, 1 = exonerado, 2 = inafecto. `smallint` SIN clave foránea. */
  tipotributo: number;
  /** Sigla que calcula el propio stored procedure: `GRA`, `EXO` o `INA`. */
  tipotributo_nombre: string;

  categoriaid: number;
  categoria_nombre: string;
  subcategoriaid: number;
  subcategoria_nombre: string;
  marcaid: number;
  marca_nombre: string;

  /**
   * ⚠ LOS IMPORTES Y EL STOCK SON CADENAS, no números, y es deliberado.
   *
   * En la base son `numeric` —los precios con seis decimales— y esto es un ERP de facturación
   * electrónica: pasarlos por un `number` de JavaScript los redondearía. El backend los manda
   * tal cual ("12.500000") y aquí no se convierten: se formatean para mostrar y se comparan
   * como texto.
   *
   * Si algún día hay que operar con ellos —lo habrá en pedido y en venta—, el sitio es una
   * utilidad decimal, no un `parseFloat` repartido por las plantillas.
   */
  precio_com: string;
  precio_va: string;
  precio_vb: string;
  precio_vc: string;
  precio_vd: string;
  flete: string;
  peso: string;
  /** DERIVADO: suma de `inventarios.stock` sobre TODOS los almacenes, sin filtrar por empresa. */
  stock: string;
  fraccion_cantidad: string;

  fraccion_productoid: number;
  stock_min: number;
  stock_max: number;
  codigo_barras: string;
  observacion: string;
  oferta: boolean;
  servicio: boolean;
  /** Impuesto al consumo de bolsas plásticas. */
  icbp: boolean;

  /** Sale del master. `moneda_simbolo` lo resuelve el backend con un join contra tipo_moneda. */
  moneda: string;
  moneda_simbolo: string;

  /** Se cambia con `POST /productos/{id}/estado/alternar`. El listado NO oculta los inactivos. */
  estado: boolean;

  /**
   * NOMBRE del archivo, no una URL: todavía no hay dónde servirlas y `catalogo.productofoto`
   * tiene 0 filas en producción, así que hoy siempre viene vacío.
   */
  foto: string;
  cantidad_fotos: number;
}

/** Valores del filtro de existencias. Son los literales que compara el stored procedure. */
export type FiltroStock = 'CONSTOCK' | 'SINSTOCK' | 'STOCKNEGATIVO';

/** Valores del filtro de estado. `Y` = solo activos, `N` = solo inactivos, ausente = todos. */
export type FiltroEstado = 'Y' | 'N';

/** Columnas por las que el stored procedure de productos sabe ordenar. */
export type ProductoOrderBy =
  | 'productoid'
  | 'masterid'
  | 'stock'
  | 'precio_com'
  | 'precio_va'
  | 'precio_vb';

/**
 * Filtros que comparten las dos pestañas. La de productos añade `productoid` y
 * `unidadmedidaid`; la de masters, `masterid`.
 *
 * ⚠ NO hay filtro por tipo de operación, aunque la pantalla del legacy pinte ese desplegable:
 * `vtipooperacionid` es un parámetro muerto en los stored procedures —se declara y no se usa—,
 * así que ese filtro nunca filtró nada. El backend no lo expone.
 */
export interface FiltrosCatalogoProducto {
  /**
   * Búsqueda por texto. En productos casa el nombre compuesto, el código de barras y el código
   * interno; en masters, el nombre y la abreviatura.
   *
   * Dos comodines del legacy que conviene conocer: el carácter `+` se traduce a `%`
   * (`lapicero+azul` casa «lapicero … azul»), y los prefijos `ID 123` y `MID 45` casan el id
   * exacto del producto y de su master.
   *
   * ⚠ La comparación NO usa `public.buscar()`: al revés que en marcas o grupos, aquí los
   * ACENTOS SÍ DISTINGUEN.
   */
  q?: string;
  lineaid?: number;
  categoriaid?: number;
  subcategoriaid?: number;
  marcaid?: number;
  stock?: FiltroStock;
  estado?: FiltroEstado;
}

/**
 * Query de `GET /productos`. Los dos listados PAGINAN EN SERVIDOR.
 *
 * ⚠ El tamaño de página viaja como `page_size`, en snake_case.
 */
export interface ProductoListQuery extends FiltrosCatalogoProducto {
  page: number;
  page_size: number;
  productoid?: number;
  unidadmedidaid?: number;
  order_by?: ProductoOrderBy;
}

/** Respuesta de `POST /productos/{id}/estado/alternar`: el estado RESULTANTE del toggle. */
export interface ProductoEstado {
  productoid: number;
  estado: boolean;
}

/**
 * Resultado por id de `POST /productos/lote/eliminar`.
 *
 * El lote es parcial por diseño y el motivo cambia según qué retenga al producto: el backend
 * mira ventas, ingresos, salidas y pedidos, y el texto concreto viaja en `mensaje`.
 */
export interface ResultadoLoteProducto {
  productoid: number;
  ok: boolean;
  /** Solo cuando `ok` es `false`: dice cuál de las cuatro tablas lo retiene. */
  mensaje?: string;
  /**
   * Solo cuando `ok` es `false`. Además de `producto_has_relations` y `producto_not_found`,
   * puede llegar `producto_delete_forbidden`: el stored procedure comprueba por su cuenta el
   * proceso `producto-delete`, que es OTRO sistema de permisos, distinto del del menú.
   */
  codigo?: string;
}

/**
 * Cuerpo de `PATCH /productos/{id}/master`.
 *
 * ⚠ Mover un producto CAMBIA SU NOMBRE VISIBLE, porque el listado lo compone con el nombre del
 * master. Hay que RECARGAR la fila, no parchearla suponiendo que solo cambió el `masterid`.
 */
export interface ProductoMasterInput {
  masterid: number;
}
