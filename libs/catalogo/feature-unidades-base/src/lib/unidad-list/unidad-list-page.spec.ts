import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { UnidadApi } from '@phoenix/catalogo/data-access';
import type { Unidad, UnidadFiltros, UnidadInput } from '@phoenix/catalogo/domain';
import { ConfirmService, NotificationService } from '@phoenix/shared/ui';
import { UnidadListPage } from './unidad-list-page';

function fila(over: Partial<Unidad> = {}): Unidad {
  return {
    unidadid: 1,
    nombre: 'KILOGRAMOS',
    abreviatura: 'KG',
    codigo_contable: '01',
    codigo_internacional: 'KGM',
    estado: true,
    ...over,
  };
}

/**
 * Doble del API.
 *
 * ⚠ `list` FILTRA, porque en esta pantalla los filtros van al SERVIDOR. El doble replica ese
 * comportamiento —y registra cada consulta en `consultas`— para que los tests de filtrado
 * prueben lo que de verdad pasa (una recarga del recurso) y no un `filter` en memoria que no
 * existe.
 */
class UnidadApiMock {
  rows: Unidad[] = [
    fila(),
    fila({
      unidadid: 2,
      nombre: 'TONELADAS',
      abreviatura: 'TN',
      codigo_contable: '02',
      codigo_internacional: 'TNE',
    }),
  ];

  readonly consultas: UnidadFiltros[] = [];
  readonly alternados: number[] = [];
  readonly eliminados: number[] = [];
  readonly creados: UnidadInput[] = [];
  readonly actualizados: { id: number; input: UnidadInput }[] = [];
  readonly lotes: readonly number[][] = [];
  /** Resultado por id del lote; por defecto todo OK. */
  loteResultado: { unidadid: number; ok: boolean; mensaje?: string }[] | null = null;

  /** Estado que devuelve `alternarEstado` (el contrato manda el resultante). */
  estadoResultante = false;
  /** Cuando es true, las mutaciones fallan: sirve para probar la reversión optimista. */
  fallar = false;

  list(filtros: UnidadFiltros = {}) {
    this.consultas.push({ ...filtros });
    let out = this.rows;
    // El backend sólo sabe ensanchar el alcance, nunca invertirlo: sin `incluir_inactivas`
    // devuelve las activas, con él devuelve TODAS.
    if (!filtros.incluir_inactivas) out = out.filter((r) => r.estado);
    if (filtros.q?.trim()) {
      const q = filtros.q.trim().toLowerCase();
      out = out.filter((r) => r.nombre.toLowerCase().includes(q));
    }
    return of(out);
  }

  create(input: UnidadInput) {
    this.creados.push(input);
    if (this.fallar) return throwError(() => new Error('409'));
    return of(fila({ unidadid: 99, ...input }));
  }

  update(id: number, input: UnidadInput) {
    this.actualizados.push({ id, input });
    if (this.fallar) return throwError(() => new Error('409'));
    // El PUT no lleva estado, así que la respuesta conserva el previo.
    const previo = this.rows.find((row) => row.unidadid === id);
    return of(fila({ ...previo, unidadid: id, ...input }));
  }

  remove(id: number) {
    this.eliminados.push(id);
    if (this.fallar) return throwError(() => new Error('409'));
    return of(undefined as unknown as void);
  }

  alternarEstado(unidadid: number) {
    this.alternados.push(unidadid);
    if (this.fallar) return throwError(() => new Error('500'));
    return of({ unidadid, estado: this.estadoResultante });
  }

  removeLote(ids: readonly number[]) {
    (this.lotes as number[][]).push([...ids]);
    if (this.fallar) return throwError(() => new Error('500'));
    return of(this.loteResultado ?? ids.map((unidadid) => ({ unidadid, ok: true })));
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

async function setup(api = new UnidadApiMock()) {
  const confirm = new ConfirmServiceMock();
  const notify = new NotificationServiceMock();

  TestBed.configureTestingModule({
    imports: [UnidadListPage],
    providers: [
      // `erp-page-header` monta los breadcrumbs, que leen la ruta activa.
      provideRouter([]),
      { provide: UnidadApi, useValue: api },
      { provide: ConfirmService, useValue: confirm },
      { provide: NotificationService, useValue: notify },
    ],
  });

  const fixture = TestBed.createComponent(UnidadListPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, api, confirm, notify, el: fixture.nativeElement as HTMLElement };
}

/** Deja correr las promesas encadenadas (confirmación → petición → notificación) y la recarga. */
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
    form: { patchValue(v: unknown): void; getRawValue(): UnidadInput };
    rows(): Unidad[];
    modalAbierto(): boolean;
    tituloModal(): string;
    seleccionadas(): { unidadid: number }[];
    onExportar(e: { formato: string; detalle: boolean }): void;
    onCerrar(): void;
    onPageSize(n: number): void;
    onPage(n: number): void;
    rowsPagina(): Unidad[];
    meta(): { page: number; pageSize: number; total: number; totalPages: number };
  };
}

