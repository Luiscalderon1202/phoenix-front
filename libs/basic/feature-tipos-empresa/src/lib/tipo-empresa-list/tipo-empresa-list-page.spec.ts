import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { TipoEmpresaApi } from '@phoenix/basic/data-access';
import type { TipoEmpresa, TipoEmpresaInput } from '@phoenix/basic/domain';
import { ConfirmService, NotificationService } from '@phoenix/shared/ui';
import { TipoEmpresaListPage } from './tipo-empresa-list-page';

function fila(over: Partial<TipoEmpresa> = {}): TipoEmpresa {
  return {
    tipoempresaid: 1,
    nombre: 'TIENDA COMERCIAL',
    tipo: 'RETAIL',
    categoria: 'A',
    orden: 1,
    estado: true,
    ...over,
  };
}

/** Doble del API: registra lo que se le pide y devuelve lo que se le configure. */
class TipoEmpresaApiMock {
  rows: TipoEmpresa[] = [
    fila(),
    fila({ tipoempresaid: 2, nombre: 'DISTRIBUIDORA', tipo: '', categoria: '', orden: 2 }),
  ];

  readonly alternados: number[] = [];
  readonly eliminados: number[] = [];
  readonly creados: TipoEmpresaInput[] = [];
  readonly actualizados: { id: number; input: TipoEmpresaInput }[] = [];
  readonly reordenes: { ids: readonly number[]; desde: number }[] = [];
  readonly lotes: readonly number[][] = [];
  /** Resultado por id del lote; por defecto todo OK. */
  loteResultado: { tipoempresaid: number; ok: boolean; mensaje?: string }[] | null = null;
  readonly pdfs: boolean[] = [];

  /** Estado que devuelve `alternarEstado` (el contrato manda el resultante). */
  estadoResultante = false;
  /** Cuando es true, las mutaciones fallan: sirve para probar la reversión optimista. */
  fallar = false;

  list() {
    return of(this.rows);
  }

  create(input: TipoEmpresaInput) {
    this.creados.push(input);
    if (this.fallar) return throwError(() => new Error('409'));
    return of(fila({ tipoempresaid: 99, ...input, orden: this.rows.length + 1 }));
  }

  update(id: number, input: TipoEmpresaInput) {
    this.actualizados.push({ id, input });
    if (this.fallar) return throwError(() => new Error('409'));
    return of(fila({ tipoempresaid: id, ...input }));
  }

  remove(id: number) {
    this.eliminados.push(id);
    if (this.fallar) return throwError(() => new Error('409'));
    return of(undefined as unknown as void);
  }

  alternarEstado(tipoempresaid: number) {
    this.alternados.push(tipoempresaid);
    if (this.fallar) return throwError(() => new Error('500'));
    return of({ tipoempresaid, estado: this.estadoResultante });
  }

  reordenar(ids: readonly number[], desde = 1) {
    this.reordenes.push({ ids: [...ids], desde });
    if (this.fallar) return throwError(() => new Error('500'));
    return of(undefined as unknown as void);
  }

  removeLote(ids: readonly number[]) {
    (this.lotes as number[][]).push([...ids]);
    if (this.fallar) return throwError(() => new Error('500'));
    return of(this.loteResultado ?? ids.map((tipoempresaid) => ({ tipoempresaid, ok: true })));
  }

