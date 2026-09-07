import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { TipMovCajaApi } from '@phoenix/tesoreria/data-access';
import type {
  TipMovCaja,
  TipMovCajaFiltros,
  TipMovCajaInput,
} from '@phoenix/tesoreria/domain';
import { ConfirmService, NotificationService } from '@phoenix/shared/ui';
import { TipMovCajaListPage } from './tipmovcaja-list-page';

function fila(over: Partial<TipMovCaja> = {}): TipMovCaja {
  return {
    tipoid: 1,
    nombre: 'VENTA',
    abreviatura: 'VEN',
    tipo: 'I',
    estructura: 'CAJA',
    pcgr_general: '101',
    pcgr_empresarial: '1011',
    requiere: '',
    requerir_mesanio: false,
    estado: true,
    ...over,
  };
}

/**
 * Doble del API.
 *
 * ⚠ `list` FILTRA, al contrario que en las demás pantallas del bloque: aquí los filtros van al
 * servidor. El doble replica ese comportamiento para que los tests de filtrado prueben lo que
 * de verdad pasa —una recarga del recurso— y no un `filter` en memoria que no existe.
 */
class TipMovCajaApiMock {
  rows: TipMovCaja[] = [
    fila(),
    fila({ tipoid: 2, nombre: 'VIATICOS', abreviatura: 'VIA', tipo: 'S', requerir_mesanio: true }),
  ];

  readonly consultas: TipMovCajaFiltros[] = [];
  readonly alternados: number[] = [];
  readonly mesAnioAlternados: number[] = [];
  readonly eliminados: number[] = [];
  readonly creados: TipMovCajaInput[] = [];
  readonly actualizados: { id: number; input: TipMovCajaInput }[] = [];
  readonly lotes: readonly number[][] = [];
  loteResultado: { tipoid: number; ok: boolean; mensaje?: string }[] | null = null;

  estadoResultante = false;
  mesAnioResultante = true;
  fallar = false;

  list(filtros: TipMovCajaFiltros = {}) {
    this.consultas.push({ ...filtros });
    let out = this.rows;
    if (filtros.tipo) out = out.filter((r) => r.tipo === filtros.tipo);
    if (filtros.estado) out = out.filter((r) => r.estado === (filtros.estado === 'Y'));
    if (filtros.nombre?.trim()) {
      const q = filtros.nombre.trim().toLowerCase();
      out = out.filter((r) => r.nombre.toLowerCase().includes(q));
    }
    return of(out);
  }

  create(input: TipMovCajaInput) {
    this.creados.push(input);
    if (this.fallar) return throwError(() => new Error('409'));
    return of(fila({ tipoid: 99, ...input }));
  }

  update(id: number, input: TipMovCajaInput) {
    this.actualizados.push({ id, input });
    if (this.fallar) return throwError(() => new Error('409'));
    const previo = this.rows.find((r) => r.tipoid === id);
    return of(fila({ ...previo, tipoid: id, ...input }));
  }

  remove(id: number) {
    this.eliminados.push(id);
    if (this.fallar) return throwError(() => new Error('409'));
    return of(undefined as unknown as void);
  }

  alternarEstado(tipoid: number) {
    this.alternados.push(tipoid);
    if (this.fallar) return throwError(() => new Error('500'));
    return of({ tipoid, estado: this.estadoResultante });
  }

  alternarRequerirMesAnio(tipoid: number) {
    this.mesAnioAlternados.push(tipoid);
    if (this.fallar) return throwError(() => new Error('500'));
    return of({ tipoid, requerir_mesanio: this.mesAnioResultante });
  }

