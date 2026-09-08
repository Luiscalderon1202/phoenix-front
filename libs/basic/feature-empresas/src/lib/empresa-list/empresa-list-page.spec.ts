import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { EmpresaApi, ReferenciaApi } from '@phoenix/basic/data-access';
import type { Corporacion, Distrito, Empresa, EmpresaInput } from '@phoenix/basic/domain';
import { ConfirmService, NotificationService } from '@phoenix/shared/ui';
import { EmpresaListPage } from './empresa-list-page';

function empresa(over: Partial<Empresa> = {}): Empresa {
  return {
    empresaid: 1,
    ruc: '20611630850',
    nombre: 'SERAPHIS PUBLICIDAD Y PUNTO E.I.R.L.',
    nombre_comercial: '',
    abreviatura: 'SERAPHIS',
    direccion: 'JR. ORB 423',
    url: '',
    email: '',
    telefono: '',
    corporacionid: 1,
    corporacion_nombre: 'EMS',
    corporacion_abreviatura: 'EMS',
    distritoid: 1249,
    distrito_nombre: 'BREÑA',
    provinciaid: 127,
    provincia_nombre: 'LIMA',
    departamentoid: 14,
    departamento_nombre: 'LIMA',
    cantidad_almacenes: 1,
    orden: 1,
    estado: true,
    ...over,
  };
}

/**
 * Doble del API que se comporta como el backend de verdad.
 *
 * ⚠ `list()` NO RECIBE NADA y devuelve el catálogo entero, activas e inactivas. No es una
 * simplificación del doble: `basic.paempresa_leer()` no acepta ningún argumento. Es
 * precisamente eso lo que prueban los tests de abajo — que la pantalla no intente delegar
 * filtros que el endpoint no tiene.
 */
class EmpresaApiMock {
  rows: Empresa[] = [
    empresa(),
    empresa({
      empresaid: 2,
      ruc: '20999999992',
      nombre: 'OTRA EMPRESA S.A.C.',
      abreviatura: 'OTRA',
      corporacion_nombre: 'GRUPO DOS',
      orden: 2,
      estado: false,
      cantidad_almacenes: 0,
    }),
  ];

  /** Cuántas veces se ha pedido el listado. El endpoint no lleva filtros que registrar. */
  llamadasList = 0;
  readonly creados: EmpresaInput[] = [];
  readonly actualizados: { id: number; input: EmpresaInput }[] = [];
  readonly eliminados: number[] = [];
  readonly alternados: number[] = [];
  readonly reordenes: { ids: number[]; desde: number }[] = [];
  /** Ids cuya FICHA se ha pedido. Debe quedarse vacío: editar no la necesita. */
  readonly fichasPedidas: number[] = [];

  estadoResultante = false;
  fallar = false;

  list() {
    this.llamadasList++;
    return of(this.rows);
  }

  get(empresaid: number) {
    this.fichasPedidas.push(empresaid);
    return of({ ...empresa({ empresaid }), igv: '18.00' } as never);
  }

  create(input: EmpresaInput) {
    this.creados.push(input);
    if (this.fallar) return throwError(() => new Error('409'));
    this.rows = [...this.rows, empresa({ empresaid: 99, ...input, orden: this.rows.length + 1 })];
    return of({ ...input, empresaid: 99 } as never);
  }

  update(id: number, input: EmpresaInput) {
    this.actualizados.push({ id, input });
    if (this.fallar) return throwError(() => new Error('409'));
    this.rows = this.rows.map((r) => (r.empresaid === id ? empresa({ ...r, ...input }) : r));
    return of({ ...input, empresaid: id } as never);
  }

  remove(id: number) {
    this.eliminados.push(id);
    if (this.fallar) return throwError(() => new Error('409'));
    this.rows = this.rows.filter((r) => r.empresaid !== id);
    return of(undefined as unknown as void);
  }

  alternarEstado(empresaid: number) {
    this.alternados.push(empresaid);
    if (this.fallar) return throwError(() => new Error('500'));
    return of({ empresaid, estado: this.estadoResultante });
  }

  reordenar(ids: readonly number[], desde = 1) {
    this.reordenes.push({ ids: [...ids], desde });
    if (this.fallar) return throwError(() => new Error('500'));
    return of(undefined as unknown as void);
  }
}

/** Doble de los catálogos de apoyo, con el mismo corte de búsqueda que el real. */
class ReferenciaApiMock {
  readonly busquedasDistrito: string[] = [];

  corporaciones() {
    return of([
      { corporacionid: 1, nombre: 'EMS' } as Corporacion,
      { corporacionid: 2, nombre: 'GRUPO DOS' } as Corporacion,
    ]);
  }

