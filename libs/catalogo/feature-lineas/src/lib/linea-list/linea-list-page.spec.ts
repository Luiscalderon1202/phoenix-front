import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { LineaApi } from '@phoenix/catalogo/data-access';
import type {
  Linea,
  LineaInput,
  LineaListQuery,
  ResultadoLoteLinea,
} from '@phoenix/catalogo/domain';
import { ConfirmService, NotificationService } from '@phoenix/shared/ui';
import { LineaListPage } from './linea-list-page';

function linea(over: Partial<Linea> = {}): Linea {
  return {
    lineaid: 1,
    nombre: 'MERCADERIA',
    abreviatura: 'ME',
    codigo_contable: '',
    orden: 1,
    estado: true,
    ...over,
  };
}

/**
 * Doble del API que se comporta como el backend de verdad: REGISTRA cada consulta en
 * `consultas`, y FILTRA y TROCEA de veras antes de responder `{data, meta}`.
 *
 * Que filtre y trocee de verdad no es adorno: es lo único que distingue "el filtro llegó al
 * servidor y el servidor devolvió otra página" de un filtro fantasma resuelto en cliente.
 *
 * ⚠ `list()` NO filtra por estado, igual que `phoenix.palinea_leer`: devuelve activas e
 * inactivas. Es lo que justifica que la pantalla no tenga selector de estado.
 */
class LineaApiMock {
  rows: Linea[] = [
    linea(),
    linea({ lineaid: 2, nombre: 'SERVICIO', abreviatura: 'SERV', codigo_contable: '0012', orden: 2 }),
  ];

  /** Las queries que ha recibido `list()`, en orden. */
  readonly consultas: LineaListQuery[] = [];
  readonly creadas: LineaInput[] = [];
  readonly actualizadas: { id: number; input: LineaInput }[] = [];
  readonly eliminadas: number[] = [];
  readonly lotes: readonly number[][] = [];
  readonly alternadas: number[] = [];
  readonly reordenes: { ids: number[]; desde: number }[] = [];

  /** Resultado por id del lote; por defecto todo OK. */
  loteResultado: ResultadoLoteLinea[] | null = null;
  /** Total que dicta el backend, aunque no cuadre con las filas: sirve para probar la meta. */
  totalDeclarado: number | null = null;
  /** Estado que devuelve `alternarEstado` (el contrato manda el RESULTANTE). */
  estadoResultante = false;
  /** Cuando es true, las mutaciones fallan. */
  fallar = false;

