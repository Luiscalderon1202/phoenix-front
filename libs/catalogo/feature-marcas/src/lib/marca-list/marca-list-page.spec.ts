import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { MarcaApi } from '@phoenix/catalogo/data-access';
import type { Marca, MarcaInput, MarcaListQuery, ResultadoLoteMarca } from '@phoenix/catalogo/domain';
import { ConfirmService, NotificationService } from '@phoenix/shared/ui';
import { MarcaListPage } from './marca-list-page';

function marca(over: Partial<Marca> = {}): Marca {
  return {
    marcaid: 1,
    nombre: 'ACME',
    abreviatura: 'ACM',
    count_productos: 0,
    ...over,
  };
}

/**
 * Doble del API que se comporta como el backend de verdad: REGISTRA cada consulta en
 * `consultas`, y FILTRA y TROCEA de veras antes de responder `{data, meta}`.
 *
 * Que filtre y trocee de verdad no es adorno: es lo único que distingue "el filtro llegó al
 * servidor y el servidor devolvió otra página" de un filtro fantasma resuelto en cliente. Con
 * un doble que devolviera siempre las mismas filas, los tests de paginación pasarían aunque
 * la pantalla no mandara nada.
 */
class MarcaApiMock {
  rows: Marca[] = [
    marca(),
    marca({ marcaid: 2, nombre: 'BOSCH', abreviatura: 'BSH', count_productos: 3 }),
  ];

  /** Las queries que ha recibido `list()`, en orden. */
  readonly consultas: MarcaListQuery[] = [];
  readonly creados: MarcaInput[] = [];
  readonly actualizados: { id: number; input: MarcaInput }[] = [];
  readonly eliminados: number[] = [];
  readonly lotes: readonly number[][] = [];

  /** Resultado por id del lote; por defecto todo OK. */
  loteResultado: ResultadoLoteMarca[] | null = null;
  /** Total que dicta el backend, aunque no cuadre con las filas: sirve para probar la meta. */
  totalDeclarado: number | null = null;
  /** Cuando es true, las mutaciones fallan. */
  fallar = false;

  list(query: MarcaListQuery) {
    this.consultas.push(query);
    const q = (query.q ?? '').trim().toLocaleLowerCase('es');
    const filtradas = q
      ? this.rows.filter((m) => m.nombre.toLocaleLowerCase('es').includes(q))
      : this.rows;

    const inicio = (query.page - 1) * query.page_size;
    const data = filtradas.slice(inicio, inicio + query.page_size);
    const total = this.totalDeclarado ?? filtradas.length;

    return of({
      data,
      meta: {
        page: query.page,
        pageSize: query.page_size,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.page_size)),
      },
    });
  }

  create(input: MarcaInput) {
    this.creados.push(input);
    if (this.fallar) return throwError(() => new Error('409'));
    const creada = marca({ marcaid: 99, ...input, count_productos: 0 });
    // El backend ordena el catálogo, así que la nueva NO tiene por qué caer al final: aquí
    // entra la PRIMERA. Es lo que delata si la pantalla recargó o si se limitó a añadirla en
    // local (que la habría dejado al final).
    this.rows = [creada, ...this.rows];
    return of(creada);
  }

  update(id: number, input: MarcaInput) {
    this.actualizados.push({ id, input });
    if (this.fallar) return throwError(() => new Error('409'));
    const previa = this.rows.find((row) => row.marcaid === id);
    const actualizada = marca({ ...previa, marcaid: id, ...input });
    this.rows = this.rows.map((row) => (row.marcaid === id ? actualizada : row));
    return of(actualizada);
  }

  remove(id: number) {
    this.eliminados.push(id);
    if (this.fallar) return throwError(() => new Error('409'));
    this.rows = this.rows.filter((row) => row.marcaid !== id);
    return of(undefined as unknown as void);
  }

  removeLote(ids: readonly number[]) {
    (this.lotes as number[][]).push([...ids]);
    if (this.fallar) return throwError(() => new Error('500'));
    const resultados = this.loteResultado ?? ids.map((marcaid) => ({ marcaid, ok: true }));
    const borradas = new Set(resultados.filter((r) => r.ok).map((r) => r.marcaid));
    this.rows = this.rows.filter((row) => !borradas.has(row.marcaid));
    return of(resultados);
  }
}

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
  success(msg: string) {
    this.exitos.push(msg);
  }
  error(msg: string) {
    this.errores.push(msg);
  }
}

