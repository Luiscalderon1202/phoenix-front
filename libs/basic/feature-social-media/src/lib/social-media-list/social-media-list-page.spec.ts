import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { TipoSocialMediaApi } from '@phoenix/basic/data-access';
import type { TipoSocialMedia, TipoSocialMediaInput } from '@phoenix/basic/domain';
import { ConfirmService, NotificationService } from '@phoenix/shared/ui';
import { SocialMediaListPage } from './social-media-list-page';

function fila(over: Partial<TipoSocialMedia> = {}): TipoSocialMedia {
  return {
    tipoid: 1,
    nombre: 'FACEBOOK',
    url: 'https://facebook.com/',
    icono: 'fa-facebook',
    orden: 1,
    estado: true,
    ...over,
  };
}

/** Doble del API: registra lo que se le pide y devuelve lo que se le configure. */
class TipoSocialMediaApiMock {
  rows: TipoSocialMedia[] = [
    fila(),
    fila({ tipoid: 2, nombre: 'INSTAGRAM', url: '', icono: '', orden: 2 }),
  ];

  readonly alternados: number[] = [];
  readonly eliminados: number[] = [];
  readonly creados: TipoSocialMediaInput[] = [];
  readonly actualizados: { id: number; input: TipoSocialMediaInput }[] = [];
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

  create(input: TipoSocialMediaInput) {
    this.creados.push(input);
    if (this.fallar) return throwError(() => new Error('409'));
    // El backend da de alta el registro activo y al final del orden.
    return of(fila({ tipoid: 99, ...input, orden: this.rows.length + 1, estado: true }));
  }