  removeLote(ids: readonly number[]) {
    (this.lotes as number[][]).push([...ids]);
    if (this.fallar) return throwError(() => new Error('500'));
    return of(this.loteResultado ?? ids.map((tipoid) => ({ tipoid, ok: true })));
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

async function setup(api = new TipMovCajaApiMock()) {
  const confirm = new ConfirmServiceMock();
  const notify = new NotificationServiceMock();

  TestBed.configureTestingModule({
    imports: [TipMovCajaListPage],
    providers: [
      provideRouter([]),
      { provide: TipMovCajaApi, useValue: api },
      { provide: ConfirmService, useValue: confirm },
      { provide: NotificationService, useValue: notify },
    ],
  });

  const fixture = TestBed.createComponent(TipMovCajaListPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, api, confirm, notify, el: fixture.nativeElement as HTMLElement };
}

/** Deja correr las promesas encadenadas y la recarga del recurso. */
async function asentar(fixture: { whenStable(): Promise<unknown>; detectChanges(): void }) {
  for (let i = 0; i < 4; i++) {
    await fixture.whenStable();
    fixture.detectChanges();
  }
}

function comp(fixture: { componentInstance: unknown }) {
  return fixture.componentInstance as unknown as Record<string, (...a: never[]) => unknown> & {
    filters: { patchValue(v: unknown): void };
    form: { patchValue(v: unknown): void; getRawValue(): TipMovCajaInput };
    rows(): TipMovCaja[];
    modalAbierto(): boolean;
    tituloModal(): string;
    seleccionadas(): { tipoid: number }[];
    onExportar(e: { formato: string; detalle: boolean }): void;
    onCerrar(): void;
    onPage(n: number): void;
    meta(): { page: number; pageSize: number; total: number; totalPages: number };
  };
}

function celdas(el: HTMLElement, colIndex: number): string[] {
  // +1: la primera celda es el checkbox de selección.
  return Array.from(el.querySelectorAll('tbody tr')).map(
    (tr) => tr.querySelectorAll('td')[colIndex + 1]?.textContent?.trim() ?? '',
  );
}

describe('TipMovCajaListPage', () => {
  beforeEach(() => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    URL.createObjectURL = vi.fn(() => 'blob:test');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('pinta el catálogo que devuelve el backend', async () => {
    const { el } = await setup();
    expect(el.querySelectorAll('tbody tr').length).toBe(2);
    expect(celdas(el, 0)).toEqual(['VENTA', 'VIATICOS']);
  });

  it('pinta el tipo con su etiqueta, no con la letra', async () => {
    const { el } = await setup();
    expect(celdas(el, 2)).toEqual(['Ingreso', 'Salida']);
  });

  it('no ofrece columna de orden ni arrastre: la tabla no tiene `orden`', async () => {
    // Es la única del bloque sin esa columna, así que la grilla no es reordenable.
    const { el } = await setup();
    const cabeceras = Array.from(el.querySelectorAll('thead th')).map((th) =>
      th.textContent?.trim(),
    );
    expect(cabeceras).not.toContain('#');
    expect(el.querySelector('.dragHandle')).toBeNull();
  });

  it('los filtros van al SERVIDOR: buscar recarga el recurso con los parámetros', async () => {
    // No se filtra en memoria como en las demás pantallas del bloque. Y el filtro de tipo usa
    // S para las salidas, que es lo que la tabla guarda: el stored procedure del legacy espera
    // E y por eso allí no devuelve nada.
    const { fixture, api } = await setup();
    const c = comp(fixture);
    expect(api.consultas).toEqual([{ nombre: '', tipo: '', estado: '' }]);

    c.filters.patchValue({ tipo: 'S' });
    c.onApply();
    await asentar(fixture);

    expect(api.consultas.at(-1)).toEqual({ nombre: '', tipo: 'S', estado: '' });
    expect(c.rows().map((r) => r.tipoid)).toEqual([2]);
  });

  it('el filtro de nombre también viaja al servidor', async () => {
    const { fixture, api } = await setup();
    const c = comp(fixture);

    c.filters.patchValue({ nombre: 'viati' });
    c.onApply();
    await asentar(fixture);

    expect(api.consultas.at(-1)?.nombre).toBe('viati');
    expect(c.rows().map((r) => r.tipoid)).toEqual([2]);
  });

  it('alterna el estado y se queda con el valor que devuelve el backend', async () => {
    const api = new TipMovCajaApiMock();
    api.estadoResultante = false;
    const { fixture } = await setup(api);
    const c = comp(fixture);

    c.onToggleEstado(fila() as never);
    await asentar(fixture);

    expect(api.alternados).toEqual([1]);
    expect(c.rows()[0].estado).toBe(false);
  });

  it('alterna «mes/año» por su propia ruta, sin tocar el estado', async () => {
    // Es el SEGUNDO interruptor del recurso: el legacy le dedica una función aparte y también
    // es un toggle.
    const api = new TipMovCajaApiMock();
    api.mesAnioResultante = true;
    const { fixture } = await setup(api);
    const c = comp(fixture);

    c.onToggleRequerirMesAnio(fila() as never);
    await asentar(fixture);

    expect(api.mesAnioAlternados).toEqual([1]);
    expect(api.alternados).toEqual([]);
    expect(c.rows()[0].requerir_mesanio).toBe(true);
    expect(c.rows()[0].estado).toBe(true);
  });

  it('revierte «mes/año» si el backend falla', async () => {
    const api = new TipMovCajaApiMock();
    api.fallar = true;
    const { fixture } = await setup(api);
    const c = comp(fixture);

    c.onToggleRequerirMesAnio(fila() as never);
    await asentar(fixture);

    expect(c.rows()[0].requerir_mesanio).toBe(false);
  });

  it('el alta manda solo los cuatro campos del formulario', async () => {
    // Ni estado ni mes/año —cada uno tiene su ruta— ni estructura o las cuentas contables,
    // que el backend conserva solas.
    const { fixture, api, notify } = await setup();
    const c = comp(fixture);

    c.onNuevo();
    c.form.patchValue({ tipo: 'S', nombre: 'PASAJES', abreviatura: 'PAS', requiere: 'SUBDPTO' });
    c.onGuardar();
    await asentar(fixture);

    expect(api.creados).toEqual([
      { tipo: 'S', nombre: 'PASAJES', abreviatura: 'PAS', requiere: 'SUBDPTO' },
    ]);
    expect(c.modalAbierto()).toBe(false);
    expect(notify.exitos.length).toBe(1);
  });

  it('el formulario no ofrece estado, mes/año ni las columnas contables', async () => {
    const { fixture, el } = await setup();
    const c = comp(fixture);

    c.onNuevo();
    fixture.detectChanges();

    expect(c.form.getRawValue()).toEqual({
      tipo: 'I',
      nombre: '',
      abreviatura: '',
      requiere: '',
    });
    for (const campo of [
      'estado',
      'requerir_mesanio',
      'estructura',
      'pcgr_general',
      'pcgr_empresarial',
    ]) {
      expect(el.querySelector(`erp-modal [formControlName="${campo}"]`)).toBeNull();
    }
  });

  it('el alta arranca en «ingreso» y no en vacío', async () => {
    const { fixture } = await setup();
    const c = comp(fixture);

    c.onNuevo();
    expect(c.form.getRawValue().tipo).toBe('I');
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

  it('editar precarga los campos editables y manda un PUT', async () => {
    const { fixture, api } = await setup();
    const c = comp(fixture);

    c.onEditar(fila() as never);
    expect(c.tituloModal()).toBe('Editar tipo de movimiento');
    expect(c.form.getRawValue()).toEqual({
      tipo: 'I',
      nombre: 'VENTA',
      abreviatura: 'VEN',
      requiere: '',
    });

    c.form.patchValue({ nombre: 'VENTA EDITADA' });
    c.onGuardar();
    await asentar(fixture);

    expect(api.actualizados.length).toBe(1);
    expect(api.actualizados[0].input.nombre).toBe('VENTA EDITADA');
  });

  it('la edición no manda las columnas que el backend conserva', async () => {
    // El legacy las borra en cada guardado porque su formulario las tiene comentadas y su
    // ajax manda cadena vacía. Aquí ni siquiera viajan.
    const { fixture, api } = await setup();
    const c = comp(fixture);

    c.onEditar(fila() as never);
    c.form.patchValue({ nombre: 'VENTA EDITADA' });
    c.onGuardar();
    await asentar(fixture);

    const enviado = api.actualizados[0].input as Record<string, unknown>;
    for (const campo of ['estructura', 'pcgr_general', 'pcgr_empresarial', 'estado', 'requerir_mesanio']) {
      expect(enviado).not.toHaveProperty(campo);
    }
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
    expect(c.rows().map((r) => r.tipoid)).toEqual([2]);
  });

  it('el borrado en lote va en UNA petición y quita las filas', async () => {
    const { fixture, api } = await setup();
    const c = comp(fixture);

    c.onSeleccion([{ tipoid: 1 }, { tipoid: 2 }] as never);
    c.onEliminarSeleccionadas();
    await asentar(fixture);

    expect(api.lotes).toEqual([[1, 2]]);
    expect(c.rows()).toEqual([]);
  });

  it('el lote es parcial: conserva las filas que fallaron', async () => {
    const api = new TipMovCajaApiMock();
    api.loteResultado = [
      { tipoid: 1, ok: true },
      { tipoid: 2, ok: false, mensaje: 'Tiene movimientos relacionados.' },
    ];
    const { fixture, notify } = await setup(api);
    const c = comp(fixture);

    c.onSeleccion([{ tipoid: 1 }, { tipoid: 2 }] as never);
    c.onEliminarSeleccionadas();
    await asentar(fixture);

    expect(c.rows().map((r) => r.tipoid)).toEqual([2]);
    expect(notify.errores.length).toBe(1);
  });

  it('lleva un único menú —Exportar— y el botón de cerrar en la cabecera', async () => {
    const { el } = await setup();
    expect(el.querySelectorAll('erp-export-menu').length).toBe(1);
    expect(el.querySelector('.btn-cerrar')).not.toBeNull();
    expect(el.querySelector('erp-file-viewer')).toBeNull();
  });

  it('exporta lo que se está viendo', async () => {
    const anchor = vi.spyOn(HTMLAnchorElement.prototype, 'click');
    const { fixture } = await setup();
    comp(fixture).onExportar({ formato: 'csv', detalle: false });
    expect(anchor).toHaveBeenCalled();
  });

  it('sin historia previa, cerrar vuelve al índice de tablas básicas', async () => {
    const { fixture } = await setup();
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    comp(fixture).onCerrar();

    expect(navigate).toHaveBeenCalledWith(['/mantenimiento/tablas-basicas']);
  });

  it('pagina en cliente sobre lo que devuelve el filtro del servidor', async () => {
    const api = new TipMovCajaApiMock();
    api.rows = Array.from({ length: 30 }, (_, i) =>
      fila({ tipoid: i + 1, nombre: `TIPO ${i + 1}` }),
    );
    const { fixture, el } = await setup(api);
    const c = comp(fixture);

    expect(c.meta()).toMatchObject({ total: 30, pageSize: 25, totalPages: 2 });
    expect(el.querySelectorAll('tbody tr').length).toBe(25);

    c.onPage(2);
    fixture.detectChanges();
    expect(el.querySelectorAll('tbody tr').length).toBe(5);
  });
});