async function setup(api = new MarcaApiMock()) {
  const confirm = new ConfirmServiceMock();
  const notify = new NotificationServiceMock();

  TestBed.configureTestingModule({
    imports: [MarcaListPage],
    providers: [
      // `erp-page-header` monta los breadcrumbs, que leen la ruta activa.
      provideRouter([]),
      { provide: MarcaApi, useValue: api },
      { provide: ConfirmService, useValue: confirm },
      { provide: NotificationService, useValue: notify },
    ],
  });

  const fixture = TestBed.createComponent(MarcaListPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, api, confirm, notify, el: fixture.nativeElement as HTMLElement };
}

/**
 * Deja correr las promesas encadenadas y repinta. Las acciones de esta pantalla encadenan
 * varios `await` (confirmación → petición → notificación → RECARGA), así que un solo
 * `whenStable` se queda corto.
 */
async function asentar(fixture: { whenStable(): Promise<unknown>; detectChanges(): void }) {
  for (let i = 0; i < 4; i++) {
    await fixture.whenStable();
    fixture.detectChanges();
  }
}

/** Acceso al componente sin exponer sus miembros protegidos al resto del test. */
function comp(fixture: { componentInstance: unknown }) {
  return fixture.componentInstance as unknown as Record<string, (...a: never[]) => unknown> & {
    filters: { patchValue(v: unknown): void };
    form: { patchValue(v: unknown): void; getRawValue(): MarcaInput };
    columns: { key: string; header?: string; sortable?: boolean }[];
    rows(): Marca[];
    modalAbierto(): boolean;
    tituloModal(): string;
    seleccionadas(): { marcaid: number }[];
    onExportar(e: { formato: string; detalle: boolean }): void;
    onCerrar(): void;
    onApply(): void;
    onPage(n: number): void;
    onPageSize(n: number): void;
    meta(): { page: number; pageSize: number; total: number; totalPages: number };
  };
}

/** Última query que recibió el backend. */
function ultima(api: MarcaApiMock): MarcaListQuery {
  return api.consultas[api.consultas.length - 1];
}

function celdas(el: HTMLElement, colIndex: number): string[] {
  // +1: la primera celda es el checkbox de selección.
  return Array.from(el.querySelectorAll('tbody tr')).map(
    (tr) =>
      tr
        .querySelectorAll('td')
        [colIndex + 1]?.textContent?.replace(/\s+/g, ' ')
        .trim() ?? '',
  );
}

/** Catálogo grande para los tests de paginación. */
function catalogo(n: number): Marca[] {
  return Array.from({ length: n }, (_, i) =>
    marca({ marcaid: i + 1, nombre: `MARCA ${String(i + 1).padStart(2, '0')}`, abreviatura: `M${i + 1}` }),
  );
}

