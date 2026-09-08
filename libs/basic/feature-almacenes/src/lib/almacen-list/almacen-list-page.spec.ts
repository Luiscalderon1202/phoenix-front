import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AlmacenApi, ReferenciaApi, TipoEmpresaApi } from '@phoenix/basic/data-access';
import type {
  Almacen,
  AlmacenFiltros,
  AlmacenInput,
  Distrito,
  UnidadNegocio,
  Zona,
} from '@phoenix/basic/domain';
import { ConfirmService, NotificationService } from '@phoenix/shared/ui';
import { AlmacenListPage } from './almacen-list-page';

function almacen(over: Partial<Almacen> = {}): Almacen {
  return {
    almacenid: 1,
    nombre: 'ALMACEN PRINCIPAL',
    abreviatura: 'ALM',
    direccion: 'CA. BOLIVAR',
    telefono: '',
    email: '',
    web: '',
    orden: 1,
    estado: true,
    zonaid: 1,
    zona_nombre: 'ZONA NORTE',
    zona_abreviatura: 'NORTE',
    unidadnegocioid: 1,
    unidadnegocio_nombre: 'EMS',
    unidadnegocio_abreviatura: 'EMS',
    // ⚠ 0 y cadena vacía es lo NORMAL: la empresa sale de basic.empresa_almacen (N:M) y el
    // grupo de basic.almacen_config, y el local de producción no tiene fila en ninguna.
    empresaid: 0,
    empresa_nombre: '',
    empresa_abreviatura: '',
    grupoid: 0,
    grupo_nombre: '',
    grupo_abreviatura: '',
    distritoid: 1219,
    distrito_nombre: 'JOSE LEONARDO ORTIZ',
    provinciaid: 124,
    provincia_nombre: 'CHICLAYO',
    departamentoid: 13,
    departamento_nombre: 'LAMBAYEQUE',
    tipoempresaid: 1,
    tipoempresa_nombre: 'TIENDA COMERCIAL',
    cantidad_personas: 23,
    personas_detalle: 'Fredd Lopez y [1]22[/1] personas más',
    ...over,
  };
}

/**
 * Doble del API que se comporta como el backend de verdad.
 *
 * ⚠ `list()` FILTRA por texto, zona, unidad de negocio y tipo de empresa —los cuatro que
 * acepta `basic.paalmacen_leer`— pero NO por estado ni por página: devuelve activos e
 * inactivos. Es justo ese reparto el que prueban los tests; con un doble que filtrase también
 * por estado no se distinguiría un filtro de cliente de uno delegado.
 */
class AlmacenApiMock {
  rows: Almacen[] = [
    almacen(),
    almacen({
      almacenid: 2,
      nombre: 'TIENDA CENTRO',
      abreviatura: 'CEN',
      orden: 2,
      estado: false,
      zonaid: 2,
      zona_nombre: 'ZONA SUR',
      unidadnegocioid: 2,
      tipoempresaid: 2,
      empresaid: 1,
      empresa_nombre: 'SERAPHIS',
      cantidad_personas: 0,
      personas_detalle: '',
    }),
  ];

  readonly consultas: AlmacenFiltros[] = [];
  readonly creados: AlmacenInput[] = [];
  readonly actualizados: { id: number; input: AlmacenInput }[] = [];
  readonly eliminados: number[] = [];
  readonly alternados: number[] = [];
  readonly reordenes: { ids: number[]; desde: number }[] = [];
  readonly fichasPedidas: number[] = [];

  estadoResultante = false;
  fallar = false;

  list(filtros: AlmacenFiltros = {}) {
    this.consultas.push({ ...filtros });
    let out = this.rows;
    if (filtros.q?.trim()) {
      const q = filtros.q.trim().toLocaleLowerCase('es');
      out = out.filter((a) => a.nombre.toLocaleLowerCase('es').includes(q));
    }
    if (filtros.zonaid) out = out.filter((a) => a.zonaid === filtros.zonaid);
    if (filtros.unidadnegocioid) {
      out = out.filter((a) => a.unidadnegocioid === filtros.unidadnegocioid);
    }
    if (filtros.tipoempresaid) out = out.filter((a) => a.tipoempresaid === filtros.tipoempresaid);
    return of(out);
  }