  reportePdf(soloActivos: boolean) {
    this.pdfs.push(soloActivos);
    return of({ blob: new Blob(['%PDF-1.4'], { type: 'application/pdf' }), filename: null });
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

async function setup(api = new TipoEmpresaApiMock()) {
  const confirm = new ConfirmServiceMock();
  const notify = new NotificationServiceMock();

  TestBed.configureTestingModule({
    imports: [TipoEmpresaListPage],
    providers: [
      // `erp-page-header` monta los breadcrumbs, que leen la ruta activa.
      provideRouter([]),
      { provide: TipoEmpresaApi, useValue: api },
      { provide: ConfirmService, useValue: confirm },
      { provide: NotificationService, useValue: notify },
    ],
  });

  const fixture = TestBed.createComponent(TipoEmpresaListPage);
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
    form: { patchValue(v: unknown): void; getRawValue(): TipoEmpresaInput };
    rows(): TipoEmpresa[];
    filtrando(): boolean;
    modalAbierto(): boolean;
    tituloModal(): string;
    seleccionadas(): { tipoempresaid: number }[];
    onExportar(e: { formato: string; detalle: boolean }): void;
    onCerrar(): void;
    onPageSize(n: number): void;
    onPage(n: number): void;
    rowsPagina(): TipoEmpresa[];
    meta(): { page: number; pageSize: number; total: number; totalPages: number };
    printFields(): { label: string; value: string }[];
    onImpresion(v: string): void;
    pdfUrl(): string | null;
    visorAbierto(): boolean;
  };
}

function celdas(el: HTMLElement, colIndex: number): string[] {
  // +1: la primera celda es el checkbox de selección.
  return Array.from(el.querySelectorAll('tbody tr')).map(
    (tr) => tr.querySelectorAll('td')[colIndex + 1]?.textContent?.trim() ?? '',
  );
}

describe('TipoEmpresaListPage', () => {
  // La descarga crea un <a download> y lo pulsa. jsdom no implementa la navegación que eso
  // provoca y escupe un "Not implemented" por consola que no es un fallo, solo ruido: se
  // interceptan el click y los object URLs, que además no existen de verdad en jsdom.
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
    expect(celdas(el, 1)).toEqual(['TIENDA COMERCIAL', 'DISTRIBUIDORA']);
  });

  it('sustituye por un guion los campos de texto vacíos del legacy', async () => {
    // `tipo` y `categoria` son NOT NULL pero el legacy guarda cadena vacía.
    const { el } = await setup();
    expect(celdas(el, 2)).toEqual(['RETAIL', '—']);
    expect(celdas(el, 3)).toEqual(['A', '—']);
  });

  it('filtra en cliente por texto: no hay endpoint al que mandar el filtro', async () => {
    const { fixture } = await setup();
    const c = comp(fixture);

    c.filters.patchValue({ q: 'distri' });
    c.onApply();
    fixture.detectChanges();

    expect(c.rows().map((r) => r.tipoempresaid)).toEqual([2]);
  });

  it('filtra por estado', async () => {
    const api = new TipoEmpresaApiMock();
    api.rows = [fila(), fila({ tipoempresaid: 2, estado: false })];
    const { fixture } = await setup(api);
    const c = comp(fixture);

    c.filters.patchValue({ estado: 'N' });
    c.onApply();
    fixture.detectChanges();

    expect(c.rows().map((r) => r.tipoempresaid)).toEqual([2]);
  });

  it('alterna el estado y se queda con el valor que devuelve el backend', async () => {
    // Es un toggle: el cliente no manda el valor deseado, pero sí lee el resultante.
    const api = new TipoEmpresaApiMock();
    api.estadoResultante = false;
    const { fixture } = await setup(api);
    const c = comp(fixture);

    c.onToggleEstado(fila() as never);
    await asentar(fixture);

    expect(api.alternados).toEqual([1]);
    expect(c.rows()[0].estado).toBe(false);
  });

  it('revierte el estado si el backend falla', async () => {
    const api = new TipoEmpresaApiMock();
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
    expect(c.rows().map((r) => [r.tipoempresaid, r.orden])).toEqual([
      [2, 1],
      [1, 2],
    ]);
  });

  it('revierte el orden si el backend falla', async () => {
    const api = new TipoEmpresaApiMock();
    api.fallar = true;
    const { fixture } = await setup(api);
    const c = comp(fixture);

    c.onReorder([...c.rows()].reverse() as never);
    await asentar(fixture);

    expect(c.rows().map((r) => r.tipoempresaid)).toEqual([1, 2]);
  });

  it('desactiva el arrastre mientras haya un filtro activo', async () => {
    // Con filtro, la grilla emitiría solo las filas visibles y renumerarlas desde 1
    // machacaría el orden de las ocultas.
    const { fixture } = await setup();
    const c = comp(fixture);
    expect(c.filtrando()).toBe(false);

    c.filters.patchValue({ q: 'tienda' });
    c.onApply();
    fixture.detectChanges();

    expect(c.filtrando()).toBe(true);
  });

  it('el alta manda solo nombre, tipo y categoría', async () => {
    // El backend fija `orden` y `estado` él solo: mandarlos prometería un efecto que no ocurre.
    const { fixture, api, notify } = await setup();
    const c = comp(fixture);

    c.onNuevo();
    c.form.patchValue({ nombre: 'MAYORISTA', tipo: 'B2B', categoria: 'C' });
    c.onGuardar();
    await asentar(fixture);

    expect(api.creados).toEqual([{ nombre: 'MAYORISTA', tipo: 'B2B', categoria: 'C' }]);
    expect(c.modalAbierto()).toBe(false);
    expect(notify.exitos.length).toBe(1);
  });

