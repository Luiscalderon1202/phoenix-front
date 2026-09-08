import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import {
  CategoriaApi,
  LineaApi,
  MarcaApi,
  MasterApi,
  ProductoApi,
  SubcategoriaApi,
  UnidadMedidaApi,
} from '@phoenix/catalogo/data-access';
import type {
  Master,
  MasterListQuery,
  Producto,
  ProductoListQuery,
  ResultadoLoteProducto,
} from '@phoenix/catalogo/domain';
import { ConfirmService, NotificationService } from '@phoenix/shared/ui';
import { ProductoListPage } from './producto-list-page';

function producto(over: Partial<Producto> = {}): Producto {
  return {
    productoid: 1,
    masterid: 10,
    nombre: 'LAPICERO, AZUL',
    tipotributo: 0,
    tipotributo_nombre: 'GRA',
    categoriaid: 1,
    categoria_nombre: 'PAPELERIA',
    subcategoriaid: 1,
    subcategoria_nombre: 'ESCRITURA',
    marcaid: 1,
    marca_nombre: 'ACME',
    precio_com: '12.500000',
    precio_va: '18.000000',
    precio_vb: '17.000000',
    precio_vc: '0',
    precio_vd: '0',
    flete: '0',
    peso: '0',
    stock: '5.00',
    fraccion_cantidad: '0',
    fraccion_productoid: 0,
    stock_min: 0,
    stock_max: 0,
    codigo_barras: '',
    observacion: '',
    oferta: false,
    servicio: false,
    icbp: false,
    moneda: 'PEN',
    moneda_simbolo: 'S/',
    estado: true,
    foto: '',
    cantidad_fotos: 0,
    ...over,
  };
}

function master(over: Partial<Master> = {}): Master {
  return {
    masterid: 10,
    nombre: 'LAPICERO',
    abreviatura: 'lap',
    categoriaid: 1,
    categoria_nombre: 'PAPELERIA',
    subcategoriaid: 1,
    subcategoria_nombre: 'ESCRITURA',
    marcaid: 1,
    marca_nombre: 'ACME',
    estado: true,
    stock: '5.00',
    cantidad_productos: 2,
    foto: '',
    cantidad_fotos: 0,
    ...over,
  };
}

/**
 * Doble del API de productos que REGISTRA cada query y trocea de veras.
 *
 * Que pagine de verdad es lo único que distingue "la página la trajo el servidor" de un
 * troceado de cliente disfrazado.
 */
class ProductoApiMock {
  rows: Producto[] = [producto(), producto({ productoid: 2, nombre: 'LAPICERO, ROJO' })];
  readonly consultas: ProductoListQuery[] = [];
  readonly eliminados: number[] = [];
  readonly lotes: readonly number[][] = [];
  readonly alternados: number[] = [];
  readonly movidos: { id: number; masterid: number }[] = [];

  loteResultado: ResultadoLoteProducto[] | null = null;
  estadoResultante = false;
  fallar = false;

  list(query: ProductoListQuery) {
    this.consultas.push({ ...query });
    const inicio = (query.page - 1) * query.page_size;
    const data = this.rows.slice(inicio, inicio + query.page_size);
    return of({
      data,
      meta: {
        page: query.page,
        pageSize: query.page_size,
        total: this.rows.length,
        totalPages: Math.max(1, Math.ceil(this.rows.length / query.page_size)),
      },
    });
  }

  remove(id: number) {
    this.eliminados.push(id);
    if (this.fallar) return throwError(() => new Error('409'));
    this.rows = this.rows.filter((r) => r.productoid !== id);
    return of(undefined as unknown as void);
  }

  removeLote(ids: readonly number[]) {
    (this.lotes as number[][]).push([...ids]);
    if (this.fallar) return throwError(() => new Error('500'));
    const res = this.loteResultado ?? ids.map((productoid) => ({ productoid, ok: true }));
    const borrados = new Set(res.filter((r) => r.ok).map((r) => r.productoid));
    this.rows = this.rows.filter((r) => !borrados.has(r.productoid));
    return of(res);
  }

