// Import relativo, no por el alias del propio proyecto: Nx lo exige dentro de una misma lib.
import { masterQueryParams } from './master.api';
import { filtrosCatalogoParams, productoQueryParams } from './producto.api';

/**
 * Tests de las funciones que arman la query de la pantalla de productos.
 *
 * Están aquí y no en el spec de la pantalla a propósito: **decidir qué entra en la URL es del
 * cliente HTTP**, no del componente. La pantalla manda el estado completo de su formulario —con
 * sus ceros y sus cadenas vacías— y son estas funciones las que lo traducen a parámetros.
 * Probarlo a través de un doble del API no probaría nada: el doble recibe la query, no la URL.
 */
describe('productoQueryParams', () => {
  it('manda siempre la paginación, en snake_case', () => {
    // ⚠ El parámetro es `page_size`. No `pageSize`.
    expect(productoQueryParams({ page: 2, page_size: 50 })).toEqual({ page: 2, page_size: 50 });
  });

  it('OMITE los filtros vacíos en vez de mandarlos en cero', () => {
    // Para el backend un id 0 y un `q=` vacío significan «sin filtro», así que mandarlos no
    // cambia el resultado: solo ensucia la URL. `buildHttpParams` únicamente descarta
    // `undefined`/`null`, de modo que el 0 y la cadena vacía hay que quitarlos aquí.
    const params = productoQueryParams({
      page: 1,
      page_size: 25,
      q: '',
      lineaid: 0,
      categoriaid: 0,
      subcategoriaid: 0,
      marcaid: 0,
      productoid: 0,
      unidadmedidaid: 0,
    });
    expect(params).toEqual({ page: 1, page_size: 25 });
  });

  it('recorta el texto de búsqueda', () => {
    expect(productoQueryParams({ page: 1, page_size: 25, q: '  lapicero  ' })).toMatchObject({
      q: 'lapicero',
    });
  });

  it('un texto de solo espacios se OMITE, no se manda en blanco', () => {
    const params = productoQueryParams({ page: 1, page_size: 25, q: '   ' });
    expect(params['q']).toBeUndefined();
  });

  it('pasa los filtros que sí tienen valor', () => {
    const params = productoQueryParams({
      page: 1,
      page_size: 25,
      q: 'azul',
      lineaid: 1,
      categoriaid: 2,
      subcategoriaid: 3,
      marcaid: 4,
      productoid: 5,
      unidadmedidaid: 6,
      stock: 'CONSTOCK',
      estado: 'Y',
      order_by: 'precio_com',
    });
    expect(params).toEqual({
      page: 1,
      page_size: 25,
      q: 'azul',
      lineaid: 1,
      categoriaid: 2,
      subcategoriaid: 3,
      marcaid: 4,
      productoid: 5,
      unidadmedidaid: 6,
      stock: 'CONSTOCK',
      estado: 'Y',
      order_by: 'precio_com',
    });
  });
});

describe('masterQueryParams', () => {
  it('acepta `masterid` y NO `unidadmedidaid`', () => {
    // La unidad de medida es del producto, no del master: el backend de masters ni la acepta.
    const params = masterQueryParams({ page: 1, page_size: 25, masterid: 7, marcaid: 1 });
    expect(params).toEqual({ page: 1, page_size: 25, masterid: 7, marcaid: 1 });
    expect(params['unidadmedidaid']).toBeUndefined();
  });

  it('OMITE los vacíos igual que productos', () => {
    expect(masterQueryParams({ page: 3, page_size: 10, q: '', masterid: 0, marcaid: 0 })).toEqual({
      page: 3,
      page_size: 10,
    });
  });
});

describe('filtrosCatalogoParams', () => {
  it('es el trozo que comparten las dos pestañas', () => {
    // Los ocho filtros de la pantalla menos los propios de cada grilla.
    expect(
      filtrosCatalogoParams({
        q: 'x',
        lineaid: 1,
        categoriaid: 2,
        subcategoriaid: 3,
        marcaid: 4,
        stock: 'SINSTOCK',
        estado: 'N',
      }),
    ).toEqual({
      q: 'x',
      lineaid: 1,
      categoriaid: 2,
      subcategoriaid: 3,
      marcaid: 4,
      stock: 'SINSTOCK',
      estado: 'N',
    });
  });

  it('sin nada puesto, no manda nada', () => {
    expect(filtrosCatalogoParams({})).toEqual({});
  });
});