  list(query: LineaListQuery) {
    this.consultas.push(query);
    const q = (query.q ?? '').trim().toLocaleLowerCase('es');
    const filtradas = q
      ? this.rows.filter((l) => l.nombre.toLocaleLowerCase('es').includes(q))
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

  create(input: LineaInput) {
    this.creadas.push(input);
    if (this.fallar) return throwError(() => new Error('409'));
    const creada = linea({ lineaid: 99, ...input, orden: this.rows.length + 1 });
    // El backend ordena el catálogo, así que la nueva NO tiene por qué caer al final: aquí entra
    // la PRIMERA. Es lo que delata si la pantalla recargó o si se limitó a añadirla en local.
    this.rows = [creada, ...this.rows];
    return of(creada);
  }

  update(id: number, input: LineaInput) {
    this.actualizadas.push({ id, input });
    if (this.fallar) return throwError(() => new Error('409'));
    const previa = this.rows.find((row) => row.lineaid === id);
    const actualizada = linea({ ...previa, lineaid: id, ...input });
    this.rows = this.rows.map((row) => (row.lineaid === id ? actualizada : row));
    return of(actualizada);
  }

  remove(id: number) {
    this.eliminadas.push(id);
    if (this.fallar) return throwError(() => new Error('409'));
    this.rows = this.rows.filter((row) => row.lineaid !== id);
    return of(undefined as unknown as void);
  }

  removeLote(ids: readonly number[]) {
    (this.lotes as number[][]).push([...ids]);
    if (this.fallar) return throwError(() => new Error('500'));
    const resultados = this.loteResultado ?? ids.map((lineaid) => ({ lineaid, ok: true }));
    const borradas = new Set(resultados.filter((r) => r.ok).map((r) => r.lineaid));
    this.rows = this.rows.filter((row) => !borradas.has(row.lineaid));
    return of(resultados);
  }

  alternarEstado(lineaid: number) {
    this.alternadas.push(lineaid);
    if (this.fallar) return throwError(() => new Error('500'));
    return of({ lineaid, estado: this.estadoResultante });
  }

  reordenar(ids: readonly number[], desde = 1) {
    this.reordenes.push({ ids: [...ids], desde });
    if (this.fallar) return throwError(() => new Error('500'));
    return of(undefined as unknown as void);
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

async function setup(api = new LineaApiMock()) {
  const confirm = new ConfirmServiceMock();
  const notify = new NotificationServiceMock();

  TestBed.configureTestingModule({
    imports: [LineaListPage],
    providers: [
      // `erp-page-header` monta los breadcrumbs, que leen la ruta activa.
      provideRouter([]),
      { provide: LineaApi, useValue: api },
      { provide: ConfirmService, useValue: confirm },
      { provide: NotificationService, useValue: notify },
    ],
  });

  const fixture = TestBed.createComponent(LineaListPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, api, confirm, notify, el: fixture.nativeElement as HTMLElement };
}

/**
 * Deja correr las promesas encadenadas y repinta. Las acciones de esta pantalla encadenan varios
 * `await` (confirmación → petición → notificación → RECARGA), así que un solo `whenStable` se
 * queda corto.
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
    form: { patchValue(v: unknown): void; getRawValue(): LineaInput };
    columns: { key: string; header?: string; sortable?: boolean }[];
    rows(): Linea[];
    modalAbierto(): boolean;
    tituloModal(): string;
    seleccionadas(): { lineaid: number }[];
    filtrando(): boolean;
    onExportar(e: { formato: string; detalle: boolean }): void;
    onCerrar(): void;
    onApply(): void;
    onPage(n: number): void;
    onPageSize(n: number): void;
    meta(): { page: number; pageSize: number; total: number; totalPages: number };
  };
}

/** Última query que recibió el backend. */
function ultima(api: LineaApiMock): LineaListQuery {
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
function catalogo(n: number): Linea[] {
  return Array.from({ length: n }, (_, i) =>
    linea({
      lineaid: i + 1,
      nombre: `LINEA ${String(i + 1).padStart(2, '0')}`,
      abreviatura: `L${i + 1}`,
      orden: i + 1,
    }),
  );
}

describe('LineaListPage', () => {
  // La descarga crea un <a download> y lo pulsa. jsdom no implementa la navegación que eso
  // provoca y escupe un "Not implemented" por consola que no es un fallo, solo ruido.
  beforeEach(() => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    URL.createObjectURL = vi.fn(() => 'blob:test');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('pinta la página que devuelve el backend', async () => {
    const { el } = await setup();
    expect(el.querySelectorAll('tbody tr').length).toBe(2);
    expect(celdas(el, 1)).toEqual(['MERCADERIA', 'SERVICIO']);
  });

  it('arranca pidiendo la primera página con el tamaño por defecto y sin filtro', async () => {
    // ⚠ El parámetro es `page_size`, en snake_case. No `pageSize`.
    const { api } = await setup();
    expect(ultima(api)).toMatchObject({ page: 1, page_size: 25, q: '' });
  });

  it('lleva columna de orden y de estado, y ninguna es ordenable', async () => {
    // El `#` y el interruptor los hace posibles la migración 0009: la columna `orden` existía
    // pero no había función que la escribiese ni listado que la respetase.
    //
    // Sin `sortable`: con paginación de servidor solo ordenaría la página en curso, y además el
    // orden de este catálogo es un dato editable, no una vista.
    const { fixture, el } = await setup();
    const c = comp(fixture);

    expect(c.columns.map((col) => col.key)).toEqual([
      'orden',
      'nombre',
      'abreviatura',
      'codigo_contable',
      'estado',
    ]);
    expect(c.columns.some((col) => col.sortable)).toBe(false);
    expect(el.querySelectorAll('thead .sort').length).toBe(0);
  });

  it('NO ofrece filtro de estado', async () => {
    // Deliberado: con paginación de SERVIDOR, descartar filas en cliente dejaría páginas
    // incompletas y un total de pie que no cuadra con lo que se ve.
    const { el } = await setup();
    expect(el.querySelector('erp-filter-panel [formControlName="estado"]')).toBeNull();
  });

  it('el listado trae las inactivas: el backend no filtra por estado', async () => {
    const api = new LineaApiMock();
    api.rows = [linea(), linea({ lineaid: 2, nombre: 'APAGADA', estado: false, orden: 2 })];
    const { fixture } = await setup(api);

    expect(comp(fixture).rows().map((row) => row.nombre)).toEqual(['MERCADERIA', 'APAGADA']);
  });

  it('el filtro por nombre VA AL SERVIDOR', async () => {
    const { fixture, api } = await setup();
    const c = comp(fixture);

    c.filters.patchValue({ q: '  servicio  ' });
    c.onApply();
    await asentar(fixture);

    expect(ultima(api).q).toBe('servicio'); // recortado
    expect(ultima(api).page).toBe(1); // el filtro cambia el universo: se vuelve a la 1
    expect(c.rows().map((row) => row.nombre)).toEqual(['SERVICIO']);
  });

  it('el filtro no se resuelve en cliente: si el backend no filtra, la pantalla no filtra', async () => {
    // Blindaje contra un filtro fantasma: `list()` aquí devuelve TODO, ignorando la `q`.
    const api = new LineaApiMock();
    api.list = ((query: LineaListQuery) => {
      api.consultas.push(query);
      return of({
        data: api.rows,
        meta: { page: query.page, pageSize: query.page_size, total: api.rows.length, totalPages: 1 },
      });
    }) as LineaApiMock['list'];

    const { fixture } = await setup(api);
    const c = comp(fixture);

    c.filters.patchValue({ q: 'servicio' });
    c.onApply();
    await asentar(fixture);

    expect(c.rows().length).toBe(2);
  });

  it('"Buscar" vuelve a consultar aunque el filtro no haya cambiado', async () => {
    const { fixture, api } = await setup();
    const c = comp(fixture);

    const antes = api.consultas.length;
    c.onApply();
    await asentar(fixture);

    expect(api.consultas.length).toBeGreaterThan(antes);
  });

  it('cambiar de página VA AL SERVIDOR: no se trocea en cliente', async () => {
    const api = new LineaApiMock();
    api.rows = catalogo(30);
    const { fixture, el } = await setup(api);
    const c = comp(fixture);

    expect(el.querySelectorAll('tbody tr').length).toBe(25);

    c.onPage(2);
    await asentar(fixture);

    expect(ultima(api).page).toBe(2);
    expect(el.querySelectorAll('tbody tr').length).toBe(5);
    expect(celdas(el, 1)[0]).toBe('LINEA 26');
  });

  it('el total del pie sale del `meta` del backend, no de contar las filas cargadas', async () => {
    const api = new LineaApiMock();
    api.rows = catalogo(30);
    api.totalDeclarado = 137;
    const { fixture } = await setup(api);
    const c = comp(fixture);

    expect(c.rows().length).toBe(25);
    expect(c.meta()).toMatchObject({ page: 1, pageSize: 25, total: 137, totalPages: 6 });
  });

  it('cambiar el tamaño de página vuelve a la primera y lo consulta', async () => {
    const api = new LineaApiMock();
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

  it('alterna el estado y se queda con el valor que devuelve el backend', async () => {
    // El endpoint es un TOGGLE: no se le manda el valor deseado. Pero sí devuelve el
    // resultante, y es ése el que se pinta: si otro usuario lo cambió entre medias, la fila
    // queda correcta.
    const api = new LineaApiMock();
    api.estadoResultante = false;
    const { fixture } = await setup(api);
    const c = comp(fixture);

    c.onToggleEstado(linea() as never);
    await asentar(fixture);

    expect(api.alternadas).toEqual([1]);
    expect(c.rows()[0].estado).toBe(false);
  });

  it('revierte el estado si el backend falla', async () => {
    const api = new LineaApiMock();
    api.fallar = true;
    const { fixture } = await setup(api);
    const c = comp(fixture);

    c.onToggleEstado(linea() as never);
    await asentar(fixture);

    expect(c.rows()[0].estado).toBe(true);
  });

  it('al reordenar manda SOLO la página y el `desde` de esa página', async () => {
    // ⚠ Es LA diferencia con las pantallas de catálogo completo, que mandan la lista entera con
    // `desde: 1`. Aquí la lista entera no está en memoria: se manda el tramo y su posición
    // 1-based dentro del catálogo, y el backend hace `orden = posición + (desde-1)`. Mandar 1
    // desde la página 2 colaría esas filas delante de las de la 1.
    const api = new LineaApiMock();
    api.rows = catalogo(30);
    const { fixture } = await setup(api);
    const c = comp(fixture);

    c.onPageSize(10);
    await asentar(fixture);
    c.onPage(2);
    await asentar(fixture);

    const invertido = [...c.rows()].reverse();
    c.onReorder(invertido as never);
    await asentar(fixture);

    expect(api.reordenes.length).toBe(1);
    expect(api.reordenes[0].desde).toBe(11); // (página 2 - 1) * 10 + 1
    expect(api.reordenes[0].ids[0]).toBe(20); // la última de la página pasa a ser la primera
    // Y el `#` local se renumera desde `desde`, no desde 1.
    expect(c.rows()[0].orden).toBe(11);
  });

  it('revierte el orden si el backend falla', async () => {
    const api = new LineaApiMock();
    api.fallar = true;
    const { fixture } = await setup(api);
    const c = comp(fixture);

    const antes = c.rows().map((row) => row.lineaid);
    c.onReorder([...c.rows()].reverse() as never);
    await asentar(fixture);

    expect(c.rows().map((row) => row.lineaid)).toEqual(antes);
  });

  it('el arrastre se apaga con texto buscado, pero NO por haber varias páginas', async () => {
    // La página es un TRAMO CONTIGUO del orden del servidor y `desde` dice dónde empieza, así
    // que reordenar dentro de una página cualquiera es correcto. Con un filtro por nombre, en
    // cambio, las filas visibles no son contiguas y renumerarlas machacaría el orden de las
    // ocultas.
    const api = new LineaApiMock();
    api.rows = catalogo(30);
    const { fixture } = await setup(api);
    const c = comp(fixture);

    expect(c.meta().totalPages).toBe(2);
    expect(c.filtrando()).toBe(false); // varias páginas y aun así se puede arrastrar

    c.filters.patchValue({ q: 'linea 1' });
    c.onApply();
    await asentar(fixture);
    expect(c.filtrando()).toBe(true);
  });

  it('el alta manda SOLO los tres campos del formulario', async () => {
    // Ni `estado` ni `orden`: cada uno tiene su propia acción en la grilla.
    const { fixture, api, notify } = await setup();
    const c = comp(fixture);

    c.onNuevo();
    c.form.patchValue({ nombre: 'IMPORTADOS', abreviatura: 'IMP', codigo_contable: '0033' });
    c.onGuardar();
    await asentar(fixture);

    expect(api.creadas).toEqual([
      { nombre: 'IMPORTADOS', abreviatura: 'IMP', codigo_contable: '0033' },
    ]);
    expect(c.modalAbierto()).toBe(false);
    expect(notify.exitos.length).toBe(1);
  });

  it('el formulario no ofrece ni estado ni orden', async () => {
    const { fixture, el } = await setup();
    const c = comp(fixture);

    c.onNuevo();
    fixture.detectChanges();

    expect(c.form.getRawValue()).toEqual({ nombre: '', abreviatura: '', codigo_contable: '' });
    expect(el.querySelector('erp-modal [formControlName="estado"]')).toBeNull();
    expect(el.querySelector('erp-modal [formControlName="orden"]')).toBeNull();
  });

  it('el ID contable admite 20 caracteres, los de la columna', async () => {
    // ⚠ `LineaEdit.php` declara `maxlength=5` sobre un `varchar(20)`: miente en la dirección
    // contraria a la habitual y deja escribir la cuarta parte de lo que cabe.
    const { fixture, el } = await setup();
    comp(fixture).onNuevo();
    fixture.detectChanges();

    const input = el.querySelector(
      'erp-modal [formControlName="codigo_contable"]',
    ) as HTMLInputElement;
    expect(input.getAttribute('maxlength')).toBe('20');
  });

  it('no envía nada si falta el nombre', async () => {
    const { fixture, api } = await setup();
    const c = comp(fixture);

    c.onNuevo();
    c.form.patchValue({ nombre: '' });
    c.onGuardar();
    await asentar(fixture);

    expect(api.creadas).toEqual([]);
    expect(c.modalAbierto()).toBe(true);
  });

  it('deja el modal abierto con lo escrito si el guardado falla', async () => {
    // 409 por nombre duplicado: hay que poder corregirlo sin volver a teclearlo todo.
    const api = new LineaApiMock();
    api.fallar = true;
    const { fixture } = await setup(api);
    const c = comp(fixture);

    c.onNuevo();
    c.form.patchValue({ nombre: 'MERCADERIA', abreviatura: 'ME', codigo_contable: '' });
    c.onGuardar();
    await asentar(fixture);

    expect(c.modalAbierto()).toBe(true);
    expect(c.form.getRawValue()).toEqual({
      nombre: 'MERCADERIA',
      abreviatura: 'ME',
      codigo_contable: '',
    });
  });

  it('tras crear se RECARGA del servidor en vez de añadir la fila en local', async () => {
    // El backend ordena el catálogo y `meta.total` lo cuenta él. El doble mete la nueva la
    // PRIMERA, así que verla en la posición 0 solo puede venir de una recarga.
    const { fixture, api } = await setup();
    const c = comp(fixture);
    const antes = api.consultas.length;

    c.onNuevo();
    c.form.patchValue({ nombre: 'ZONA', abreviatura: 'ZN', codigo_contable: '' });
    c.onGuardar();
    await asentar(fixture);

    expect(api.consultas.length).toBeGreaterThan(antes);
    expect(c.rows().map((row) => row.nombre)).toEqual(['ZONA', 'MERCADERIA', 'SERVICIO']);
    expect(c.meta().total).toBe(3);
  });

  it('editar precarga los tres campos y manda un PUT', async () => {
    const { fixture, api } = await setup();
    const c = comp(fixture);

    c.onEditar(
      linea({ lineaid: 2, nombre: 'SERVICIO', abreviatura: 'SERV', codigo_contable: '0012' }) as never,
    );
    expect(c.tituloModal()).toBe('Editar línea');
    expect(c.form.getRawValue()).toEqual({
      nombre: 'SERVICIO',
      abreviatura: 'SERV',
      codigo_contable: '0012',
    });

    c.form.patchValue({ nombre: 'SERVICIOS' });
    c.onGuardar();
    await asentar(fixture);

    expect(api.actualizadas).toEqual([
      { id: 2, input: { nombre: 'SERVICIOS', abreviatura: 'SERV', codigo_contable: '0012' } },
    ]);
    expect(api.creadas).toEqual([]);
  });

  it('eliminar pide confirmación antes de llamar al backend', async () => {
    const { fixture, api, confirm } = await setup();
    const c = comp(fixture);
    confirm.respuesta = false;

    c.onEliminar(linea() as never);
    await asentar(fixture);

    expect(confirm.preguntas.length).toBe(1);
    expect(api.eliminadas).toEqual([]);
  });

  it('tras eliminar se RECARGA del servidor', async () => {
    const { fixture, api } = await setup();
    const c = comp(fixture);
    const antes = api.consultas.length;

    c.onEliminar(linea() as never);
    await asentar(fixture);

    expect(api.eliminadas).toEqual([1]);
    expect(api.consultas.length).toBeGreaterThan(antes);
    expect(c.rows().map((row) => row.lineaid)).toEqual([2]);
    expect(c.meta().total).toBe(1);
  });

  it('la grilla ofrece checkbox de selección por fila', async () => {
    const { el } = await setup();
    expect(el.querySelectorAll('tbody input[type="checkbox"]').length).toBe(2);
  });

  it('el borrado en lote va en UNA petición, no N deletes', async () => {
    const { fixture, api, el } = await setup();
    const c = comp(fixture);

    (el.querySelector('thead .col-select input') as HTMLInputElement).click();
    fixture.detectChanges();
    expect(c.seleccionadas().length).toBe(2);

    (el.querySelector('[filterActions] .btn--danger') as HTMLButtonElement).click();
    await asentar(fixture);

    expect(api.lotes).toEqual([[1, 2]]);
    expect(api.eliminadas).toEqual([]); // no cae al endpoint de uno en uno
    expect(c.rows()).toEqual([]);
    expect(c.seleccionadas()).toEqual([]);
  });

  it('el lote es parcial: conserva las que fallaron y avisa con el motivo del backend', async () => {
    const api = new LineaApiMock();
    api.loteResultado = [
      { lineaid: 1, ok: true },
      { lineaid: 2, ok: false, codigo: 'linea_has_relations', mensaje: 'Tiene productos registrados.' },
    ];
    const { fixture, notify } = await setup(api);
    const c = comp(fixture);

    c.onSeleccion([{ lineaid: 1 }, { lineaid: 2 }] as never);
    c.onEliminarSeleccionadas();
    await asentar(fixture);

    expect(c.rows().map((row) => row.lineaid)).toEqual([2]);
    expect(notify.exitos).toEqual(['Se eliminaron 1 registro(s).']);
    expect(notify.errores.length).toBe(1);
    expect(notify.errores[0]).toContain('Tiene productos registrados.');
  });

  it('la abreviatura y el ID contable vacíos se pintan como guion', async () => {
    const api = new LineaApiMock();
    api.rows = [linea({ abreviatura: '', codigo_contable: '' })];
    const { el } = await setup(api);

    expect(celdas(el, 2)).toEqual(['—']);
    expect(celdas(el, 3)).toEqual(['—']);
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
    const anchor = vi.spyOn(HTMLAnchorElement.prototype, 'click');
    const api = new LineaApiMock();
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
    // ⚠ NO a /mantenimiento/tablas-basicas: Líneas no cuelga de ese hub.
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
