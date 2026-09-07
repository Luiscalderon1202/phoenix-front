import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { TipoEmailApi } from '@phoenix/basic/data-access';
import type { TipoEmail, TipoEmailInput } from '@phoenix/basic/domain';
import { ConfirmService, NotificationService } from '@phoenix/shared/ui';
import { TipoEmailListPage } from './tipo-email-list-page';

function fila(over: Partial<TipoEmail> = {}): TipoEmail {
  return {
    tipoid: 1,
    nombre: 'PERSONAL',
    requerido: true,
    pordefecto: true,
    orden: 1,
    estado: true,
    ...over,
  };
}

/** Doble del API: registra lo que se le pide y devuelve lo que se le configure. */
class TipoEmailApiMock {
  rows: TipoEmail[] = [
    fila(),
    fila({ tipoid: 2, nombre: 'LABORAL', requerido: false, pordefecto: false, orden: 2 }),
  ];

  readonly alternados: number[] = [];
  readonly eliminados: number[] = [];
  readonly creados: TipoEmailInput[] = [];
  readonly actualizados: { id: number; input: TipoEmailInput }[] = [];
  readonly reordenes: { ids: readonly number[]; desde: number }[] = [];
  readonly lotes: readonly number[][] = [];
  /** Resultado por id del lote; por defecto todo OK. */
  loteResultado: { tipoid: number; ok: boolean; mensaje?: string }[] | null = null;

  /** Estado que devuelve `alternarEstado` (el contrato manda el resultante). */
  estadoResultante = false;
  /** Cuando es true, las mutaciones fallan: sirve para probar la reversión optimista. */
  fallar = false;

  list() {
    return of(this.rows);
  }

  create(input: TipoEmailInput) {
    this.creados.push(input);
    if (this.fallar) return throwError(() => new Error('409'));
    return of(fila({ tipoid: 99, ...input, orden: this.rows.length + 1 }));
  }

  update(id: number, input: TipoEmailInput) {
    this.actualizados.push({ id, input });
    if (this.fallar) return throwError(() => new Error('409'));
    // El backend le devuelve al SP el estado que la fila ya tenía: el PUT no lo lleva, así
    // que la respuesta conserva el estado y el orden previos.
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

  reordenar(ids: readonly number[], desde = 1) {
    this.reordenes.push({ ids: [...ids], desde });
    if (this.fallar) return throwError(() => new Error('500'));
    return of(undefined as unknown as void);
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
  success(m: string) {
    this.exitos.push(m);
  }
  error(m: string) {
    this.errores.push(m);
  }
}

async function setup(api = new TipoEmailApiMock()) {
  const confirm = new ConfirmServiceMock();
  const notify = new NotificationServiceMock();

  TestBed.configureTestingModule({
    imports: [TipoEmailListPage],
    providers: [
      // `erp-page-header` monta los breadcrumbs, que leen la ruta activa.
      provideRouter([]),
      { provide: TipoEmailApi, useValue: api },
      { provide: ConfirmService, useValue: confirm },
      { provide: NotificationService, useValue: notify },
    ],
  });

  const fixture = TestBed.createComponent(TipoEmailListPage);
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
    form: { patchValue(v: unknown): void; getRawValue(): TipoEmailInput };
    rows(): TipoEmail[];
    filtrando(): boolean;
    modalAbierto(): boolean;
    tituloModal(): string;
    seleccionadas(): { tipoid: number }[];
    onExportar(e: { formato: string; detalle: boolean }): void;
    onCerrar(): void;
    onPageSize(n: number): void;
    onPage(n: number): void;
    rowsPagina(): TipoEmail[];
    meta(): { page: number; pageSize: number; total: number; totalPages: number };
  };
}

function celdas(el: HTMLElement, colIndex: number): string[] {
  // +1: la primera celda es el checkbox de selección.
  return Array.from(el.querySelectorAll('tbody tr')).map(
    (tr) => tr.querySelectorAll('td')[colIndex + 1]?.textContent?.trim() ?? '',
  );
}

describe('TipoEmailListPage', () => {
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
    expect(celdas(el, 1)).toEqual(['PERSONAL', 'LABORAL']);
  });

  it('escribe los booleanos en palabras y marca el predeterminado solo donde lo hay', async () => {
    // `pordefecto` es excluyente: repetir "No" en todas las demás filas es ruido.
    const { el } = await setup();
    expect(celdas(el, 2)).toEqual(['Sí', 'No']);
    expect(celdas(el, 3)).toEqual(['Por defecto', '—']);
  });