  it('el alta añade la fila al final, que es donde la coloca el backend', async () => {
    const { fixture } = await setup();
    const c = comp(fixture);

    c.onNuevo();
    c.form.patchValue({ nombre: 'MAYORISTA' });
    c.onGuardar();
    await asentar(fixture);

    expect(c.rows().map((r) => r.nombre).at(-1)).toBe('MAYORISTA');
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
    const api = new TipoEmpresaApiMock();
    api.fallar = true;
    const { fixture } = await setup(api);
    const c = comp(fixture);

    c.onNuevo();
    c.form.patchValue({ nombre: 'TIENDA COMERCIAL' });
    c.onGuardar();
    await asentar(fixture);

    expect(c.modalAbierto()).toBe(true);
    expect(c.form.getRawValue().nombre).toBe('TIENDA COMERCIAL');
  });

  it('editar precarga los tres campos editables y manda un PUT', async () => {
    const { fixture, api } = await setup();
    const c = comp(fixture);

    c.onEditar(fila() as never);
    expect(c.tituloModal()).toBe('Editar tipo de empresa');
    expect(c.form.getRawValue()).toEqual({
      nombre: 'TIENDA COMERCIAL',
      tipo: 'RETAIL',
      categoria: 'A',
    });

    c.form.patchValue({ nombre: 'TIENDA RENOMBRADA' });
    c.onGuardar();
    await asentar(fixture);

    expect(api.actualizados).toEqual([
      { id: 1, input: { nombre: 'TIENDA RENOMBRADA', tipo: 'RETAIL', categoria: 'A' } },
    ]);
    expect(api.creados).toEqual([]);
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
    expect(c.rows().map((r) => r.tipoempresaid)).toEqual([2]);
  });

  it('el PDF traslada solo el filtro que el endpoint entiende', async () => {
    // El filtro de texto es de cliente: el reporte lo genera el servidor con su propia
    // consulta, así que solo `solo_activos` puede viajar.
    const { fixture, api } = await setup();
    const c = comp(fixture);

    c.filters.patchValue({ estado: 'Y', q: 'tienda' });
    c.onApply();
    c.onVerPdf();
    await asentar(fixture);

    expect(api.pdfs).toEqual([true]);
  });

  it('sin filtro de estado el PDF pide el listado completo', async () => {
    const { fixture, api } = await setup();
    const c = comp(fixture);

    c.onVerPdf();
    await asentar(fixture);

    expect(api.pdfs).toEqual([false]);
  });

  it('el PDF se muestra en el visor, no se descarga', async () => {
    const { fixture, el } = await setup();
    const c = comp(fixture);

    c.onVerPdf();
    await asentar(fixture);

    expect(c.visorAbierto()).toBe(true);
    expect(c.pdfUrl()).toBe('blob:test');
    // Si se descargara, habría un <a download> disparado; el visor monta un iframe.
    expect(el.querySelector('iframe')).not.toBeNull();
  });

  it('al cerrar el visor libera el object URL', async () => {
    // Sin esto el blob vive hasta que se recargue la página.
    const { fixture } = await setup();
    const c = comp(fixture);

    c.onVerPdf();
    await asentar(fixture);
    c.onCerrarVisor();
    await asentar(fixture);

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
    expect(c.pdfUrl()).toBeNull();
  });

  it('la grilla ofrece checkbox de selección', async () => {
    const { el } = await setup();
    expect(el.querySelectorAll('tbody input[type="checkbox"]').length).toBe(2);
  });

  it('el borrado en lote va en UNA petición y quita las filas', async () => {
    const { fixture, api } = await setup();
    const c = comp(fixture);

    c.onSeleccion([{ tipoempresaid: 1 }, { tipoempresaid: 2 }] as never);
    c.onEliminarSeleccionadas();
    await asentar(fixture);

    expect(api.lotes).toEqual([[1, 2]]);
    expect(c.rows()).toEqual([]);
    expect(c.seleccionadas()).toEqual([]);
  });