  update(id: number, input: TipoSocialMediaInput) {
    this.actualizados.push({ id, input });
    if (this.fallar) return throwError(() => new Error('409'));
    // El backend conserva el estado de la fila: el input no lo trae.
    const previa = this.rows.find((r) => r.tipoid === id);
    return of(fila({ tipoid: id, estado: previa?.estado ?? true, ...input }));
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

async function setup(api = new TipoSocialMediaApiMock()) {
  const confirm = new ConfirmServiceMock();
  const notify = new NotificationServiceMock();

  TestBed.configureTestingModule({
    imports: [SocialMediaListPage],
    providers: [
      // `erp-page-header` monta los breadcrumbs, que leen la ruta activa.
      provideRouter([]),
      { provide: TipoSocialMediaApi, useValue: api },
      { provide: ConfirmService, useValue: confirm },
      { provide: NotificationService, useValue: notify },
    ],
  });

  const fixture = TestBed.createComponent(SocialMediaListPage);
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
    form: { patchValue(v: unknown): void; getRawValue(): TipoSocialMediaInput };
    rows(): TipoSocialMedia[];
    filtrando(): boolean;
    modalAbierto(): boolean;
    tituloModal(): string;
    seleccionadas(): { tipoid: number }[];
    onExportar(e: { formato: string; detalle: boolean }): void;
    onCerrar(): void;
    onPageSize(n: number): void;
    onPage(n: number): void;
    rowsPagina(): TipoSocialMedia[];
    meta(): { page: number; pageSize: number; total: number; totalPages: number };
    printFields(): { label: string; value: string }[];
  };
}

function celdas(el: HTMLElement, colIndex: number): string[] {
  // +1: la primera celda es el checkbox de selección.
  return Array.from(el.querySelectorAll('tbody tr')).map(
    (tr) => tr.querySelectorAll('td')[colIndex + 1]?.textContent?.trim() ?? '',
  );
}

describe('SocialMediaListPage', () => {
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

  it('pinta el catálogo que devuelve el backend', async () => {
    const { el } = await setup();
    expect(el.querySelectorAll('tbody tr').length).toBe(2);
    expect(celdas(el, 1)).toEqual(['FACEBOOK', 'INSTAGRAM']);
  });

  it('sustituye por un guion los campos de texto vacíos del legacy', async () => {
    // `url` e `icono` son NOT NULL pero el legacy guarda cadena vacía.
    const { el } = await setup();
    expect(celdas(el, 2)).toEqual(['https://facebook.com/', '—']);
    expect(celdas(el, 3)).toEqual(['fa-facebook', '—']);
  });

  it('filtra en cliente por texto: no hay endpoint al que mandar el filtro', async () => {
    const { fixture } = await setup();
    const c = comp(fixture);

    c.filters.patchValue({ q: 'instag' });
    c.onApply();
    fixture.detectChanges();

    expect(c.rows().map((r) => r.tipoid)).toEqual([2]);
  });

  it('el filtro de texto también mira la URL', async () => {
    const { fixture } = await setup();
    const c = comp(fixture);

    c.filters.patchValue({ q: 'facebook.com' });
    c.onApply();
    fixture.detectChanges();

    expect(c.rows().map((r) => r.tipoid)).toEqual([1]);
  });

  it('filtra por estado', async () => {
    const api = new TipoSocialMediaApiMock();
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
    const api = new TipoSocialMediaApiMock();
    api.estadoResultante = false;
    const { fixture } = await setup(api);
    const c = comp(fixture);

    c.onToggleEstado(fila() as never);
    await asentar(fixture);

    expect(api.alternados).toEqual([1]);
    expect(c.rows()[0].estado).toBe(false);
  });

  it('revierte el estado si el backend falla', async () => {
    const api = new TipoSocialMediaApiMock();
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
    const api = new TipoSocialMediaApiMock();
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

    c.filters.patchValue({ q: 'face' });
    c.onApply();
    fixture.detectChanges();

    expect(c.filtrando()).toBe(true);
  });

  it('el alta manda solo nombre, url e icono', async () => {
    // El backend fija `orden` y `estado` él solo: mandarlos prometería un efecto que no
    // ocurre, y el estado ya tiene su propia acción en la grilla.
    const { fixture, api, notify } = await setup();
    const c = comp(fixture);

    c.onNuevo();
    c.form.patchValue({ nombre: 'TIKTOK', url: 'https://tiktok.com/', icono: 'fa-tiktok' });
    c.onGuardar();
    await asentar(fixture);

    expect(api.creados).toEqual([
      { nombre: 'TIKTOK', url: 'https://tiktok.com/', icono: 'fa-tiktok' },
    ]);
    expect(c.modalAbierto()).toBe(false);
    expect(notify.exitos.length).toBe(1);
  });

  it('el modal no ofrece el estado: se cambia desde el listado', async () => {
    // El stored procedure del legacy lo acepta como parámetro, pero exponerlo también aquí
    // daría dos vías para lo mismo. La nota del formulario lo dice.
    const { fixture, el } = await setup();
    const c = comp(fixture);

    c.onNuevo();
    fixture.detectChanges();

    expect(c.form.getRawValue()).toEqual({ nombre: '', url: '', icono: '' });
    expect(c.tituloModal()).toBe('Nueva red social');
    expect(el.querySelector('.form input[type="checkbox"]')).toBeNull();
    expect(el.querySelector('.form__nota')?.textContent).toContain('estado');
  });

  it('el alta añade la fila al final, que es donde la coloca el backend', async () => {
    const { fixture } = await setup();
    const c = comp(fixture);

    c.onNuevo();
    c.form.patchValue({ nombre: 'TIKTOK' });
    c.onGuardar();
    await asentar(fixture);

    expect(c.rows().map((r) => r.nombre).at(-1)).toBe('TIKTOK');
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
    const api = new TipoSocialMediaApiMock();
    api.fallar = true;
    const { fixture } = await setup(api);
    const c = comp(fixture);

    c.onNuevo();
    c.form.patchValue({ nombre: 'FACEBOOK' });
    c.onGuardar();
    await asentar(fixture);

    expect(c.modalAbierto()).toBe(true);
    expect(c.form.getRawValue().nombre).toBe('FACEBOOK');
  });

  it('editar precarga los tres campos editables y manda un PUT', async () => {
    const { fixture, api } = await setup();
    const c = comp(fixture);

    c.onEditar(fila() as never);
    expect(c.tituloModal()).toBe('Editar red social');
    expect(c.form.getRawValue()).toEqual({
      nombre: 'FACEBOOK',
      url: 'https://facebook.com/',
      icono: 'fa-facebook',
    });

    c.form.patchValue({ nombre: 'META' });
    c.onGuardar();
    await asentar(fixture);

    expect(api.actualizados).toEqual([
      { id: 1, input: { nombre: 'META', url: 'https://facebook.com/', icono: 'fa-facebook' } },
    ]);
    expect(api.creados).toEqual([]);
  });

  it('editar una fila desactivada NO la reactiva: el PUT no lleva el estado', async () => {
    // Es la trampa del recurso: `patiposocialmedia_actualizar` escribe la columna estado con
    // lo que reciba, así que el backend le devuelve el valor que ya tenía la fila. Desde el
    // cliente, la garantía es que `estado` no viaja en el input.
    const api = new TipoSocialMediaApiMock();
    api.rows = [fila({ estado: false })];
    const { fixture } = await setup(api);
    const c = comp(fixture);

    c.onEditar(fila({ estado: false }) as never);
    c.form.patchValue({ nombre: 'META' });
    c.onGuardar();
    await asentar(fixture);

    expect(api.actualizados[0].input).not.toHaveProperty('estado');
    expect(c.rows()[0].estado).toBe(false);
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
    // Una red declarada por alguna persona falla mientras el resto sí se borra.
    const api = new TipoSocialMediaApiMock();
    api.loteResultado = [
      { tipoid: 1, ok: true },
      { tipoid: 2, ok: false, mensaje: 'Tiene personas relacionadas.' },
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

  it('lleva un solo menú de salida —Exportar— y el botón de cerrar en la cabecera', async () => {
    // Sin menú Imprimir: este recurso no tiene reporte PDF en el backend, así que agrupar
    // una "Vista PDF" que no existe sería prometer algo que no está.
    const { el } = await setup();
    expect(el.querySelectorAll('erp-export-menu').length).toBe(1);
    expect(el.querySelector('erp-file-viewer')).toBeNull();
    expect(el.querySelector('.btn-cerrar')).not.toBeNull();
  });

  it('exporta lo que se está viendo, con el filtro aplicado', async () => {
    // El CSV se arma en el navegador con las filas ya cargadas: no se pide nada al backend.
    const anchor = vi.spyOn(HTMLAnchorElement.prototype, 'click');
    const { fixture } = await setup();
    const c = comp(fixture);

    c.filters.patchValue({ q: 'instag' });
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
    const api = new TipoSocialMediaApiMock();
    api.rows = Array.from({ length: 30 }, (_, i) =>
      fila({ tipoid: i + 1, nombre: `RED ${i + 1}`, orden: i + 1 }),
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

    c.filters.patchValue({ q: 'instag' });
    c.onApply();
    fixture.detectChanges();

    expect(c.meta()).toMatchObject({ total: 1, page: 1 });
  });

  it('desactiva el arrastre cuando la lista no cabe en una página', async () => {
    // La grilla solo emitiría las filas visibles; renumerarlas desde 1 machacaría el resto.
    const api = new TipoSocialMediaApiMock();
    api.rows = Array.from({ length: 30 }, (_, i) =>
      fila({ tipoid: i + 1, nombre: `RED ${i + 1}`, orden: i + 1 }),
    );
    const { fixture } = await setup(api);
    expect(comp(fixture).filtrando()).toBe(true);
  });

  it('monta la cabecera de impresión, que solo se ve en el papel', async () => {
    // No hay menú Imprimir, pero el navegador sigue imprimiendo con Ctrl+P y ahí esta
    // cabecera sustituye a la de pantalla y al panel de filtros.
    const { el } = await setup();
    expect(el.querySelector('erp-print-header')).not.toBeNull();
  });

  it('la cabecera de impresión describe el filtro APLICADO, no lo tecleado', async () => {
    const { fixture } = await setup();
    const c = comp(fixture);

    c.filters.patchValue({ q: 'instag', estado: 'Y' });
    fixture.detectChanges();
    expect(c.printFields()).toEqual([
      { label: 'Búsqueda', value: 'Todos' },
      { label: 'Estado', value: 'Todos' },
      { label: 'Registros', value: '2' },
    ]);

    c.onApply();
    fixture.detectChanges();
    expect(c.printFields()).toEqual([
      { label: 'Búsqueda', value: 'instag' },
      { label: 'Estado', value: 'Activos' },
      // INSTAGRAM está activa en el doble, así que sigue contando.
      { label: 'Registros', value: '1' },
    ]);
  });
});