  it('filtra en cliente por texto: no hay endpoint al que mandar el filtro', async () => {
    const { fixture } = await setup();
    const c = comp(fixture);

    c.filters.patchValue({ q: 'labor' });
    c.onApply();
    fixture.detectChanges();

    expect(c.rows().map((r) => r.tipoid)).toEqual([2]);
  });

  it('filtra por estado', async () => {
    const api = new TipoEmailApiMock();
    api.rows = [fila(), fila({ tipoid: 2, estado: false })];
    const { fixture } = await setup(api);
    const c = comp(fixture);

    c.filters.patchValue({ estado: 'N' });
    c.onApply();
    fixture.detectChanges();

    expect(c.rows().map((r) => r.tipoid)).toEqual([2]);
  });

  it('alterna el estado y se queda con el valor que devuelve el backend', async () => {
    // Es un toggle: el cliente no manda el valor deseado, pero sí lee el resultante.
    const api = new TipoEmailApiMock();
    api.estadoResultante = false;
    const { fixture } = await setup(api);
    const c = comp(fixture);

    c.onToggleEstado(fila() as never);
    await asentar(fixture);

    expect(api.alternados).toEqual([1]);
    expect(c.rows()[0].estado).toBe(false);
  });

  it('revierte el estado si el backend falla', async () => {
    const api = new TipoEmailApiMock();
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
    expect(c.rows().map((r) => [r.tipoid, r.orden])).toEqual([
      [2, 1],
      [1, 2],
    ]);
  });

  it('revierte el orden si el backend falla', async () => {
    const api = new TipoEmailApiMock();
    api.fallar = true;
    const { fixture } = await setup(api);
    const c = comp(fixture);

    c.onReorder([...c.rows()].reverse() as never);
    await asentar(fixture);

    expect(c.rows().map((r) => r.tipoid)).toEqual([1, 2]);
  });

  it('desactiva el arrastre mientras haya un filtro activo', async () => {
    // Con filtro, la grilla emitiría solo las filas visibles y renumerarlas desde 1
    // machacaría el orden de las ocultas.
    const { fixture } = await setup();
    const c = comp(fixture);
    expect(c.filtrando()).toBe(false);

    c.filters.patchValue({ q: 'personal' });
    c.onApply();
    fixture.detectChanges();

    expect(c.filtrando()).toBe(true);
  });

  it('el alta manda solo nombre, requerido y pordefecto', async () => {
    // `orden` y `estado` no viajan: el backend los fija él (activo, al final de la lista) y
    // cada uno tiene su propia acción en la grilla.
    const { fixture, api, notify } = await setup();
    const c = comp(fixture);

    c.onNuevo();
    c.form.patchValue({ nombre: 'FACTURACIÓN', requerido: true });
    c.onGuardar();
    await asentar(fixture);

    expect(api.creados).toEqual([
      { nombre: 'FACTURACIÓN', requerido: true, pordefecto: false },
    ]);
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

    expect(c.form.getRawValue()).toEqual({
      nombre: '',
      requerido: false,
      pordefecto: false,
    });
    expect(el.querySelector('erp-modal [formControlName="estado"]')).toBeNull();
    expect(el.querySelector('erp-modal [formControlName="orden"]')).toBeNull();
  });

  it('el alta añade la fila al final, que es donde la coloca el backend', async () => {
    const { fixture } = await setup();
    const c = comp(fixture);

    c.onNuevo();
    c.form.patchValue({ nombre: 'FACTURACIÓN' });
    c.onGuardar();
    await asentar(fixture);

    expect(c.rows().map((r) => r.nombre).at(-1)).toBe('FACTURACIÓN');
  });

  it('marcar "por defecto" desmarca al anterior, como hace el backend', async () => {
    // El stored procedure remata la escritura con `set pordefecto=false where tipoid != id`,
    // pero solo devuelve la fila escrita: sin replicarlo aquí, la lista mostraría dos.
    const { fixture } = await setup();
    const c = comp(fixture);
    expect(c.rows().map((r) => r.pordefecto)).toEqual([true, false]);

    c.onEditar(fila({ tipoid: 2, nombre: 'LABORAL', pordefecto: false }) as never);
    c.form.patchValue({ pordefecto: true });
    c.onGuardar();
    await asentar(fixture);

    expect(c.rows().map((r) => [r.tipoid, r.pordefecto])).toEqual([
      [1, false],
      [2, true],
    ]);
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
    const api = new TipoEmailApiMock();
    api.fallar = true;
    const { fixture } = await setup(api);
    const c = comp(fixture);

    c.onNuevo();
    c.form.patchValue({ nombre: 'PERSONAL' });
    c.onGuardar();
    await asentar(fixture);

    expect(c.modalAbierto()).toBe(true);
    expect(c.form.getRawValue().nombre).toBe('PERSONAL');
  });