  alternarEstado(id: number) {
    this.alternados.push(id);
    if (this.fallar) return throwError(() => new Error('500'));
    return of({ productoid: id, estado: this.estadoResultante });
  }

  cambiarMaster(id: number, masterid: number) {
    this.movidos.push({ id, masterid });
    if (this.fallar) return throwError(() => new Error('422'));
    // El backend recompone el nombre con el del master destino.
    this.rows = this.rows.map((r) =>
      r.productoid === id ? { ...r, masterid, nombre: `MASTER ${masterid}, AZUL` } : r,
    );
    return of(undefined as unknown as void);
  }
}

class MasterApiMock {
  rows: Master[] = [master(), master({ masterid: 11, nombre: 'PLUMON', abreviatura: 'plu' })];
  readonly consultas: MasterListQuery[] = [];
  readonly eliminados: number[] = [];
  readonly lotes: readonly number[][] = [];
  readonly alternados: number[] = [];
  estadoResultante = false;
  fallar = false;

  list(query: MasterListQuery) {
    this.consultas.push({ ...query });
    const q = (query.q ?? '').trim().toLowerCase();
    const filtradas = q ? this.rows.filter((m) => m.nombre.toLowerCase().includes(q)) : this.rows;
    const inicio = (query.page - 1) * query.page_size;
    return of({
      data: filtradas.slice(inicio, inicio + query.page_size),
      meta: {
        page: query.page,
        pageSize: query.page_size,
        total: filtradas.length,
        totalPages: Math.max(1, Math.ceil(filtradas.length / query.page_size)),
      },
    });
  }

  remove(id: number) {
    this.eliminados.push(id);
    if (this.fallar) return throwError(() => new Error('409'));
    this.rows = this.rows.filter((m) => m.masterid !== id);
    return of(undefined as unknown as void);
  }

  removeLote(ids: readonly number[]) {
    (this.lotes as number[][]).push([...ids]);
    return of(ids.map((masterid) => ({ masterid, ok: true })));
  }

  alternarEstado(id: number) {
    this.alternados.push(id);
    if (this.fallar) return throwError(() => new Error('500'));
    return of({ masterid: id, estado: this.estadoResultante });
  }
}

class SubcategoriaApiMock {
  /** Los filtros con los que se ha pedido la lista: es lo que prueba el encadenado. */
  readonly consultas: { categoriaid?: number }[] = [];
  list(f: { categoriaid?: number } = {}) {
    this.consultas.push({ ...f });
    const todas = [
      { subcategoriaid: 1, categoriaid: 1, nombre: 'ESCRITURA', abreviatura: 'ESC' },
      { subcategoriaid: 2, categoriaid: 2, nombre: 'PINTURA', abreviatura: 'PIN' },
    ];
    return of(f.categoriaid ? todas.filter((s) => s.categoriaid === f.categoriaid) : todas);
  }
}

const categoriaApiMock = {
  list: () => of([{ categoriaid: 1, nombre: 'PAPELERIA', abreviatura: 'PAP' }]),
};
const marcaApiMock = {
  list: () =>
    of({
      data: [{ marcaid: 1, nombre: 'ACME', abreviatura: 'ACM', count_productos: 0 }],
      meta: { page: 1, pageSize: 200, total: 1, totalPages: 1 },
    }),
};
const lineaApiMock = {
  list: () =>
    of({
      data: [
        {
          lineaid: 1,
          nombre: 'MERCADERIA',
          abreviatura: 'ME',
          codigo_contable: '',
          orden: 1,
          estado: true,
        },
      ],
      meta: { page: 1, pageSize: 200, total: 1, totalPages: 1 },
    }),
};
const unidadMedidaApiMock = {
  list: () =>
    of([
      {
        unidadmedidaid: 1,
        nombre: 'UNIDAD',
        abreviatura: 'UND',
        codigo_contable: '01',
        codigo_internacional: 'NIU',
        estado: true,
        orden: 1,
      },
    ]),
};

class ConfirmServiceMock {
  respuesta = true;
  readonly preguntas: unknown[] = [];
  ask(opts: unknown) {
    this.preguntas.push(opts);
    return Promise.resolve(this.respuesta);
  }
}