  distritos(opts: { q?: string } = {}) {
    const q = (opts.q ?? '').trim();
    this.busquedasDistrito.push(q);
    // El API real devuelve lista vacía sin salir a la red si no se acota. Se replica para que
    // el test pueda comprobar que la pantalla no promete opciones que no llegarían.
    if (q.length < 2) return of([] as Distrito[]);
    return of([
      {
        distritoid: 1249,
        nombre: 'BREÑA',
        provinciaid: 127,
        provincia: 'LIMA',
        departamentoid: 14,
        departamento: 'LIMA',
        ubigeo: '150105',
      },
    ] as Distrito[]);
  }
}

class ConfirmServiceMock {
  respuesta = true;
  readonly preguntas: { message?: string }[] = [];
  ask(opts: { message?: string }) {
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

async function setup(api = new EmpresaApiMock()) {
  const referencia = new ReferenciaApiMock();
  const confirm = new ConfirmServiceMock();
  const notify = new NotificationServiceMock();

  TestBed.configureTestingModule({
    imports: [EmpresaListPage],
    providers: [
      provideRouter([]),
      { provide: EmpresaApi, useValue: api },
      { provide: ReferenciaApi, useValue: referencia },
      { provide: ConfirmService, useValue: confirm },
      { provide: NotificationService, useValue: notify },
    ],
  });

  const fixture = TestBed.createComponent(EmpresaListPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, api, referencia, confirm, notify, el: fixture.nativeElement as HTMLElement };
}

/** Deja correr las promesas encadenadas y repinta. */
async function asentar(fixture: { whenStable(): Promise<unknown>; detectChanges(): void }) {
  for (let i = 0; i < 4; i++) {
    await fixture.whenStable();
    fixture.detectChanges();
  }
}

function comp(fixture: { componentInstance: unknown }) {
  return fixture.componentInstance as unknown as Record<string, (...a: never[]) => unknown> & {
    filters: { patchValue(v: unknown): void };
    form: { patchValue(v: unknown): void; getRawValue(): EmpresaInput; valid: boolean };
    columns: { key: string; sortable?: boolean }[];
    rows(): Empresa[];
    rowsPagina(): Empresa[];
    modalAbierto(): boolean;
    tituloModal(): string;
    filtrando(): boolean;
    opcionesDistrito(): { distritoid: number; etiqueta: string }[];
    meta(): { page: number; pageSize: number; total: number; totalPages: number };
    onApply(): void;
    onPage(n: number): void;
    onPageSize(n: number): void;
    onBuscarDistrito(t: string): void;
  };
}

describe('EmpresaListPage', () => {
  it('pinta el catálogo entero que devuelve el backend', async () => {
    const { fixture } = await setup();
    expect(comp(fixture).rows()).toHaveLength(2);
  });

  // ── El reparto de trabajo, que aquí es todo del cliente ───────────────
  it('NO manda filtros al backend: el endpoint no acepta ninguno', async () => {
    const { fixture, api } = await setup();
    const c = comp(fixture);

    c.filters.patchValue({ q: 'seraphis', estado: 'inactivos' });
    c.onApply();
    await asentar(fixture);

    // Una sola petición, la de la carga inicial: filtrar no vuelve a salir a la red.
    expect(api.llamadasList).toBe(1);
  });

  it('el filtro de texto busca también por RUC, no solo por razón social', async () => {
    const { fixture } = await setup();
    const c = comp(fixture);

    // El RUC está en la grilla, así que tiene que poder buscarse por él.
    c.filters.patchValue({ q: '20999999992' });
    c.onApply();
    await asentar(fixture);

    expect(c.rows()).toHaveLength(1);
    expect(c.rows()[0].nombre).toBe('OTRA EMPRESA S.A.C.');
  });

  it('el filtro de texto también encuentra por abreviatura y corporación', async () => {
    const { fixture } = await setup();
    const c = comp(fixture);

    c.filters.patchValue({ q: 'grupo dos' });
    c.onApply();
    await asentar(fixture);
    expect(c.rows()).toHaveLength(1);

    c.filters.patchValue({ q: 'SERAPHIS' });
    c.onApply();
    await asentar(fixture);
    expect(c.rows()).toHaveLength(1);
    expect(c.rows()[0].empresaid).toBe(1);
  });

  it('el filtro de estado se resuelve en el cliente', async () => {
    const { fixture } = await setup();
    const c = comp(fixture);

    c.filters.patchValue({ estado: 'inactivos' });
    c.onApply();
    await asentar(fixture);

    expect(c.rows()).toHaveLength(1);
    expect(c.rows()[0].estado).toBe(false);
  });

  // ── Paginación (cliente) ─────────────────────────────────────────────
  it('pagina en el cliente y el total refleja el filtro, no el universo', async () => {
    const { fixture } = await setup();
    const c = comp(fixture);

    c.onPageSize(1);
    await asentar(fixture);
    expect(c.rowsPagina()).toHaveLength(1);
    expect(c.meta().total).toBe(2);
    expect(c.meta().totalPages).toBe(2);

    c.onPage(2);
    await asentar(fixture);
    expect(c.rowsPagina()[0].empresaid).toBe(2);
  });

  it('aplicar un filtro devuelve a la página 1: la anterior ya no significa nada', async () => {
    const { fixture } = await setup();
    const c = comp(fixture);

    c.onPageSize(1);
    c.onPage(2);
    await asentar(fixture);
    expect(c.meta().page).toBe(2);

    c.filters.patchValue({ q: 'seraphis' });
    c.onApply();
    await asentar(fixture);
    expect(c.meta().page).toBe(1);
  });

  // ── Arrastre ─────────────────────────────────────────────────────────
  it('apaga el arrastre en cuanto lo que se ve no es el catálogo entero', async () => {
    const { fixture } = await setup();
    const c = comp(fixture);
    expect(c.filtrando()).toBe(false);

    c.filters.patchValue({ q: 'seraphis' });
    c.onApply();
    await asentar(fixture);
    expect(c.filtrando()).toBe(true);

    c.filters.patchValue({ q: '' });
    c.onApply();
    c.onPageSize(1); // repartido en dos páginas: la grilla solo emitiría lo visible
    await asentar(fixture);
    expect(c.filtrando()).toBe(true);
  });

  it('reordena mandando la lista completa desde la posición 1', async () => {
    const { fixture, api } = await setup();
    const filas = comp(fixture).rows();

    await (comp(fixture)['onReorder'] as (f: Empresa[]) => Promise<void>)([filas[1], filas[0]]);
    await asentar(fixture);

    expect(api.reordenes).toHaveLength(1);
    expect(api.reordenes[0]).toEqual({ ids: [2, 1], desde: 1 });
    // Renumerado optimista: el `#` cuadra al instante con la posición.
    expect(comp(fixture).rows().map((e) => e.orden)).toEqual([1, 2]);
  });

  // ── Estado ───────────────────────────────────────────────────────────
  it('alterna el estado de forma optimista y respeta el valor que devuelve el backend', async () => {
    const api = new EmpresaApiMock();
    api.estadoResultante = false;
    const { fixture } = await setup(api);

    await (comp(fixture)['onToggleEstado'] as (r: Empresa) => Promise<void>)(
      comp(fixture).rows()[0],
    );
    await asentar(fixture);

    expect(api.alternados).toEqual([1]);
    expect(comp(fixture).rows()[0].estado).toBe(false);
  });

  it('revierte el estado si el backend falla', async () => {
    const api = new EmpresaApiMock();
    api.fallar = true;
    const { fixture } = await setup(api);

    await (comp(fixture)['onToggleEstado'] as (r: Empresa) => Promise<void>)(
      comp(fixture).rows()[0],
    );
    await asentar(fixture);

    expect(comp(fixture).rows()[0].estado).toBe(true);
  });

  // ── Alta y edición ───────────────────────────────────────────────────
  it('editar NO pide la ficha: todo lo editable ya viene en el listado', async () => {
    const { fixture, api } = await setup();
    const c = comp(fixture);

    (c['onEditar'] as (r: Empresa) => void)(c.rows()[0]);
    await asentar(fixture);

    // La ficha añade país, ubigeo e IGV, y ninguno de los tres es editable aquí.
    expect(api.fichasPedidas).toEqual([]);
    expect(c.modalAbierto()).toBe(true);
    expect(c.tituloModal()).toBe('Editar empresa');
    expect(c.form.getRawValue().ruc).toBe('20611630850');
  });

  it('al editar deja el distrito ya elegible aunque no se haya buscado nada', async () => {
    const { fixture } = await setup();
    const c = comp(fixture);

    (c['onEditar'] as (r: Empresa) => void)(c.rows()[0]);
    await asentar(fixture);

    // Sin esto el combo aparecería vacío aunque el valor esté puesto.
    const opciones = c.opcionesDistrito();
    expect(opciones).toHaveLength(1);
    expect(opciones[0].distritoid).toBe(1249);
    expect(opciones[0].etiqueta).toBe('BREÑA (LIMA, LIMA)');
  });

  it('con menos de dos letras no ofrece distritos: el backend tampoco los daría', async () => {
    const { fixture } = await setup();
    const c = comp(fixture);

    c.onBuscarDistrito('B');
    await asentar(fixture);
    expect(c.opcionesDistrito()).toHaveLength(0);

    c.onBuscarDistrito('BRE');
    await asentar(fixture);
    expect(c.opcionesDistrito()).toHaveLength(1);
  });

  it('el RUC exige once dígitos exactos', async () => {
    const { fixture } = await setup();
    const c = comp(fixture);

    (c['onNuevo'] as () => void)();
    const base = {
      nombre: 'X',
      corporacionid: 1,
      distritoid: 1249,
      nombre_comercial: '',
      abreviatura: '',
      direccion: '',
      telefono: '',
      email: '',
      url: '',
    };

    for (const ruc of ['2061163085', '206116308501', '2061163085X']) {
      c.form.patchValue({ ...base, ruc });
      expect(c.form.valid).toBe(false);
    }
    c.form.patchValue({ ...base, ruc: '20611630850' });
    expect(c.form.valid).toBe(true);
  });

  it('un formulario inválido no llega al backend', async () => {
    const { fixture, api } = await setup();
    const c = comp(fixture);

    (c['onNuevo'] as () => void)();
    c.form.patchValue({ ruc: '123', nombre: '' });
    await (c['onGuardar'] as () => Promise<void>)();
    await asentar(fixture);

    expect(api.creados).toHaveLength(0);
    expect(c.modalAbierto()).toBe(true);
  });

  it('tras guardar RECARGA el listado en vez de parchear con lo que devuelve el alta', async () => {
    const { fixture, api, notify } = await setup();
    const c = comp(fixture);
    expect(api.llamadasList).toBe(1);

    (c['onNuevo'] as () => void)();
    c.form.patchValue({
      ruc: '20999999993',
      nombre: 'TERCERA S.A.',
      nombre_comercial: '',
      abreviatura: 'TRC',
      corporacionid: 1,
      distritoid: 1249,
      direccion: '',
      telefono: '',
      email: '',
      url: '',
    });
    await (c['onGuardar'] as () => Promise<void>)();
    await asentar(fixture);

    expect(api.creados).toHaveLength(1);
    // Guardar devuelve una FICHA, que no trae `corporacion_nombre` ni la cadena geográfica:
    // meterla tal cual en la grilla dejaría celdas en blanco.
    expect(api.llamadasList).toBe(2);
    expect(c.modalAbierto()).toBe(false);
    expect(notify.exitos.join(' ')).toContain('TERCERA S.A.');
  });

  it('si guardar falla, el modal se queda abierto con lo escrito', async () => {
    const api = new EmpresaApiMock();
    api.fallar = true;
    const { fixture } = await setup(api);
    const c = comp(fixture);

    (c['onNuevo'] as () => void)();
    c.form.patchValue({
      ruc: '20999999994',
      nombre: 'DUPLICADA',
      nombre_comercial: '',
      abreviatura: '',
      corporacionid: 1,
      distritoid: 1249,
      direccion: '',
      telefono: '',
      email: '',
      url: '',
    });
    await (c['onGuardar'] as () => Promise<void>)();
    await asentar(fixture);

    expect(c.modalAbierto()).toBe(true);
    expect(c.form.getRawValue().nombre).toBe('DUPLICADA');
  });

  // ── Eliminación ──────────────────────────────────────────────────────
  it('avisa de los locales asociados antes de eliminar', async () => {
    const { fixture, confirm } = await setup();
    const c = comp(fixture);

    await (c['onEliminar'] as (r: Empresa) => Promise<void>)(c.rows()[0]);
    await asentar(fixture);

    expect(confirm.preguntas[0].message).toContain('1 local(es)');
  });

  it('cancelar la confirmación no elimina nada', async () => {
    const { fixture, api, confirm } = await setup();
    confirm.respuesta = false;

    await (comp(fixture)['onEliminar'] as (r: Empresa) => Promise<void>)(comp(fixture).rows()[0]);
    await asentar(fixture);

    expect(api.eliminados).toHaveLength(0);
    expect(comp(fixture).rows()).toHaveLength(2);
  });

  // ── Lo que esta pantalla NO tiene ────────────────────────────────────
  it('la grilla NO es seleccionable: no hay borrado en lote', async () => {
    const { el } = await setup();
    // Contra basic.empresa apuntan más de veinte claves foráneas; unas casillas prometerían
    // una acción que el backend no ofrece.
    expect(el.querySelectorAll('tbody input[type="checkbox"]')).toHaveLength(0);
  });

  it('ninguna columna es ordenable: el orden es un dato editable, no una vista', async () => {
    const { fixture } = await setup();
    expect(comp(fixture).columns.every((col) => !col.sortable)).toBe(true);
  });
});