function celdas(el: HTMLElement, colIndex: number): string[] {
  // +1: la primera celda es el checkbox de selección.
  return Array.from(el.querySelectorAll('tbody tr')).map(
    (tr) => tr.querySelectorAll('td')[colIndex + 1]?.textContent?.trim() ?? '',
  );
}

describe('UnidadListPage', () => {
  // La descarga crea un <a download> y lo pulsa. jsdom no implementa la navegación que eso
  // provoca y escupe un "Not implemented" por consola que no es un fallo, solo ruido.
  beforeEach(() => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    // No se sustituye `URL` entera (Angular la usa): solo estos dos métodos, que jsdom
    // no trae y por eso se asignan en vez de espiarse.
    URL.createObjectURL = vi.fn(() => 'blob:test');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('pinta el catálogo que devuelve el backend', async () => {
    const { el } = await setup();
    expect(el.querySelectorAll('tbody tr').length).toBe(2);
    expect(celdas(el, 0)).toEqual(['KILOGRAMOS', 'TONELADAS']);
  });

  it('pinta los dos códigos, cada uno en su columna', async () => {
    // Son los que distinguen esta pantalla de sus hermanas: contable e internacional (SUNAT).
    const { el } = await setup();
    expect(celdas(el, 2)).toEqual(['01', '02']);
    expect(celdas(el, 3)).toEqual(['KGM', 'TNE']);
  });

  it('no ofrece columna de orden ni arrastre: la tabla no tiene `orden`', async () => {
    // `catalogo.unidad` no tiene esa columna —al revés que `unidadmedida`—, así que no hay
    // columna `#`, ni `PATCH /orden`, ni grilla reordenable.
    const { el } = await setup();
    const cabeceras = Array.from(el.querySelectorAll('thead th')).map((th) =>
      th.textContent?.trim(),
    );
    expect(cabeceras).toEqual([
      '',
      'Nombre',
      'Abreviatura',
      'ID contable',
      'ID internacional',
      'Estado',
      'Acciones',
    ]);
    expect(el.querySelector('th.col-reorder')).toBeNull();
  });

  it('el filtro de texto va al SERVIDOR: buscar recarga el recurso con el parámetro', async () => {
    // No se filtra en memoria: el stored procedure lo resuelve con `public.buscar()`.
    const { fixture, api } = await setup();
    const c = comp(fixture);
    expect(api.consultas).toEqual([{ q: '', incluir_inactivas: false }]);

    c.filters.patchValue({ q: 'tonel' });
    c.onApply();
    await asentar(fixture);

    expect(api.consultas.at(-1)).toEqual({ q: 'tonel', incluir_inactivas: false });
    expect(c.rows().map((r) => r.unidadid)).toEqual([2]);
  });

  it('«Todas» manda incluir_inactivas al servidor', async () => {
    const api = new UnidadApiMock();
    api.rows = [fila(), fila({ unidadid: 2, nombre: 'TONELADAS', estado: false })];
    const { fixture } = await setup(api);
    const c = comp(fixture);
    // Por defecto sólo llegan las activas.
    expect(c.rows().map((r) => r.unidadid)).toEqual([1]);

    c.filters.patchValue({ alcance: 'todas' });
    c.onApply();
    await asentar(fixture);

    expect(api.consultas.at(-1)).toEqual({ q: '', incluir_inactivas: true });
    expect(c.rows().map((r) => r.unidadid)).toEqual([1, 2]);
  });

  it('«Inactivas» es un híbrido: pide todas al servidor y descarta las activas en cliente', async () => {
    // El backend no sabe filtrar "sólo inactivas": `incluir_inactivas` ensancha el alcance,
    // no lo invierte. Como el endpoint devuelve el catálogo entero, el descarte sale gratis.
    const api = new UnidadApiMock();
    api.rows = [fila(), fila({ unidadid: 2, nombre: 'TONELADAS', estado: false })];
    const { fixture } = await setup(api);
    const c = comp(fixture);

    c.filters.patchValue({ alcance: 'inactivas' });
    c.onApply();
    await asentar(fixture);

    expect(api.consultas.at(-1)).toEqual({ q: '', incluir_inactivas: true });
    expect(c.rows().map((r) => r.unidadid)).toEqual([2]);
  });

  it('alterna el estado y se queda con el valor que devuelve el backend', async () => {
    // Es un toggle: el cliente no manda el valor deseado, pero sí lee el resultante.
    const api = new UnidadApiMock();
    api.estadoResultante = false;
    const { fixture } = await setup(api);
    const c = comp(fixture);

    c.onToggleEstado(fila() as never);
    await asentar(fixture);

    expect(api.alternados).toEqual([1]);
    expect(c.rows()[0].estado).toBe(false);
  });

  it('revierte el estado si el backend falla', async () => {
    const api = new UnidadApiMock();
    api.fallar = true;
    const { fixture } = await setup(api);
    const c = comp(fixture);

    c.onToggleEstado(fila() as never);
    await asentar(fixture);

    expect(c.rows()[0].estado).toBe(true);
  });

  it('el alta manda solo los cuatro campos del formulario', async () => {
    // `estado` no viaja: el backend lo fija activo y la grilla es su única fuente de verdad.
    const { fixture, api, notify } = await setup();
    const c = comp(fixture);

    c.onNuevo();
    c.form.patchValue({
      nombre: 'LITROS',
      abreviatura: 'L',
      codigo_contable: '03',
      codigo_internacional: 'LTR',
    });
    c.onGuardar();
    await asentar(fixture);

    expect(api.creados).toEqual([
      { nombre: 'LITROS', abreviatura: 'L', codigo_contable: '03', codigo_internacional: 'LTR' },
    ]);
    expect(c.modalAbierto()).toBe(false);
    expect(notify.exitos.length).toBe(1);
  });

  it('el formulario no ofrece estado (ni orden)', async () => {
    // ⚠ El del legacy sí pinta un switch «ACTIVO», pero no hace nada: Acceso.clsUnidad.php
    // nunca se lo pasa al stored procedure. Tenerlo aquí daría dos fuentes de verdad.
    const { fixture, el } = await setup();
    const c = comp(fixture);

    c.onNuevo();
    fixture.detectChanges();

    expect(c.form.getRawValue()).toEqual({
      nombre: '',
      abreviatura: '',
      codigo_contable: '',
      codigo_internacional: '',
    });
    expect(el.querySelector('erp-modal [formControlName="estado"]')).toBeNull();
    expect(el.querySelector('erp-modal [formControlName="orden"]')).toBeNull();
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
    const api = new UnidadApiMock();
    api.fallar = true;
    const { fixture } = await setup(api);
    const c = comp(fixture);

    c.onNuevo();
    c.form.patchValue({ nombre: 'KILOGRAMOS' });
    c.onGuardar();
    await asentar(fixture);

    expect(c.modalAbierto()).toBe(true);
    expect(c.form.getRawValue().nombre).toBe('KILOGRAMOS');
  });

  it('editar precarga los campos editables y manda un PUT', async () => {
    const { fixture, api } = await setup();
    const c = comp(fixture);

    c.onEditar(fila() as never);
    expect(c.tituloModal()).toBe('Editar unidad base');
    expect(c.form.getRawValue()).toEqual({
      nombre: 'KILOGRAMOS',
      abreviatura: 'KG',
      codigo_contable: '01',
      codigo_internacional: 'KGM',
    });

    c.form.patchValue({ nombre: 'KILOGRAMO' });
    c.onGuardar();
    await asentar(fixture);

    expect(api.actualizados.length).toBe(1);
    expect(api.actualizados[0].id).toBe(1);
    expect(api.actualizados[0].input.nombre).toBe('KILOGRAMO');
    expect(api.creados).toEqual([]);
  });

  it('la edición no cambia el estado del registro', async () => {
    // El estado no está en el formulario ni en el cuerpo: el backend conserva el que la fila
    // ya tenía. Si volviera al PUT, editar una inactiva la reactivaría.
    const api = new UnidadApiMock();
    api.rows = [fila(), fila({ unidadid: 2, nombre: 'TONELADAS', estado: false })];
    const { fixture } = await setup(api);
    const c = comp(fixture);

    c.filters.patchValue({ alcance: 'todas' });
    c.onApply();
    await asentar(fixture);

    c.onEditar(api.rows[1] as never);
    c.form.patchValue({ nombre: 'TONELADA METRICA' });
    c.onGuardar();
    await asentar(fixture);

    expect(api.actualizados[0].input).not.toHaveProperty('estado');
    expect(c.rows().map((row) => [row.unidadid, row.estado])).toEqual([
      [1, true],
      [2, false],
    ]);
  });

  it('eliminar pide confirmación antes de llamar al backend', async () => {
    const { fixture, api, confirm } = await setup();
    const c = comp(fixture);
    confirm.respuesta = false;

    c.onEliminar(fila() as never);
    await asentar(fixture);

    expect(confirm.preguntas.length).toBe(1);
    expect(api.eliminados).toEqual([]);
  });

  it('eliminar quita la fila de la lista', async () => {
    const { fixture, api } = await setup();
    const c = comp(fixture);

    c.onEliminar(fila() as never);
    await asentar(fixture);

    expect(api.eliminados).toEqual([1]);
    expect(c.rows().map((row) => row.unidadid)).toEqual([2]);
  });

  it('la grilla ofrece checkbox de selección', async () => {
    const { el } = await setup();
    expect(el.querySelectorAll('tbody input[type="checkbox"]').length).toBe(2);
  });

  it('el borrado en lote va en UNA petición y quita las filas', async () => {
    const { fixture, api } = await setup();
    const c = comp(fixture);

    c.onSeleccion([{ unidadid: 1 }, { unidadid: 2 }] as never);
    c.onEliminarSeleccionadas();
    await asentar(fixture);

    expect(api.lotes).toEqual([[1, 2]]);
    expect(c.rows()).toEqual([]);
    expect(c.seleccionadas()).toEqual([]);
  });

  it('el lote es parcial: conserva las filas que fallaron', async () => {
    // Una unidad en uso por un producto o una guía falla mientras el resto sí se borra.
    const api = new UnidadApiMock();
    api.loteResultado = [
      { unidadid: 1, ok: true },
      { unidadid: 2, ok: false, mensaje: 'Tiene productos o guías relacionados.' },
    ];
    const { fixture, notify } = await setup(api);
    const c = comp(fixture);

    c.onSeleccion([{ unidadid: 1 }, { unidadid: 2 }] as never);
    c.onEliminarSeleccionadas();
    await asentar(fixture);

    expect(c.rows().map((row) => row.unidadid)).toEqual([2]);
    expect(notify.errores.length).toBe(1);
  });

  it('lleva un único menú —Exportar— y el botón de cerrar en la cabecera', async () => {
    // Este recurso no tiene reporte PDF, así que tampoco menú Imprimir ni visor.
    const { el } = await setup();
    expect(el.querySelectorAll('erp-export-menu').length).toBe(1);
    expect(el.querySelector('.btn-cerrar')).not.toBeNull();
    expect(el.querySelector('erp-file-viewer')).toBeNull();
    expect(el.querySelector('erp-print-header')).toBeNull();
  });

  it('exporta lo que se está viendo, con el filtro aplicado', async () => {
    // El CSV se arma en el navegador con las filas ya cargadas: no se pide nada al backend.
    const anchor = vi.spyOn(HTMLAnchorElement.prototype, 'click');
    const { fixture } = await setup();
    const c = comp(fixture);

    c.filters.patchValue({ q: 'tonel' });
    c.onApply();
    await asentar(fixture);
    c.onExportar({ formato: 'csv', detalle: false });

    // La descarga la dispara `exportCsv` creando un <a> y pulsándolo.
    expect(anchor).toHaveBeenCalled();
    expect(c.rows().length).toBe(1);
  });

  it('sin historia previa, cerrar vuelve a /inicio', async () => {
    // ⚠ NO al índice de tablas básicas: esta pantalla no cuelga de ese hub, es una opción de
    // menú propia bajo «Catálogo» con su permiso `CAT-UNIDAD`.
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

  it('pagina en CLIENTE: el endpoint devuelve el catálogo entero', async () => {
    const api = new UnidadApiMock();
    api.rows = Array.from({ length: 30 }, (_, i) =>
      fila({ unidadid: i + 1, nombre: `UNIDAD ${i + 1}` }),
    );
    const { fixture, el } = await setup(api);
    const c = comp(fixture);

    expect(c.meta()).toMatchObject({ total: 30, pageSize: 25, totalPages: 2 });
    expect(el.querySelectorAll('tbody tr').length).toBe(25);
    // Una sola consulta: paginar no vuelve al servidor.
    expect(api.consultas.length).toBe(1);

    c.onPage(2);
    fixture.detectChanges();
    expect(el.querySelectorAll('tbody tr').length).toBe(5);
    expect(api.consultas.length).toBe(1);
  });

  it('el total del pie refleja el filtro, no el universo', async () => {
    const { fixture } = await setup();
    const c = comp(fixture);

    c.filters.patchValue({ q: 'tonel' });
    c.onApply();
    await asentar(fixture);

    expect(c.meta()).toMatchObject({ total: 1, page: 1 });
  });
});
