import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { TipoFormaPagoApi } from '@phoenix/tesoreria/data-access';
import type { TipoFormaPago, TipoFormaPagoInput } from '@phoenix/tesoreria/domain';
import { ConfirmService, NotificationService } from '@phoenix/shared/ui';
import { TipoFormaPagoListPage } from './tipo-forma-pago-list-page';

function fila(over: Partial<TipoFormaPago> = {}): TipoFormaPago {
  return {
    tipoformapagoid: 1,
    nombre: 'EFECTIVO',
    abreviatura: 'EFE',
    estructura: 'EFE',
    tipo: '',
    pcgr_general: '101',
    pcgr_empresarial: '1011',
    orden: 1,
    estado: true,
    ...over,
  };
}

/** Doble del API: registra lo que se le pide y devuelve lo que se le configure. */
class TipoFormaPagoApiMock {
  rows: TipoFormaPago[] = [fila(), fila({ tipoformapagoid: 2, nombre: 'TARJETA', abreviatura: 'TAR', estructura: 'TAR', tipo: '', pcgr_general: '104', pcgr_empresarial: '1041', orden: 2 })];

  readonly alternados: number[] = [];
  readonly eliminados: number[] = [];
  readonly creados: TipoFormaPagoInput[] = [];
  readonly actualizados: { id: number; input: TipoFormaPagoInput }[] = [];
  readonly reordenes: { ids: readonly number[]; desde: number }[] = [];
  readonly lotes: readonly number[][] = [];
  /** Resultado por id del lote; por defecto todo OK. */
  loteResultado: { tipoformapagoid: number; ok: boolean; mensaje?: string }[] | null = null;

  /** Estado que devuelve `alternarEstado` (el contrato manda el resultante). */
  estadoResultante = false;
  /** Cuando es true, las mutaciones fallan: sirve para probar la reversión optimista. */
  fallar = false;

  list() {
    return of(this.rows);
  }

  create(input: TipoFormaPagoInput) {
    this.creados.push(input);
    if (this.fallar) return throwError(() => new Error('409'));
    return of(fila({ tipoformapagoid: 99, ...input, orden: this.rows.length + 1 }));
  }

  update(id: number, input: TipoFormaPagoInput) {
    this.actualizados.push({ id, input });
    if (this.fallar) return throwError(() => new Error('409'));
    // El PUT no lleva estado ni orden, así que la respuesta conserva los previos.
    const previo = this.rows.find((row) => row.tipoformapagoid === id);
    return of(fila({ ...previo, tipoformapagoid: id, ...input }));
  }

  remove(id: number) {
    this.eliminados.push(id);
    if (this.fallar) return throwError(() => new Error('409'));
    return of(undefined as unknown as void);
  }

  alternarEstado(tipoformapagoid: number) {
    this.alternados.push(tipoformapagoid);
    if (this.fallar) return throwError(() => new Error('500'));
    return of({ tipoformapagoid, estado: this.estadoResultante });
  }

  reordenar(ids: readonly number[], desde = 1) {
    this.reordenes.push({ ids: [...ids], desde });
    if (this.fallar) return throwError(() => new Error('500'));
    return of(undefined as unknown as void);
  }