describe('MarcaListPage', () => {
  // La descarga crea un <a download> y lo pulsa. jsdom no implementa la navegación que eso
  // provoca y escupe un "Not implemented" por consola que no es un fallo, solo ruido.
  beforeEach(() => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    // No se sustituye `URL` entera (Angular la usa): solo estos dos métodos, que jsdom no
    // trae y por eso se asignan en vez de espiarse.
    URL.createObjectURL = vi.fn(() => 'blob:test');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('pinta la página que devuelve el backend', async () => {
    const { el } = await setup();
    expect(el.querySelectorAll('tbody tr').length).toBe(2);
    expect(celdas(el, 0)).toEqual(['ACME', 'BOSCH']);
  });

  it('arranca pidiendo la primera página con el tamaño por defecto y sin filtro', async () => {
    // ⚠ El parámetro es `page_size`, en snake_case. No `pageSize`.
    const { api } = await setup();
    expect(ultima(api)).toMatchObject({ page: 1, page_size: 25, q: '' });
  });

  it('el filtro por nombre VA AL SERVIDOR', async () => {
    // Es la corrección deliberada del legacy: `ajMarca.php:17` mete el texto en `$vInicio`
    // y la llamada real acaba siendo siempre `pamarca_leer(0, 0, '')`. Aquí el texto llega.
    const { fixture, api } = await setup();
    const c = comp(fixture);

    c.filters.patchValue({ q: '  bosch  ' });
    c.onApply();
    await asentar(fixture);

    expect(ultima(api).q).toBe('bosch'); // recortado
    expect(ultima(api).page).toBe(1); // el filtro cambia el universo: se vuelve a la 1
    expect(c.rows().map((row) => row.nombre)).toEqual(['BOSCH']);
  });

  it('el filtro no se resuelve en cliente: si el backend no filtra, la pantalla no filtra', async () => {
    // Blindaje contra un filtro fantasma: `list()` aquí devuelve TODO, ignorando la `q`. Si
    // la pantalla filtrase por su cuenta, se quedaría con una fila y este test caería.
    const api = new MarcaApiMock();
    api.list = ((query: MarcaListQuery) => {
      api.consultas.push(query);
      return of({
        data: api.rows,
        meta: { page: query.page, pageSize: query.page_size, total: api.rows.length, totalPages: 1 },
      });
    }) as MarcaApiMock['list'];

    const { fixture } = await setup(api);
    const c = comp(fixture);

    c.filters.patchValue({ q: 'bosch' });
    c.onApply();
    await asentar(fixture);

    expect(c.rows().length).toBe(2);
  });

  it('"Buscar" vuelve a consultar aunque el filtro no haya cambiado', async () => {
    // Por eso `onApply()` llama a `reload()` explícito: con paginación de servidor, un botón
    // que no re-dispara la consulta es un botón muerto.
    const { fixture, api } = await setup();
    const c = comp(fixture);

    const antes = api.consultas.length;
    c.onApply();
    await asentar(fixture);

    expect(api.consultas.length).toBeGreaterThan(antes);
  });

  it('cambiar de página VA AL SERVIDOR: no se trocea en cliente', async () => {
    const api = new MarcaApiMock();
    api.rows = catalogo(30);
    const { fixture, el } = await setup(api);
    const c = comp(fixture);

    expect(el.querySelectorAll('tbody tr').length).toBe(25);

    c.onPage(2);
    await asentar(fixture);

    expect(ultima(api).page).toBe(2);
    expect(el.querySelectorAll('tbody tr').length).toBe(5);
    expect(celdas(el, 0)[0]).toBe('MARCA 26');
  });

  it('el total del pie sale del `meta` del backend, no de contar las filas cargadas', async () => {
    // `meta.total` lo calcula `pamarca_count(q)`. Contar `rows()` daría 25 en una tabla de
    // 137: el pie diría "Mostrando 1–25 de 25" y el paginador se quedaría en una página.
    const api = new MarcaApiMock();
    api.rows = catalogo(30);
    api.totalDeclarado = 137;
    const { fixture } = await setup(api);
    const c = comp(fixture);

    expect(c.rows().length).toBe(25);
    expect(c.meta()).toMatchObject({ page: 1, pageSize: 25, total: 137, totalPages: 6 });
  });

  it('`page` y `pageSize` de la meta salen de las señales locales, no de la respuesta', async () => {
    // Así el pie no parpadea mientras llega la página nueva.
    const api = new MarcaApiMock();
    api.rows = catalogo(60);
    const { fixture } = await setup(api);
    const c = comp(fixture);

    c.onPage(3);
    expect(c.meta().page).toBe(3); // sin esperar a la respuesta
    await asentar(fixture);
    expect(c.meta()).toMatchObject({ page: 3, pageSize: 25, total: 60 });
  });

  it('cambiar el tamaño de página vuelve a la primera y lo consulta', async () => {
    const api = new MarcaApiMock();
    api.rows = catalogo(30);
    const { fixture } = await setup(api);
    const c = comp(fixture);

    c.onPage(2);
    await asentar(fixture);
    c.onPageSize(10);
    await asentar(fixture);

    expect(ultima(api)).toMatchObject({ page: 1, page_size: 10 });
    expect(c.meta()).toMatchObject({ page: 1, pageSize: 10, totalPages: 3 });
  });

  it('ninguna columna es ordenable', async () => {
    // El ordenamiento del `erp-data-grid` es de CLIENTE: con paginación de servidor solo
    // ordenaría la página en curso y aparentaría ordenar el catálogo entero.
    const { fixture, el } = await setup();
    const c = comp(fixture);

    expect(c.columns.map((col) => col.key)).toEqual(['nombre', 'abreviatura', 'count_productos']);
    expect(c.columns.some((col) => col.sortable)).toBe(false);
    expect(el.querySelectorAll('thead .sort').length).toBe(0);
  });

  it('la tabla no tiene columna de estado ni de orden', async () => {
    // `catalogo.marca` son tres columnas: marcaid, nombre y abreviatura.
    const { fixture, el } = await setup();
    expect(comp(fixture).columns.some((col) => col.key === 'estado' || col.key === 'orden')).toBe(false);
    expect(el.querySelector('thead .col-reorder')).toBeNull();
  });

  it('el alta manda SOLO los dos campos del formulario', async () => {
    // `count_productos` es derivado y de solo lectura: no viaja en el cuerpo.
    const { fixture, api, notify } = await setup();
    const c = comp(fixture);

    c.onNuevo();
    c.form.patchValue({ nombre: 'SONY', abreviatura: 'SNY' });
    c.onGuardar();
    await asentar(fixture);

    expect(api.creados).toEqual([{ nombre: 'SONY', abreviatura: 'SNY' }]);
    expect(c.modalAbierto()).toBe(false);
    expect(notify.exitos.length).toBe(1);
  });

  it('el formulario no ofrece ni estado, ni orden, ni el conteo de productos', async () => {
    const { fixture, el } = await setup();
    const c = comp(fixture);

    c.onNuevo();
    fixture.detectChanges();

    expect(c.form.getRawValue()).toEqual({ nombre: '', abreviatura: '' });
    expect(el.querySelector('erp-modal [formControlName="estado"]')).toBeNull();
    expect(el.querySelector('erp-modal [formControlName="count_productos"]')).toBeNull();
  });

  it('no envía nada si falta el nombre', async () => {
    const { fixture, api } = await setup();
    const c = comp(fixture);

    c.onNuevo();
    c.form.patchValue({ nombre: '' });
    c.onGuardar();
    await asentar(fixture);

    expect(api.creados).toEqual([]);
    expect(c.modalAbierto()).toBe(true);
  });

  it('deja el modal abierto con lo escrito si el guardado falla', async () => {
    // 409 por nombre duplicado: hay que poder corregirlo sin volver a teclearlo todo.
    const api = new MarcaApiMock();
    api.fallar = true;
    const { fixture } = await setup(api);
    const c = comp(fixture);

    c.onNuevo();
    c.form.patchValue({ nombre: 'ACME', abreviatura: 'ACM' });
    c.onGuardar();
    await asentar(fixture);

    expect(c.modalAbierto()).toBe(true);
    expect(c.form.getRawValue()).toEqual({ nombre: 'ACME', abreviatura: 'ACM' });
  });

  it('tras crear se RECARGA del servidor en vez de añadir la fila en local', async () => {
    // El backend ordena el catálogo y `meta.total` lo cuenta él: añadir la fila en local la
    // dejaría al final de una página que ya no cuadra con el pie. El doble mete la nueva la
    // PRIMERA, así que verla en la posición 0 solo puede venir de una recarga.
    const { fixture, api } = await setup();
    const c = comp(fixture);
    const antes = api.consultas.length;

    c.onNuevo();
    c.form.patchValue({ nombre: 'ZONA', abreviatura: 'ZN' });
    c.onGuardar();
    await asentar(fixture);

    expect(api.consultas.length).toBeGreaterThan(antes);
    expect(c.rows().map((row) => row.nombre)).toEqual(['ZONA', 'ACME', 'BOSCH']);
    expect(c.meta().total).toBe(3);
  });

  it('editar precarga los dos campos y manda un PUT', async () => {
    const { fixture, api } = await setup();
    const c = comp(fixture);

    c.onEditar(marca({ marcaid: 2, nombre: 'BOSCH', abreviatura: 'BSH' }) as never);
    expect(c.tituloModal()).toBe('Editar marca');
    expect(c.form.getRawValue()).toEqual({ nombre: 'BOSCH', abreviatura: 'BSH' });

    c.form.patchValue({ nombre: 'BOSCH EDITADA' });
    c.onGuardar();
    await asentar(fixture);

    expect(api.actualizados).toEqual([
      { id: 2, input: { nombre: 'BOSCH EDITADA', abreviatura: 'BSH' } },
    ]);
    expect(api.creados).toEqual([]);
    expect(c.rows().map((row) => row.nombre)).toEqual(['ACME', 'BOSCH EDITADA']);
  });

  it('eliminar pide confirmación antes de llamar al backend', async () => {
    const { fixture, api, confirm } = await setup();
    const c = comp(fixture);
    confirm.respuesta = false;

    c.onEliminar(marca() as never);
    await asentar(fixture);

    expect(confirm.preguntas.length).toBe(1);
    expect(api.eliminados).toEqual([]);
  });

  it('tras eliminar se RECARGA del servidor', async () => {
    // Igual que en el alta: con paginación de servidor, quitar la fila en local descuadra el
    // total del pie y no sube la fila que venía de la página siguiente.
    const { fixture, api } = await setup();
    const c = comp(fixture);
    const antes = api.consultas.length;

    c.onEliminar(marca() as never);
    await asentar(fixture);

    expect(api.eliminados).toEqual([1]);
    expect(api.consultas.length).toBeGreaterThan(antes);
    expect(c.rows().map((row) => row.marcaid)).toEqual([2]);
    expect(c.meta().total).toBe(1);
  });

  it('la grilla ofrece checkbox de selección por fila', async () => {
    const { el } = await setup();
    expect(el.querySelectorAll('tbody input[type="checkbox"]').length).toBe(2);
  });

  it('el borrado en lote va en UNA petición, no N deletes', async () => {
    const { fixture, api, el } = await setup();
    const c = comp(fixture);

    // Checkbox de cabecera: selecciona las dos filas visibles.
    (el.querySelector('thead .col-select input') as HTMLInputElement).click();
    fixture.detectChanges();
    expect(c.seleccionadas().length).toBe(2);

    (el.querySelector('[filterActions] .btn--danger') as HTMLButtonElement).click();
    await asentar(fixture);

    expect(api.lotes).toEqual([[1, 2]]);
    expect(api.eliminados).toEqual([]); // no cae al endpoint de uno en uno
    expect(c.rows()).toEqual([]);
    expect(c.seleccionadas()).toEqual([]);
  });

  it('el lote es parcial: conserva las que fallaron y avisa con el motivo del backend', async () => {
    const api = new MarcaApiMock();
    api.loteResultado = [
      { marcaid: 1, ok: true },
      { marcaid: 2, ok: false, codigo: 'marca_has_relations', mensaje: 'Tiene productos registrados.' },
    ];
    const { fixture, notify } = await setup(api);
    const c = comp(fixture);

    c.onSeleccion([{ marcaid: 1 }, { marcaid: 2 }] as never);
    c.onEliminarSeleccionadas();
    await asentar(fixture);

    expect(c.rows().map((row) => row.marcaid)).toEqual([2]);
    expect(notify.exitos).toEqual(['Se eliminaron 1 registro(s).']);
    expect(notify.errores.length).toBe(1);
    expect(notify.errores[0]).toContain('Tiene productos registrados.');
  });

  it('sin productos, la celda queda vacía', async () => {
    // Un cero repetido 25 veces es ruido; el legacy también deja la celda en blanco.
    const api = new MarcaApiMock();
    api.rows = [marca({ count_productos: 0 })];
    const { el } = await setup(api);

    expect(celdas(el, 2)).toEqual(['—']);
    expect(el.querySelector('tbody .badge--conteo')).toBeNull();
  });

  it('con un solo producto lo dice con palabras, sin badge', async () => {
    const api = new MarcaApiMock();
    api.rows = [marca({ count_productos: 1 })];
    const { el } = await setup(api);

    expect(celdas(el, 2)).toEqual(['Solo un producto']);
    expect(el.querySelector('tbody .badge--conteo')).toBeNull();
  });

  it('con varios productos pinta el número en un badge', async () => {
    const api = new MarcaApiMock();
    api.rows = [marca({ count_productos: 12 })];
    const { el } = await setup(api);

    expect(celdas(el, 2)).toEqual(['12 productos']);
    expect(el.querySelector('tbody .badge--conteo')?.textContent?.trim()).toBe('12');
  });

  it('lleva un único menú —Exportar— y el botón de cerrar en la cabecera', async () => {
    // Este recurso no tiene reporte PDF, así que tampoco menú Imprimir ni visor.
    const { el } = await setup();
    expect(el.querySelectorAll('erp-export-menu').length).toBe(1);
    expect(el.querySelector('.btn-cerrar')).not.toBeNull();
    expect(el.querySelector('erp-file-viewer')).toBeNull();
    expect(el.querySelector('erp-print-header')).toBeNull();
  });

  it('exporta la página cargada sin pedir nada al backend', async () => {
    // Solo hay una página en memoria: bajar el resto costaría N peticiones.
    const anchor = vi.spyOn(HTMLAnchorElement.prototype, 'click');
    const api = new MarcaApiMock();
    api.rows = catalogo(30);
    const { fixture } = await setup(api);
    const c = comp(fixture);
    const antes = api.consultas.length;

    c.onExportar({ formato: 'csv', detalle: false });

    expect(anchor).toHaveBeenCalled();
    expect(api.consultas.length).toBe(antes);
    expect(c.rows().length).toBe(25);
  });

  it('sin historia previa, cerrar vuelve a /inicio', async () => {
    // ⚠ NO a /mantenimiento/tablas-basicas: Marcas no cuelga de ese hub, es una opción de
    // menú propia con su propio permiso.
    const { fixture } = await setup();
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    comp(fixture).onCerrar();

    expect(navigate).toHaveBeenCalledWith(['/inicio']);
  });

  it('muestra el pie con la paginación', async () => {
    const { el } = await setup();
    expect(el.querySelector('erp-grid-footer')).not.toBeNull();
  });
});