  it('el lote es parcial: conserva las filas que fallaron', async () => {
    // Un tipo en uso por una unidad de negocio falla mientras el resto sí se borra.
    const api = new TipoEmpresaApiMock();
    api.loteResultado = [
      { tipoempresaid: 1, ok: true },
      { tipoempresaid: 2, ok: false, mensaje: 'Tiene registros relacionados.' },
    ];
    const { fixture, notify } = await setup(api);
    const c = comp(fixture);

    c.onSeleccion([{ tipoempresaid: 1 }, { tipoempresaid: 2 }] as never);
    c.onEliminarSeleccionadas();
    await asentar(fixture);

    expect(c.rows().map((r) => r.tipoempresaid)).toEqual([2]);
    expect(notify.errores.length).toBe(1);
  });

  it('el borrado en lote pide confirmación', async () => {
    const { fixture, api, confirm } = await setup();
    const c = comp(fixture);
    confirm.respuesta = false;

    c.onSeleccion([{ tipoempresaid: 1 }] as never);
    c.onEliminarSeleccionadas();
    await asentar(fixture);

    expect(api.lotes).toEqual([]);
  });

  it('agrupa las acciones en dos menús y el botón de cerrar en la cabecera', async () => {
    // Exportar (Excel/CSV) e Imprimir (Vista PDF / Imprimir): dos familias, dos menús.
    const { el } = await setup();
    expect(el.querySelectorAll('erp-export-menu').length).toBe(2);
    expect(el.querySelector('.btn-cerrar')).not.toBeNull();
  });

  it('el menú de impresión enruta cada opción a lo suyo', async () => {
    const { fixture, api } = await setup();
    const c = comp(fixture);

    c.onImpresion('pdf');
    await asentar(fixture);
    expect(api.pdfs.length).toBe(1);

    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    c.onImpresion('print');
    expect(print).toHaveBeenCalled();
    // La impresión de pantalla no pide nada al backend.
    expect(api.pdfs.length).toBe(1);
  });

  it('exporta lo que se está viendo, con el filtro aplicado', async () => {
    // El CSV se arma en el navegador con las filas ya cargadas; el PDF, en cambio, lo genera
    // el servidor y por eso no refleja el filtro de texto.
    const anchor = vi.spyOn(HTMLAnchorElement.prototype, 'click');
    const { fixture } = await setup();
    const c = comp(fixture);

    c.filters.patchValue({ q: 'distri' });
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
    const api = new TipoEmpresaApiMock();
    api.rows = Array.from({ length: 30 }, (_, i) =>
      fila({ tipoempresaid: i + 1, nombre: `TIPO ${i + 1}`, orden: i + 1 }),
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

    c.filters.patchValue({ q: 'distri' });
    c.onApply();
    fixture.detectChanges();

    expect(c.meta()).toMatchObject({ total: 1, page: 1 });
  });

  it('desactiva el arrastre cuando la lista no cabe en una página', async () => {
    // La grilla solo emitiría las filas visibles; renumerarlas desde 1 machacaría el resto.
    const api = new TipoEmpresaApiMock();
    api.rows = Array.from({ length: 30 }, (_, i) =>
      fila({ tipoempresaid: i + 1, nombre: `TIPO ${i + 1}`, orden: i + 1 }),
    );
    const { fixture } = await setup(api);
    expect(comp(fixture).filtrando()).toBe(true);
  });

  it('monta la cabecera de impresión, que solo se ve en el papel', async () => {
    const { el } = await setup();
    expect(el.querySelector('erp-print-header')).not.toBeNull();
  });

  it('la cabecera de impresión describe el filtro APLICADO, no lo tecleado', async () => {
    // Si alguien escribe y manda a imprimir sin pulsar Buscar, el papel debe describir lo
    // que se está viendo.
    const { fixture } = await setup();
    const c = comp(fixture);

    c.filters.patchValue({ q: 'distri', estado: 'Y' });
    fixture.detectChanges();
    expect(c.printFields()).toEqual([
      { label: 'Búsqueda', value: 'Todos' },
      { label: 'Estado', value: 'Todos' },
      { label: 'Registros', value: '2' },
    ]);

    c.onApply();
    fixture.detectChanges();
    expect(c.printFields()).toEqual([
      { label: 'Búsqueda', value: 'distri' },
      { label: 'Estado', value: 'Activos' },
      // DISTRIBUIDORA está activa en el doble, así que sigue contando.
      { label: 'Registros', value: '1' },
    ]);
  });
});
