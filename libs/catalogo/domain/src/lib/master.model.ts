/**
 * Modelos del dominio Master (`catalogo.master`).
 *
 * ⚠ NO TIENE PANTALLA NI PERMISO PROPIOS: es la SEGUNDA PESTAÑA de `Producto.php`, así que
 * exige el mismo proceso que el producto, `CAT-PRODUCTO`.
 *
 * Un master agrupa los productos que son sus presentaciones (1:N) y es quien lleva la línea, la
 * subcategoría y la marca; el producto lleva la unidad de medida, el color, la talla y los
 * precios.
 *
 * Como el producto, aquí solo está la ADMINISTRACIÓN: listar, filtrar, alternar estado y
 * borrar. El alta y la edición se hacen desde el mismo formulario que las del producto y son
 * otro tramo; por eso no hay `MasterInput`.
 *
 * La fuente de verdad es `phoenix-api/api/openapi.yaml`.
 */

import type { FiltrosCatalogoProducto } from './producto.model';

/** Fila de la grilla de masters, con los nombres de sus catálogos ya resueltos. */
export interface Master {
  masterid: number;
  nombre: string;
  abreviatura: string;

  categoriaid: number;
  categoria_nombre: string;
  subcategoriaid: number;
  subcategoria_nombre: string;
  marcaid: number;
  marca_nombre: string;

  /**
   * Se cambia con `POST /masters/{id}/estado/alternar`.
   *
   * ⚠ Apagar un master NO apaga sus productos: son estados independientes.
   */
  estado: boolean;

  /**
   * DERIVADO: suma del stock de TODOS los productos del master, sobre todos los almacenes.
   * Cadena por lo mismo que los importes del producto — es `numeric` y un `number` de
   * JavaScript lo redondearía.
   */
  stock: string;

  /**
   * DERIVADO y contado EN VIVO.
   *
   * ⚠ No es la columna homónima de `catalogo.master`, que es un contador desnormalizado que
   * mantiene el stored procedure de guardado. El listado no la usa.
   */
  cantidad_productos: number;

  /** NOMBRE del archivo, no una URL. Hoy siempre vacío: no hay dónde servirlas. */
  foto: string;
  cantidad_fotos: number;
}

/** Columnas por las que el stored procedure de masters sabe ordenar. Son menos que en producto. */
export type MasterOrderBy = 'masterid' | 'stock';

/**
 * Query de `GET /masters`. Los mismos filtros de la pestaña de productos MENOS la unidad de
 * medida, que es del producto y no del master.
 */
export interface MasterListQuery extends FiltrosCatalogoProducto {
  page: number;
  page_size: number;
  masterid?: number;
  order_by?: MasterOrderBy;
}

/** Respuesta de `POST /masters/{id}/estado/alternar`: el estado RESULTANTE del toggle. */
export interface MasterEstado {
  masterid: number;
  estado: boolean;
}

/**
 * Resultado por id de `POST /masters/lote/eliminar`.
 *
 * ⚠ El `mensaje` lo pone el backend, no la base: el stored procedure del legacy es de lote y su
 * único texto de fallo es «El sistema no permitió eliminar N registro(s)», que con N=1 no
 * explica nada. El motivo real es siempre el mismo: al master le cuelgan productos.
 */
export interface ResultadoLoteMaster {
  masterid: number;
  ok: boolean;
  /** Solo cuando `ok` es `false`: mensaje listo para mostrar. */
  mensaje?: string;
  /** Solo cuando `ok` es `false`: código estable del error. */
  codigo?: string;
}