  /** La ficha SÍ hace falta al editar: `nombre_comercial` no viene en el listado. */
  get(almacenid: number) {
    this.fichasPedidas.push(almacenid);
    return of({
      ...almacen({ almacenid }),
      nombre_comercial: 'NOMBRE COMERCIAL DE LA FICHA',
    } as never);
  }

  create(input: AlmacenInput) {
    this.creados.push(input);
    if (this.fallar) return throwError(() => new Error('409'));
    this.rows = [...this.rows, almacen({ almacenid: 99, ...input, orden: this.rows.length + 1 })];
    return of({ ...input, almacenid: 99 } as never);
  }

  update(id: number, input: AlmacenInput) {
    this.actualizados.push({ id, input });
    if (this.fallar) return throwError(() => new Error('409'));
    this.rows = this.rows.map((r) => (r.almacenid === id ? almacen({ ...r, ...input }) : r));
    return of({ ...input, almacenid: id } as never);
  }

  remove(id: number) {
    this.eliminados.push(id);
    if (this.fallar) return throwError(() => new Error('409'));
    this.rows = this.rows.filter((r) => r.almacenid !== id);
    return of(undefined as unknown as void);
  }

  alternarEstado(almacenid: number) {
    this.alternados.push(almacenid);
    if (this.fallar) return throwError(() => new Error('500'));
    return of({ almacenid, estado: this.estadoResultante });
  }

  reordenar(ids: readonly number[], desde = 1) {
    this.reordenes.push({ ids: [...ids], desde });
    if (this.fallar) return throwError(() => new Error('500'));
    return of(undefined as unknown as void);
  }
}

class ReferenciaApiMock {
  /** Los tipos de empresa con los que se han pedido unidades de negocio, en orden. */
  readonly tiposConsultados: number[] = [];

  zonas() {
    return of([
      { zonaid: 1, nombre: 'ZONA NORTE' } as Zona,
      { zonaid: 2, nombre: 'ZONA SUR' } as Zona,
    ]);
  }

  unidadesNegocio(tipoempresaid = 0) {
    this.tiposConsultados.push(tipoempresaid);
    const todas = [
      { unidadnegocioid: 1, tipoempresaid: 1, nombre: 'EMS' } as UnidadNegocio,
      { unidadnegocioid: 2, tipoempresaid: 2, nombre: 'OTRA UNIDAD' } as UnidadNegocio,
    ];
    return of(tipoempresaid ? todas.filter((u) => u.tipoempresaid === tipoempresaid) : todas);
  }

  distritos(opts: { q?: string } = {}) {
    const q = (opts.q ?? '').trim();
    if (q.length < 2) return of([] as Distrito[]);
    return of([
      {
        distritoid: 1219,
        nombre: 'JOSE LEONARDO ORTIZ',
        provinciaid: 124,
        provincia: 'CHICLAYO',
        departamentoid: 13,
        departamento: 'LAMBAYEQUE',
        ubigeo: '140102',
      },
    ] as Distrito[]);
  }
}

class TipoEmpresaApiMock {
  /** Cuando es true, el catálogo de tipos falla: sirve para la regresión de abajo. */
  fallar = false;