  removeLote(ids: readonly number[]) {
    (this.lotes as number[][]).push([...ids]);
    if (this.fallar) return throwError(() => new Error('500'));
    return of(this.loteResultado ?? ids.map((tipoformapagoid) => ({ tipoformapagoid, ok: true })));
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

async function setup(api = new TipoFormaPagoApiMock()) {
  const confirm = new ConfirmServiceMock();
  const notify = new NotificationServiceMock();

  TestBed.configureTestingModule({
    imports: [TipoFormaPagoListPage],
    providers: [
      // `erp-page-header` monta los breadcrumbs, que leen la ruta activa.
      provideRouter([]),
      { provide: TipoFormaPagoApi, useValue: api },
      { provide: ConfirmService, useValue: confirm },
      { provide: NotificationService, useValue: notify },
    ],
  });

  const fixture = TestBed.createComponent(TipoFormaPagoListPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, api, confirm, notify, el: fixture.nativeElement as HTMLElement };
}

/** Deja correr las promesas encadenadas (confirmación → petición → notificación). */
async function asentar(fixture: { whenStable(): Promise<unknown>; detectChanges(): void }) {
  for (let i = 0; i < 3; i++) {
    await fixture.whenStable();
    fixture.detectChanges();
  }
}

/** Acceso al componente sin exponer sus miembros protegidos al resto del test. */
function comp(fixture: { componentInstance: unknown }) {
  return fixture.componentInstance as unknown as Record<string, (...a: never[]) => unknown> & {
    filters: { patchValue(v: unknown): void };
    form: { patchValue(v: unknown): void; getRawValue(): TipoFormaPagoInput };
    rows(): TipoFormaPago[];
    filtrando(): boolean;
    modalAbierto(): boolean;
    tituloModal(): string;
    seleccionadas(): { tipoformapagoid: number }[];
    onExportar(e: { formato: string; detalle: boolean }): void;
    onCerrar(): void;
    onPageSize(n: number): void;
    onPage(n: number): void;
    rowsPagina(): TipoFormaPago[];
    meta(): { page: number; pageSize: number; total: number; totalPages: number };
  };
}

function celdas(el: HTMLElement, colIndex: number): string[] {
  // +1: la primera celda es el checkbox de selección.
  return Array.from(el.querySelectorAll('tbody tr')).map(
    (tr) => tr.querySelectorAll('td')[colIndex + 1]?.textContent?.trim() ?? '',
  );
}

describe('TipoFormaPagoListPage', () => {
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
  });

  it('filtra en cliente por texto: no hay endpoint al que mandar el filtro', async () => {
    const { fixture } = await setup();
    const c = comp(fixture);

    c.filters.patchValue({ q: 'tarje' });
    c.onApply();
    fixture.detectChanges();

    expect(c.rows().map((row) => row.tipoformapagoid)).toEqual([2]);
  });

  it('filtra por estado', async () => {
    const api = new TipoFormaPagoApiMock();
    api.rows = [fila(), fila({ tipoformapagoid: 2, estado: false })];
    const { fixture } = await setup(api);
    const c = comp(fixture);

    c.filters.patchValue({ estado: 'N' });
    c.onApply();
    fixture.detectChanges();

    expect(c.rows().map((row) => row.tipoformapagoid)).toEqual([2]);
  });

  it('alterna el estado y se queda con el valor que devuelve el backend', async () => {
    // Es un toggle: el cliente no manda el valor deseado, pero sí lee el resultante.
    const api = new TipoFormaPagoApiMock();
    api.estadoResultante = false;
    const { fixture } = await setup(api);
    const c = comp(fixture);

    c.onToggleEstado(fila() as never);
    await asentar(fixture);

    expect(api.alternados).toEqual([1]);
    expect(c.rows()[0].estado).toBe(false);
  });

  it('revierte el estado si el backend falla', async () => {
    const api = new TipoFormaPagoApiMock();
    api.fallar = true;
    const { fixture } = await setup(api);
    const c = comp(fixture);

    c.onToggleEstado(fila() as never);
    await asentar(fixture);

    expect(c.rows()[0].estado).toBe(true);
  });

  it('al reordenar manda la lista completa desde la posición 1 y renumera en local', async () => {
    const { fixture, api } = await setup();
    const c = comp(fixture);

    const invertido = [...c.rows()].reverse();
    c.onReorder(invertido as never);
    await asentar(fixture);

    expect(api.reordenes).toEqual([{ ids: [2, 1], desde: 1 }]);
    expect(c.rows().map((row) => [row.tipoformapagoid, row.orden])).toEqual([
      [2, 1],
      [1, 2],
    ]);
  });

  it('revierte el orden si el backend falla', async () => {
    const api = new TipoFormaPagoApiMock();
    api.fallar = true;
    const { fixture } = await setup(api);
    const c = comp(fixture);

    c.onReorder([...c.rows()].reverse() as never);
    await asentar(fixture);

    expect(c.rows().map((row) => row.tipoformapagoid)).toEqual([1, 2]);
  });

  it('desactiva el arrastre mientras haya un filtro activo', async () => {
    // Con filtro, la grilla emitiría solo las filas visibles y renumerarlas desde 1
    // machacaría el orden de las ocultas.
    const { fixture } = await setup();
    const c = comp(fixture);
    expect(c.filtrando()).toBe(false);

    c.filters.patchValue({ q: 'tarje' });
    c.onApply();
    fixture.detectChanges();

    expect(c.filtrando()).toBe(true);
  });

  it('el alta manda solo los campos del formulario', async () => {
    // `orden` y `estado` no viajan: el backend los fija él (activo, al final de la lista) y
    // cada uno tiene su propia acción en la grilla.
    const { fixture, api, notify } = await setup();
    const c = comp(fixture);

    c.onNuevo();
    c.form.patchValue({ nombre: 'CHEQUE', abreviatura: 'CHE', estructura: 'CHE', tipo: '', pcgr_general: '104', pcgr_empresarial: '1042' });
    c.onGuardar();
    await asentar(fixture);

    expect(api.creados).toEqual([{ nombre: 'CHEQUE', abreviatura: 'CHE', estructura: 'CHE', tipo: '', pcgr_general: '104', pcgr_empresarial: '1042' }]);
    expect(c.modalAbierto()).toBe(false);
    expect(notify.exitos.length).toBe(1);
  });

  it('el formulario no ofrece ni orden ni estado', async () => {
    // Tenerlos aquí daría un segundo camino para lo que ya hacen el arrastre y la etiqueta
    // de estado de la grilla.
    const { fixture, el } = await setup();
    const c = comp(fixture);

    c.onNuevo();
    fixture.detectChanges();

    expect(c.form.getRawValue()).toEqual({ nombre: '', abreviatura: '', estructura: '', tipo: '', pcgr_general: '', pcgr_empresarial: '' });
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
    const api = new TipoFormaPagoApiMock();
    api.fallar = true;
    const { fixture } = await setup(api);
    const c = comp(fixture);

    c.onNuevo();
    c.form.patchValue({ nombre: 'EFECTIVO' });
    c.onGuardar();
    await asentar(fixture);

    expect(c.modalAbierto()).toBe(true);
    expect(c.form.getRawValue().nombre).toBe('EFECTIVO');
  });

  it('editar precarga los campos editables y manda un PUT', async () => {
    const { fixture, api } = await setup();
    const c = comp(fixture);

    c.onEditar(fila() as never);
    expect(c.tituloModal()).toBe('Editar tipo de forma de pago');
    expect(c.form.getRawValue()).toEqual({ nombre: 'EFECTIVO', abreviatura: 'EFE', estructura: 'EFE', tipo: '', pcgr_general: '101', pcgr_empresarial: '1011' });

    c.form.patchValue({ nombre: 'EFECTIVO EDITADO' });
    c.onGuardar();
    await asentar(fixture);

    expect(api.actualizados.length).toBe(1);
    expect(api.actualizados[0].id).toBe(1);
    expect(api.actualizados[0].input.nombre).toBe('EFECTIVO EDITADO');
    expect(api.creados).toEqual([]);
  });

  it('la edición no cambia el estado del registro', async () => {
    // El estado no está en el formulario: el backend conserva el que la fila ya tenía. Si
    // volviera al cuerpo, editar un inactivo lo reactivaría.
    const api = new TipoFormaPagoApiMock();
    api.rows = [fila(), fila({ tipoformapagoid: 2, nombre: 'TARJETA', estado: false })];
    const { fixture } = await setup(api);
    const c = comp(fixture);

    c.onEditar(api.rows[1] as never);
    c.form.patchValue({ nombre: 'TARJETA EDITADO' });
    c.onGuardar();
    await asentar(fixture);

    expect(api.actualizados[0].input).not.toHaveProperty('estado');
    expect(c.rows().map((row) => [row.tipoformapagoid, row.estado])).toEqual([
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
    expect(c.rows().map((row) => row.tipoformapagoid)).toEqual([2]);
  });

  it('la grilla ofrece checkbox de selección', async () => {
    const { el } = await setup();
    expect(el.querySelectorAll('tbody input[type="checkbox"]').length).toBe(2);
  });

  it('el borrado en lote va en UNA petición y quita las filas', async () => {
    const { fixture, api } = await setup();
    const c = comp(fixture);

    c.onSeleccion([{ tipoformapagoid: 1 }, { tipoformapagoid: 2 }] as never);
    c.onEliminarSeleccionadas();
    await asentar(fixture);

    expect(api.lotes).toEqual([[1, 2]]);
    expect(c.rows()).toEqual([]);
    expect(c.seleccionadas()).toEqual([]);
  });

  it('el lote es parcial: conserva las filas que fallaron', async () => {
    const api = new TipoFormaPagoApiMock();
    api.loteResultado = [
      { tipoformapagoid: 1, ok: true },
      { tipoformapagoid: 2, ok: false, mensaje: 'Tiene registros relacionados.' },
    ];
    const { fixture, notify } = await setup(api);
    const c = comp(fixture);

    c.onSeleccion([{ tipoformapagoid: 1 }, { tipoformapagoid: 2 }] as never);
    c.onEliminarSeleccionadas();
    await asentar(fixture);

    expect(c.rows().map((row) => row.tipoformapagoid)).toEqual([2]);
    expect(notify.errores.length).toBe(1);
  });

  it('el borrado en lote pide confirmación', async () => {
    const { fixture, api, confirm } = await setup();
    const c = comp(fixture);
    confirm.respuesta = false;

    c.onSeleccion([{ tipoformapagoid: 1 }] as never);
    c.onEliminarSeleccionadas();
    await asentar(fixture);

    expect(api.lotes).toEqual([]);
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

    c.filters.patchValue({ q: 'tarje' });
    c.onApply();
    fixture.detectChanges();
    c.onExportar({ formato: 'csv', detalle: false });

    // La descarga la dispara `exportCsv` creando un <a> y pulsándolo.
    expect(anchor).toHaveBeenCalled();
    expect(c.rows().length).toBe(1);
  });

  it('sin historia previa, cerrar vuelve al índice de tablas básicas', async () => {
    // Entrar pegando la URL no deja a dónde volver: `location.back()` sacaría del ERP.
    const { fixture } = await setup();
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    comp(fixture).onCerrar();

    expect(navigate).toHaveBeenCalledWith(['/mantenimiento/tablas-basicas']);
  });

  it('muestra el pie con la paginación', async () => {
    const { el } = await setup();
    expect(el.querySelector('erp-grid-footer')).not.toBeNull();
  });

  it('pagina en cliente: el endpoint devuelve el catálogo entero', async () => {
    const api = new TipoFormaPagoApiMock();
    api.rows = Array.from({ length: 30 }, (_, i) =>
      fila({ tipoformapagoid: i + 1, nombre: `FILA ${i + 1}`, orden: i + 1 }),
    );
    const { fixture, el } = await setup(api);
    const c = comp(fixture);

    expect(c.meta()).toMatchObject({ total: 30, pageSize: 25, totalPages: 2 });
    expect(el.querySelectorAll('tbody tr').length).toBe(25);

    c.onPage(2);
    fixture.detectChanges();
    expect(el.querySelectorAll('tbody tr').length).toBe(5);
  });

  it('el total del pie refleja el filtro, no el universo', async () => {
    const { fixture } = await setup();
    const c = comp(fixture);

    c.filters.patchValue({ q: 'tarje' });
    c.onApply();
    fixture.detectChanges();

    expect(c.meta()).toMatchObject({ total: 1, page: 1 });
  });

  it('desactiva el arrastre cuando la lista no cabe en una página', async () => {
    // La grilla solo emitiría las filas visibles; renumerarlas desde 1 machacaría el resto.
    const api = new TipoFormaPagoApiMock();
    api.rows = Array.from({ length: 30 }, (_, i) =>
      fila({ tipoformapagoid: i + 1, nombre: `FILA ${i + 1}`, orden: i + 1 }),
    );
    const { fixture } = await setup(api);
    expect(comp(fixture).filtrando()).toBe(true);
  });
});