class NotificationServiceMock {
  readonly exitos: string[] = [];
  readonly errores: string[] = [];
  success(m: string) {
    this.exitos.push(m);
  }
  error(m: string) {
    this.errores.push(m);
  }
}

async function setup(
  productoApi = new ProductoApiMock(),
  masterApi = new MasterApiMock(),
  subcategoriaApi = new SubcategoriaApiMock(),
) {
  const confirm = new ConfirmServiceMock();
  const notify = new NotificationServiceMock();

  TestBed.configureTestingModule({
    imports: [ProductoListPage],
    providers: [
      provideRouter([]),
      { provide: ProductoApi, useValue: productoApi },
      { provide: MasterApi, useValue: masterApi },
      { provide: CategoriaApi, useValue: categoriaApiMock },
      { provide: SubcategoriaApi, useValue: subcategoriaApi },
      { provide: MarcaApi, useValue: marcaApiMock },
      { provide: LineaApi, useValue: lineaApiMock },
      { provide: UnidadMedidaApi, useValue: unidadMedidaApiMock },
      { provide: ConfirmService, useValue: confirm },
      { provide: NotificationService, useValue: notify },
    ],
  });

  const fixture = TestBed.createComponent(ProductoListPage);
  fixture.detectChanges();
  await asentar(fixture);
  return {
    fixture,
    productoApi,
    masterApi,
    subcategoriaApi,
    confirm,
    notify,
    el: fixture.nativeElement as HTMLElement,
  };
}

/** Deja correr las promesas encadenadas y repinta. */
async function asentar(fixture: { whenStable(): Promise<unknown>; detectChanges(): void }) {
  for (let i = 0; i < 5; i++) {
    await fixture.whenStable();
    fixture.detectChanges();
  }
}

function comp(fixture: { componentInstance: unknown }) {
  return fixture.componentInstance as unknown as Record<string, (...a: never[]) => unknown> & {
    filters: { patchValue(v: unknown): void; getRawValue(): Record<string, unknown> };
    pestana(): string;
    rowsProductos(): Producto[];
    rowsMasters(): Master[];
    metaProductos(): { page: number; total: number; totalPages: number };
    metaMasters(): { page: number; total: number; totalPages: number };
    seleccionProductos(): { productoid: number }[];
    columnasProductos: { key: string; sortable?: boolean }[];
    columnasMasters: { key: string }[];
    moverAbierto(): boolean;
    masterDestino(): number;
    candidatosMaster(): Master[];
    opcionesSubcategoria(): { subcategoriaid: number }[];
    onExportar(e: { formato: string; detalle: boolean }): void;
  };
}

function ultima<T>(xs: T[]): T {
  return xs[xs.length - 1];
}