  it('editar precarga los campos editables y manda un PUT', async () => {
    const { fixture, api } = await setup();
    const c = comp(fixture);

    c.onEditar(fila() as never);
    expect(c.tituloModal()).toBe('Editar tipo de email');
    expect(c.form.getRawValue()).toEqual({
      nombre: 'PERSONAL',
      requerido: true,
      pordefecto: true,
    });

    c.form.patchValue({ nombre: 'PERSONAL RENOMBRADO' });
    c.onGuardar();
    await asentar(fixture);

    expect(api.actualizados).toEqual([
      { id: 1, input: { nombre: 'PERSONAL RENOMBRADO', requerido: true, pordefecto: true } },
    ]);
    expect(api.creados).toEqual([]);
  });

  it('la edición no cambia el estado del registro', async () => {
    // El SP del legacy sí recibe `inestado`, pero el backend le devuelve el que la fila ya
    // tenía. Si el estado volviera al formulario, editar un inactivo lo reactivaría.
    const api = new TipoEmailApiMock();
    api.rows = [fila(), fila({ tipoid: 2, nombre: 'LABORAL', pordefecto: false, estado: false })];
    const { fixture } = await setup(api);
    const c = comp(fixture);

    c.onEditar(api.rows[1] as never);
    c.form.patchValue({ nombre: 'LABORAL EDITADO' });
    c.onGuardar();
    await asentar(fixture);

    expect(api.actualizados[0].input).not.toHaveProperty('estado');
    expect(c.rows().map((r) => [r.tipoid, r.estado])).toEqual([
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
    expect(c.rows().map((r) => r.tipoid)).toEqual([2]);
  });

  it('la grilla ofrece checkbox de selección', async () => {
    const { el } = await setup();
    expect(el.querySelectorAll('tbody input[type="checkbox"]').length).toBe(2);
  });

  it('el borrado en lote va en UNA petición y quita las filas', async () => {
    const { fixture, api } = await setup();
    const c = comp(fixture);

    c.onSeleccion([{ tipoid: 1 }, { tipoid: 2 }] as never);
    c.onEliminarSeleccionadas();
    await asentar(fixture);

    expect(api.lotes).toEqual([[1, 2]]);
    expect(c.rows()).toEqual([]);
    expect(c.seleccionadas()).toEqual([]);
  });

  it('el lote es parcial: conserva las filas que fallaron', async () => {
    // Un tipo en uso por el email de una persona falla mientras el resto sí se borra.
    const api = new TipoEmailApiMock();
    api.loteResultado = [
      { tipoid: 1, ok: true },
      { tipoid: 2, ok: false, mensaje: 'Tiene registros relacionados.' },
    ];
    const { fixture, notify } = await setup(api);
    const c = comp(fixture);

    c.onSeleccion([{ tipoid: 1 }, { tipoid: 2 }] as never);
    c.onEliminarSeleccionadas();
    await asentar(fixture);

    expect(c.rows().map((r) => r.tipoid)).toEqual([2]);
    expect(notify.errores.length).toBe(1);
  });

  it('el borrado en lote pide confirmación', async () => {
    const { fixture, api, confirm } = await setup();
    const c = comp(fixture);
    confirm.respuesta = false;

    c.onSeleccion([{ tipoid: 1 }] as never);
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

    c.filters.patchValue({ q: 'labor' });
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
    const api = new TipoEmailApiMock();
    api.rows = Array.from({ length: 30 }, (_, i) =>
      fila({ tipoid: i + 1, nombre: `TIPO ${i + 1}`, pordefecto: false, orden: i + 1 }),
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

    c.filters.patchValue({ q: 'labor' });
    c.onApply();
    fixture.detectChanges();

    expect(c.meta()).toMatchObject({ total: 1, page: 1 });
  });

  it('desactiva el arrastre cuando la lista no cabe en una página', async () => {
    // La grilla solo emitiría las filas visibles; renumerarlas desde 1 machacaría el resto.
    const api = new TipoEmailApiMock();
    api.rows = Array.from({ length: 30 }, (_, i) =>
      fila({ tipoid: i + 1, nombre: `TIPO ${i + 1}`, pordefecto: false, orden: i + 1 }),
    );
    const { fixture } = await setup(api);
    expect(comp(fixture).filtrando()).toBe(true);
  });
});