  list() {
    if (this.fallar) return throwError(() => new Error('500'));
    return of([
      { tipoempresaid: 1, nombre: 'TIENDA COMERCIAL' },
      { tipoempresaid: 2, nombre: 'ALMACEN' },
    ] as never);
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

async function setup(api = new AlmacenApiMock(), tipos = new TipoEmpresaApiMock()) {
  const referencia = new ReferenciaApiMock();
  const confirm = new ConfirmServiceMock();
  const notify = new NotificationServiceMock();

  TestBed.configureTestingModule({
    imports: [AlmacenListPage],
    providers: [
      provideRouter([]),
      { provide: AlmacenApi, useValue: api },
      { provide: ReferenciaApi, useValue: referencia },
      { provide: TipoEmpresaApi, useValue: tipos },
      { provide: ConfirmService, useValue: confirm },
      { provide: NotificationService, useValue: notify },
    ],
  });

  const fixture = TestBed.createComponent(AlmacenListPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return {
    fixture,
    api,
    referencia,
    tipos,
    confirm,
    notify,
    el: fixture.nativeElement as HTMLElement,
  };
}

async function asentar(fixture: { whenStable(): Promise<unknown>; detectChanges(): void }) {
  for (let i = 0; i < 4; i++) {
    await fixture.whenStable();
    fixture.detectChanges();
  }
}

function comp(fixture: { componentInstance: unknown }) {
  return fixture.componentInstance as unknown as Record<string, (...a: never[]) => unknown> & {
    filters: { patchValue(v: unknown): void };
    form: { patchValue(v: unknown): void; getRawValue(): AlmacenInput; valid: boolean };
    columns: { key: string; sortable?: boolean }[];
    rows(): Almacen[];
    rowsPagina(): Almacen[];
    modalAbierto(): boolean;
    tituloModal(): string;
    filtrando(): boolean;
    unidadesForm(): { unidadnegocioid: number }[];
    tiposEmpresa(): { tipoempresaid: number }[];
    opcionesDistrito(): { distritoid: number; etiqueta: string }[];
    meta(): { page: number; pageSize: number; total: number; totalPages: number };
    detallePersonas(row: Almacen): string;
    onApply(): void;
    onPage(n: number): void;
    onPageSize(n: number): void;
    onTipoEmpresaCambio(v: number): void;
  };
}

function ultima(api: AlmacenApiMock): AlmacenFiltros {
  return api.consultas[api.consultas.length - 1];
}

describe('AlmacenListPage', () => {
  it('pinta lo que devuelve el backend', async () => {
    const { fixture } = await setup();
    expect(comp(fixture).rows()).toHaveLength(2);
  });

  // ── El reparto de trabajo ────────────────────────────────────────────
  it('manda al SERVIDOR los cuatro filtros que el stored procedure acepta', async () => {
    const { fixture, api } = await setup();
    const c = comp(fixture);

    c.filters.patchValue({ q: '  centro  ', zonaid: 2, unidadnegocioid: 2, tipoempresaid: 2 });
    c.onApply();
    await asentar(fixture);

    // El texto se recorta antes de salir.
    expect(ultima(api)).toEqual({
      q: 'centro',
      zonaid: 2,
      unidadnegocioid: 2,
      tipoempresaid: 2,
    });
    expect(c.rows()).toHaveLength(1);
    expect(c.rows()[0].nombre).toBe('TIENDA CENTRO');
  });

  /**
   * ⚠ La regresión que motiva las dos señales separadas. `estado` NO viaja al backend, así que
   * cambiarlo no puede provocar una petición idéntica a la anterior.
   */
  it('cambiar SOLO el estado no dispara una nueva petición', async () => {
    const { fixture, api } = await setup();
    const c = comp(fixture);
    expect(api.consultas).toHaveLength(1);

    c.filters.patchValue({ estado: 'inactivos' });
    c.onApply();
    await asentar(fixture);
    expect(api.consultas).toHaveLength(1);

    c.filters.patchValue({ estado: 'activos' });
    c.onApply();
    await asentar(fixture);
    expect(api.consultas).toHaveLength(1);
  });

  it('reaplicar los MISMOS filtros de servidor tampoco vuelve a pedir', async () => {
    const { fixture, api } = await setup();
    const c = comp(fixture);

    c.filters.patchValue({ q: 'centro' });
    c.onApply();
    await asentar(fixture);
    expect(api.consultas).toHaveLength(2);

    c.onApply(); // mismo texto: no hay nada nuevo que preguntar
    await asentar(fixture);
    expect(api.consultas).toHaveLength(2);
  });

  it('el filtro de estado se resuelve en el CLIENTE sobre lo que ya está cargado', async () => {
    const { fixture } = await setup();
    const c = comp(fixture);

    c.filters.patchValue({ estado: 'inactivos' });
    c.onApply();
    await asentar(fixture);

    expect(c.rows()).toHaveLength(1);
    expect(c.rows()[0].almacenid).toBe(2);
  });

  it('desactivar un local NO lo saca del listado con el estado en «Todos»', async () => {
    const api = new AlmacenApiMock();
    api.estadoResultante = false;
    const { fixture } = await setup(api);

    await (comp(fixture)['onToggleEstado'] as (r: Almacen) => Promise<void>)(
      comp(fixture).rows()[0],
    );
    await asentar(fixture);

    // El stored procedure devuelve activos e inactivos: la fila sigue ahí, en gris.
    expect(comp(fixture).rows()).toHaveLength(2);
    expect(comp(fixture).rows()[0].estado).toBe(false);
  });

  // ── Paginación (cliente) ─────────────────────────────────────────────
  it('pagina en el cliente: el endpoint devuelve el listado entero, sin meta', async () => {
    const { fixture } = await setup();
    const c = comp(fixture);

    c.onPageSize(1);
    await asentar(fixture);
    expect(c.rowsPagina()).toHaveLength(1);
    expect(c.meta().totalPages).toBe(2);
  });

  // ── Arrastre ─────────────────────────────────────────────────────────
  it('apaga el arrastre con cualquiera de los cinco filtros puesto', async () => {
    const { fixture } = await setup();
    const c = comp(fixture);
    expect(c.filtrando()).toBe(false);

    for (const filtro of [
      { q: 'centro' },
      { zonaid: 2 },
      { unidadnegocioid: 2 },
      { tipoempresaid: 2 },
      { estado: 'inactivos' },
    ]) {
      c.filters.patchValue({ q: '', zonaid: 0, unidadnegocioid: 0, tipoempresaid: 0, estado: 'todas' });
      c.onApply();
      await asentar(fixture);

      c.filters.patchValue(filtro);
      c.onApply();
      await asentar(fixture);
      expect(c.filtrando()).toBe(true);
    }
  });

  it('reordena mandando la lista completa desde la posición 1', async () => {
    const { fixture, api } = await setup();
    const filas = comp(fixture).rows();

    await (comp(fixture)['onReorder'] as (f: Almacen[]) => Promise<void>)([filas[1], filas[0]]);
    await asentar(fixture);

    expect(api.reordenes[0]).toEqual({ ids: [2, 1], desde: 1 });
  });

  // ── Selectores encadenados ───────────────────────────────────────────
  it('acota las unidades de negocio al tipo de empresa y limpia la elegida', async () => {
    const { fixture } = await setup();
    const c = comp(fixture);

    (c['onNuevo'] as () => void)();
    c.form.patchValue({ unidadnegocioid: 1 });

    c.onTipoEmpresaCambio(2);
    await asentar(fixture);

    // La unidad anterior era del tipo 1: dejarla mandaría al backend una combinación que no
    // existe.
    expect(c.form.getRawValue().unidadnegocioid).toBe(0);
    expect(c.unidadesForm()).toHaveLength(1);
    expect(c.unidadesForm()[0].unidadnegocioid).toBe(2);
  });

  // ── Edición ──────────────────────────────────────────────────────────
  it('editar SÍ pide la ficha: `nombre_comercial` no viene en el listado', async () => {
    const { fixture, api } = await setup();
    const c = comp(fixture);

    await (c['onEditar'] as (r: Almacen) => Promise<void>)(c.rows()[0]);
    await asentar(fixture);

    // Sin la ficha, guardar borraría el nombre comercial sin que el usuario lo viera.
    expect(api.fichasPedidas).toEqual([1]);
    expect(c.form.getRawValue().nombre_comercial).toBe('NOMBRE COMERCIAL DE LA FICHA');
    expect(c.tituloModal()).toBe('Editar local');
  });

  it('el modal se abre en cuanto se pulsa editar, sin esperar a la ficha', async () => {
    const { fixture } = await setup();
    const c = comp(fixture);

    const pendiente = (c['onEditar'] as (r: Almacen) => Promise<void>)(c.rows()[0]);
    expect(c.modalAbierto()).toBe(true);
    expect(c.form.getRawValue().nombre).toBe('ALMACEN PRINCIPAL');
    await pendiente;
  });

  it('al editar deja el distrito ya elegible aunque no se haya buscado nada', async () => {
    const { fixture } = await setup();
    const c = comp(fixture);

    await (c['onEditar'] as (r: Almacen) => Promise<void>)(c.rows()[0]);
    await asentar(fixture);

    expect(c.opcionesDistrito()[0].etiqueta).toBe('JOSE LEONARDO ORTIZ (CHICLAYO, LAMBAYEQUE)');
  });

  it('tras guardar RECARGA en vez de parchear con la ficha', async () => {
    const { fixture, api } = await setup();
    const c = comp(fixture);
    const antes = api.consultas.length;

    (c['onNuevo'] as () => void)();
    c.form.patchValue({
      nombre: 'LOCAL NUEVO',
      nombre_comercial: '',
      abreviatura: '',
      tipoempresaid: 1,
      unidadnegocioid: 1,
      zonaid: 1,
      distritoid: 1219,
      direccion: '',
      telefono: '',
      email: '',
      web: '',
    });
    await (c['onGuardar'] as () => Promise<void>)();
    await asentar(fixture);

    expect(api.creados).toHaveLength(1);
    // La ficha no trae orden, empresa ni contadores de personal: parchear dejaría huecos.
    expect(api.consultas.length).toBe(antes + 1);
  });

  it('un formulario sin los cuatro catálogos no llega al backend', async () => {
    const { fixture, api } = await setup();
    const c = comp(fixture);

    (c['onNuevo'] as () => void)();
    c.form.patchValue({ nombre: 'SIN CATALOGOS' }); // zona, unidad, tipo y distrito en 0
    await (c['onGuardar'] as () => Promise<void>)();
    await asentar(fixture);

    expect(api.creados).toHaveLength(0);
    expect(c.modalAbierto()).toBe(true);
  });

  // ── Datos derivados del legacy ───────────────────────────────────────
  it('limpia el marcado del legacy del detalle de personal', async () => {
    const { fixture } = await setup();
    const c = comp(fixture);

    // La base devuelve `Fredd Lopez y [1]22[/1] personas más`: el PHP pintaba esos corchetes
    // como una etiqueta. Aquí se conserva el texto y se tiran los corchetes.
    expect(c.detallePersonas(c.rows()[0])).toBe('Fredd Lopez y 22 personas más');
  });

  it('un local sin empresa asignada se anuncia, no se deja en blanco', async () => {
    const { el } = await setup();
    // `empresaid` 0 es normal: la empresa sale de una N:M y el local de producción no la tiene.
    expect(el.textContent).toContain('Sin empresa asignada');
  });

  // ── Eliminación ──────────────────────────────────────────────────────
  it('avisa de lo que el borrado arrastra antes de confirmar', async () => {
    const { fixture, confirm } = await setup();
    const c = comp(fixture);

    await (c['onEliminar'] as (r: Almacen) => Promise<void>)(c.rows()[0]);
    await asentar(fixture);

    const msg = confirm.preguntas[0].message ?? '';
    expect(msg).toContain('23 persona(s)');
    // El stored procedure limpia catorce satélites: el usuario tiene que saberlo.
    expect(msg).toContain('series');
  });

  it('cancelar la confirmación no elimina nada', async () => {
    const { fixture, api, confirm } = await setup();
    confirm.respuesta = false;

    await (comp(fixture)['onEliminar'] as (r: Almacen) => Promise<void>)(comp(fixture).rows()[0]);
    await asentar(fixture);

    expect(api.eliminados).toHaveLength(0);
  });

  // ── Lo que esta pantalla NO tiene ────────────────────────────────────
  it('la grilla NO es seleccionable: no hay borrado en lote', async () => {
    const { el } = await setup();
    expect(el.querySelectorAll('tbody input[type="checkbox"]')).toHaveLength(0);
  });

  it('ninguna columna es ordenable: el orden es un dato editable, no una vista', async () => {
    const { fixture } = await setup();
    expect(comp(fixture).columns.every((col) => !col.sortable)).toBe(true);
  });

  /**
   * ⚠ Regresión vista EN VIVO. Un `resource` en estado de error **lanza**
   * `ResourceValueError` al leer `value()`, y como eso ocurre durante el render, un catálogo
   * auxiliar caído se llevaba por delante la pantalla entera: sin grilla y sin aviso.
   *
   * Que un desplegable no cargue tiene que degradar ese desplegable, nada más.
   */
  it('si un catálogo de apoyo falla, la pantalla sigue en pie', async () => {
    const tipos = new TipoEmpresaApiMock();
    tipos.fallar = true;
    const { fixture, el } = await setup(new AlmacenApiMock(), tipos);
    const c = comp(fixture);

    expect(c.rows()).toHaveLength(2); // el listado se pinta igual
    expect(el.querySelectorAll('tbody tr').length).toBe(2);
    expect(c.tiposEmpresa()).toEqual([]); // solo se degrada el desplegable
  });
});