describe('ProductoListPage', () => {
  beforeEach(() => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    URL.createObjectURL = vi.fn(() => 'blob:test');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('arranca en la pestaña de productos y pide la primera página', async () => {
    const { productoApi, el } = await setup();
    expect(ultima(productoApi.consultas)).toMatchObject({ page: 1, page_size: 25 });
    expect(el.querySelectorAll('tbody tr').length).toBe(2);
  });

  it('la pestaña que no se ve NO consulta', async () => {
    // Los dos `resource` devuelven `undefined` en sus params cuando su pestaña está oculta.
    const { masterApi } = await setup();
    expect(masterApi.consultas.length).toBe(0);
  });

  it('cambiar de pestaña carga la otra grilla', async () => {
    const { fixture, masterApi } = await setup();
    const c = comp(fixture);

    c.onPestana('masters' as never);
    await asentar(fixture);

    expect(c.pestana()).toBe('masters');
    expect(masterApi.consultas.length).toBe(1);
    expect(c.rowsMasters().length).toBe(2);
  });

  it('cada pestaña lleva SU página: volver no pierde el sitio', async () => {
    // Es lo que hace el legacy con `txtProPage` y `txtMasPage`.
    const productoApi = new ProductoApiMock();
    productoApi.rows = Array.from({ length: 60 }, (_, i) =>
      producto({ productoid: i + 1, nombre: `PROD ${i + 1}` }),
    );
    const { fixture } = await setup(productoApi);
    const c = comp(fixture);

    c.onPageProductos(3);
    await asentar(fixture);
    expect(c.metaProductos().page).toBe(3);

    c.onPestana('masters' as never);
    await asentar(fixture);
    expect(c.metaMasters().page).toBe(1); // la otra arranca en su propia página

    c.onPestana('productos' as never);
    await asentar(fixture);
    expect(c.metaProductos().page).toBe(3); // y al volver, el sitio sigue ahí
  });

  it('los ocho filtros VAN AL SERVIDOR', async () => {
    const { fixture, productoApi } = await setup();
    const c = comp(fixture);

    c.filters.patchValue({
      q: '  lapicero  ',
      lineaid: 1,
      categoriaid: 1,
      subcategoriaid: 1,
      marcaid: 1,
      unidadmedidaid: 1,
      stock: 'CONSTOCK',
      estado: 'Y',
    });
    c.onApply();
    await asentar(fixture);

    expect(ultima(productoApi.consultas)).toMatchObject({
      q: 'lapicero',
      lineaid: 1,
      categoriaid: 1,
      subcategoriaid: 1,
      marcaid: 1,
      unidadmedidaid: 1,
      stock: 'CONSTOCK',
      estado: 'Y',
      page: 1,
    });
  });

  it('el filtro de estado va al SERVIDOR, no se resuelve en cliente', async () => {
    // Al revés que en grupos, colores y tallas: aquí los stored procedures sí filtran por estado.
    const { fixture, productoApi } = await setup();
    const c = comp(fixture);

    c.filters.patchValue({ estado: 'N' });
    c.onApply();
    await asentar(fixture);

    expect(ultima(productoApi.consultas).estado).toBe('N');
  });

  it('un filtro vacío llega como cero o cadena vacía, y el cliente HTTP lo omite', async () => {
    // La pantalla manda el estado completo del formulario; quien decide qué entra en la URL es
    // `productoQueryParams`, y eso se prueba en el spec del cliente HTTP.
    const { productoApi } = await setup();
    const q = ultima(productoApi.consultas);
    expect(q.marcaid).toBe(0);
    expect(q.q).toBe('');
    expect(q.estado).toBeUndefined(); // este sí: el select vacío no es un estado válido
  });

  it('la subcategoría está ENCADENADA a la categoría', async () => {
    const { fixture, subcategoriaApi } = await setup();
    const c = comp(fixture);

    // Al arrancar se piden todas.
    expect(subcategoriaApi.consultas[0]).toEqual({});

    // Orden realista: primero se elige una subcategoría, y DESPUÉS se cambia la categoría.
    c.filters.patchValue({ subcategoriaid: 9 });
    c.filters.patchValue({ categoriaid: 2 });
    await asentar(fixture);

    // Se vuelven a pedir acotadas a esa categoría...
    expect(ultima(subcategoriaApi.consultas)).toEqual({ categoriaid: 2 });
    expect(c.opcionesSubcategoria().map((s) => s.subcategoriaid)).toEqual([2]);
    // ...y la subcategoría elegida se limpia, porque ya no pertenece a la nueva.
    expect(c.filters.getRawValue()['subcategoriaid']).toBe(0);
  });

  it('cambiar el filtro vuelve a la primera página de las DOS pestañas', async () => {
    const productoApi = new ProductoApiMock();
    productoApi.rows = Array.from({ length: 60 }, (_, i) => producto({ productoid: i + 1 }));
    const { fixture } = await setup(productoApi);
    const c = comp(fixture);

    c.onPageProductos(3);
    await asentar(fixture);

    c.filters.patchValue({ q: 'algo' });
    c.onApply();
    await asentar(fixture);

    expect(c.metaProductos().page).toBe(1);
    expect(c.metaMasters().page).toBe(1);
  });

  it('el total del pie sale del meta del backend', async () => {
    const productoApi = new ProductoApiMock();
    productoApi.rows = Array.from({ length: 60 }, (_, i) => producto({ productoid: i + 1 }));
    const { fixture } = await setup(productoApi);
    const c = comp(fixture);

    expect(c.rowsProductos().length).toBe(25);
    expect(c.metaProductos()).toMatchObject({ page: 1, total: 60, totalPages: 3 });
  });

  it('ninguna columna es ordenable', async () => {
    // El ordenamiento del grid es de CLIENTE y solo ordenaría la página en curso.
    const { fixture, el } = await setup();
    expect(comp(fixture).columnasProductos.some((c) => c.sortable)).toBe(false);
    expect(el.querySelectorAll('thead .sort').length).toBe(0);
  });

  it('alterna el estado del producto y se queda con lo que dice el backend', async () => {
    const productoApi = new ProductoApiMock();
    productoApi.estadoResultante = false;
    const { fixture, productoApi: api } = await setup(productoApi);
    const c = comp(fixture);

    c.onToggleProducto(producto() as never);
    await asentar(fixture);

    expect(api.alternados).toEqual([1]);
    expect(c.rowsProductos()[0].estado).toBe(false);
  });

  it('revierte el estado si el backend falla', async () => {
    const productoApi = new ProductoApiMock();
    productoApi.fallar = true;
    const { fixture } = await setup(productoApi);
    const c = comp(fixture);

    c.onToggleProducto(producto() as never);
    await asentar(fixture);

    expect(c.rowsProductos()[0].estado).toBe(true);
  });

  it('eliminar pide confirmación y luego RECARGA', async () => {
    const { fixture, productoApi, confirm } = await setup();
    const c = comp(fixture);
    confirm.respuesta = false;

    c.onEliminarProducto(producto() as never);
    await asentar(fixture);
    expect(productoApi.eliminados).toEqual([]);

    confirm.respuesta = true;
    const antes = productoApi.consultas.length;
    c.onEliminarProducto(producto() as never);
    await asentar(fixture);

    expect(productoApi.eliminados).toEqual([1]);
    // Con paginación de servidor hay que recargar: el total lo cuenta el backend.
    expect(productoApi.consultas.length).toBeGreaterThan(antes);
    expect(c.metaProductos().total).toBe(1);
  });

  it('el borrado en lote va en UNA petición y es parcial', async () => {
    const productoApi = new ProductoApiMock();
    productoApi.loteResultado = [
      { productoid: 1, ok: true },
      {
        productoid: 2,
        ok: false,
        codigo: 'producto_has_relations',
        mensaje: 'Tiene ventas registradas.',
      },
    ];
    const { fixture, notify } = await setup(productoApi);
    const c = comp(fixture);

    c.onSeleccionProductos([{ productoid: 1 }, { productoid: 2 }] as never);
    c.onEliminarProductosSeleccionados();
    await asentar(fixture);

    expect(productoApi.lotes).toEqual([[1, 2]]);
    expect(productoApi.eliminados).toEqual([]); // no cae al endpoint de uno en uno
    expect(notify.exitos).toEqual(['Se eliminaron 1 producto(s).']);
    expect(notify.errores[0]).toContain('Tiene ventas registradas.');
  });

  it('el diálogo de mover excluye el master que el producto ya tiene', async () => {
    // El backend lo rechazaría con 422 `producto_master_unchanged`; no se ofrece siquiera.
    const { fixture } = await setup();
    const c = comp(fixture);

    c.onAbrirMover(producto({ masterid: 10 }) as never);
    await asentar(fixture);

    expect(c.moverAbierto()).toBe(true);
    expect(c.candidatosMaster().map((m) => m.masterid)).toEqual([11]);
  });

  it('mover de master RECARGA la grilla, porque cambia el nombre visible', async () => {
    const { fixture, productoApi } = await setup();
    const c = comp(fixture);

    c.onAbrirMover(producto({ productoid: 1, masterid: 10 }) as never);
    await asentar(fixture);
    c.onElegirMaster('11' as never);
    c.onConfirmarMover();
    await asentar(fixture);

    expect(productoApi.movidos).toEqual([{ id: 1, masterid: 11 }]);
    expect(c.moverAbierto()).toBe(false);
    // El doble recompone el nombre como hace el backend; verlo aquí solo puede venir de recargar.
    expect(c.rowsProductos()[0].nombre).toBe('MASTER 11, AZUL');
  });

  it('no mueve nada si no se eligió master', async () => {
    const { fixture, productoApi } = await setup();
    const c = comp(fixture);

    c.onAbrirMover(producto() as never);
    await asentar(fixture);
    c.onConfirmarMover();
    await asentar(fixture);

    expect(productoApi.movidos).toEqual([]);
    expect(c.moverAbierto()).toBe(true);
  });

  it('la pantalla NO ofrece crear ni editar', async () => {
    // El editor es otro tramo: un botón «Nuevo» que no lleva a ninguna parte sería peor que
    // no tenerlo.
    const { el } = await setup();
    const textos = [...el.querySelectorAll('[filterActions] button')].map((b) =>
      (b.textContent ?? '').trim().toLowerCase(),
    );
    expect(textos.some((t) => t.includes('nuevo'))).toBe(false);
    expect(el.querySelector('erp-modal [formControlName="nombre"]')).toBeNull();
  });

  it('alterna y elimina también en la pestaña de masters', async () => {
    const masterApi = new MasterApiMock();
    masterApi.estadoResultante = false;
    const { fixture } = await setup(new ProductoApiMock(), masterApi);
    const c = comp(fixture);

    c.onPestana('masters' as never);
    await asentar(fixture);

    c.onToggleMaster(master() as never);
    await asentar(fixture);
    expect(masterApi.alternados).toEqual([10]);
    expect(c.rowsMasters()[0].estado).toBe(false);

    c.onEliminarMaster(master({ masterid: 11 }) as never);
    await asentar(fixture);
    expect(masterApi.eliminados).toEqual([11]);
  });

  it('la grilla de masters no ofrece mover de master', async () => {
    // Mover es una operación DEL producto: el master no tiene a dónde ir.
    const { fixture, el } = await setup();
    const c = comp(fixture);

    c.onPestana('masters' as never);
    await asentar(fixture);

    const titulos = [...el.querySelectorAll('tbody .grid-action')].map((b) =>
      b.getAttribute('title'),
    );
    expect(titulos).not.toContain('Mover a otro master');
    expect(titulos).toContain('Eliminar');
  });

  it('el filtro de unidad de medida solo aparece en la pestaña de productos', async () => {
    // Es del producto, no del master: el backend de masters ni lo acepta.
    const { fixture, el } = await setup();
    const c = comp(fixture);

    expect(el.querySelector('[formControlName="unidadmedidaid"]')).not.toBeNull();

    c.onPestana('masters' as never);
    await asentar(fixture);
    expect(el.querySelector('[formControlName="unidadmedidaid"]')).toBeNull();
  });

  it('exporta la página que se ve, sin pedir nada al backend', async () => {
    const anchor = vi.spyOn(HTMLAnchorElement.prototype, 'click');
    const { fixture, productoApi } = await setup();
    const c = comp(fixture);
    const antes = productoApi.consultas.length;

    c.onExportar({ formato: 'csv', detalle: false });

    expect(anchor).toHaveBeenCalled();
    expect(productoApi.consultas.length).toBe(antes);
  });

  it('«Limpiar» deja los filtros en blanco y vuelve a consultar', async () => {
    const { fixture, productoApi } = await setup();
    const c = comp(fixture);

    c.filters.patchValue({ q: 'algo', marcaid: 1 });
    c.onApply();
    await asentar(fixture);
    expect(ultima(productoApi.consultas).q).toBe('algo');

    c.onLimpiar();
    await asentar(fixture);
    expect(ultima(productoApi.consultas).q).toBe('');
    expect(ultima(productoApi.consultas).marcaid).toBe(0);
  });

  it('sin historia previa, cerrar vuelve a /inicio', async () => {
    const { fixture } = await setup();
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    comp(fixture).onCerrar();

    expect(navigate).toHaveBeenCalledWith(['/inicio']);
  });
});
