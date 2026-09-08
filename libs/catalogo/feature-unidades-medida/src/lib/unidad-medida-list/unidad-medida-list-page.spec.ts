import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { UnidadMedidaApi } from '@phoenix/catalogo/data-access';
import type {
  UnidadMedida,
  UnidadMedidaFiltros,
  UnidadMedidaInput,
} from '@phoenix/catalogo/domain';
import { ConfirmService, NotificationService } from '@phoenix/shared/ui';
import { UnidadMedidaListPage } from './unidad-medida-list-page';

function fila(over: Partial<UnidadMedida> = {}): UnidadMedida {
  return {
    unidadmedidaid: 1,
    nombre: 'UNIDAD',
    abreviatura: 'UND',
    codigo_contable: '07',
    codigo_internacional: 'NIU',
    estado: true,
    orden: 1,
    ...over,
  };
}

/** La unidad del hallazgo: inactiva desde hace años y en uso por 2 productos. */
function baldeInactiva(): UnidadMedida {
  return fila({
    unidadmedidaid: 30,
    nombre: 'BALDE',
    abreviatura: 'BLD',
    codigo_contable: '99',
    codigo_internacional: 'ZZ',
    estado: false,
    orden: 3,
  });
}

/**
 * Doble del API.
 *
 * ⚠ `list` FILTRA, al contrario que en el molde de Condiciones de pago: aquí los filtros van al
 * servidor. El doble replica ese comportamiento —y registra cada consulta en `consultas`— para
 * que los tests de filtrado prueben lo que de verdad pasa: una recarga del recurso con
 * parámetros, no un `filter` en memoria que no existe.
 *
 * Y replica también la limitación que obliga al híbrido: entiende `incluir_inactivas`, pero NO
 * sabe devolver «solo las inactivas».
 */
class UnidadMedidaApiMock {
  rows: UnidadMedida[] = [
    fila(),
    fila({
      unidadmedidaid: 2,
      nombre: 'CAJA',
      abreviatura: 'CJA',
      codigo_contable: '12',
      codigo_internacional: 'BX',
      orden: 2,
    }),
  ];

  readonly consultas: UnidadMedidaFiltros[] = [];
  readonly alternados: number[] = [];
  readonly eliminados: number[] = [];
  readonly creados: UnidadMedidaInput[] = [];
  readonly actualizados: { id: number; input: UnidadMedidaInput }[] = [];
  readonly reordenes: { ids: readonly number[]; desde: number }[] = [];
  readonly lotes: readonly number[][] = [];
  /** Resultado por id del lote; por defecto todo OK. */
  loteResultado: { unidadmedidaid: number; ok: boolean; mensaje?: string }[] | null = null;

  /** Estado que devuelve `alternarEstado` (el contrato manda el resultante). */
  estadoResultante = false;
  /** Cuando es true, las mutaciones fallan: sirve para probar la reversión optimista. */
  fallar = false;

  list(filtros: UnidadMedidaFiltros = {}) {
    this.consultas.push({ ...filtros });
    let out = this.rows;
    // El SP oculta las inactivas salvo que se le pidan. No hay tercer estado.
    if (!filtros.incluir_inactivas) out = out.filter((r) => r.estado);
    if (filtros.q?.trim()) {
      const q = filtros.q.trim().toLowerCase();
      out = out.filter((r) => r.nombre.toLowerCase().includes(q));
    }
    return of(out);
  }

  create(input: UnidadMedidaInput) {
    this.creados.push(input);
    if (this.fallar) return throwError(() => new Error('409'));
    return of(fila({ unidadmedidaid: 99, ...input, orden: this.rows.length + 1 }));
  }

  update(id: number, input: UnidadMedidaInput) {
    this.actualizados.push({ id, input });
    if (this.fallar) return throwError(() => new Error('409'));
    // El PUT no lleva estado ni orden, así que la respuesta conserva los previos.
    const previo = this.rows.find((row) => row.unidadmedidaid === id);
    return of(fila({ ...previo, unidadmedidaid: id, ...input }));
  }

  remove(id: number) {
    this.eliminados.push(id);
    if (this.fallar) return throwError(() => new Error('409'));
    return of(undefined as unknown as void);
  }

  alternarEstado(unidadmedidaid: number) {
    this.alternados.push(unidadmedidaid);
    if (this.fallar) return throwError(() => new Error('500'));
    return of({ unidadmedidaid, estado: this.estadoResultante });
  }

  reordenar(ids: readonly number[], desde = 1) {
    this.reordenes.push({ ids: [...ids], desde });
    if (this.fallar) return throwError(() => new Error('500'));
    return of(undefined as unknown as void);
  }

  removeLote(ids: readonly number[]) {
    (this.lotes as number[][]).push([...ids]);
    if (this.fallar) return throwError(() => new Error('500'));
    return of(this.loteResultado ?? ids.map((unidadmedidaid) => ({ unidadmedidaid, ok: true })));
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

/** Deja correr las promesas encadenadas (confirmación → petición → notificación). */
async function asentar(fixture: { whenStable(): Promise<unknown>; detectChanges(): void }) {
  for (let i = 0; i < 3; i++) {
    await fixture.whenStable();
    fixture.detectChanges();
  }
}

async function setup(api = new UnidadMedidaApiMock()) {
  const confirm = new ConfirmServiceMock();
  const notify = new NotificationServiceMock();

  TestBed.configureTestingModule({
    imports: [UnidadMedidaListPage],
    providers: [
      // `erp-page-header` monta los breadcrumbs, que leen la ruta activa.
      provideRouter([]),
      { provide: UnidadMedidaApi, useValue: api },
      { provide: ConfirmService, useValue: confirm },
      { provide: NotificationService, useValue: notify },
    ],
  });

  const fixture = TestBed.createComponent(UnidadMedidaListPage);
  fixture.detectChanges();
  // El `loader` del recurso es asíncrono (petición + el descarte en cliente del híbrido), así
  // que hace falta más de un ciclo para que la primera carga llegue al DOM.
  await asentar(fixture);
  return { fixture, api, confirm, notify, el: fixture.nativeElement as HTMLElement };
}

/** Acceso al componente sin exponer sus miembros protegidos al resto del test. */
function comp(fixture: { componentInstance: unknown }) {
  return fixture.componentInstance as unknown as Record<string, (...a: never[]) => unknown> & {
    filters: { patchValue(v: unknown): void };
    form: { patchValue(v: unknown): void; getRawValue(): UnidadMedidaInput };
    rows(): UnidadMedida[];
    filtrando(): boolean;
    modalAbierto(): boolean;
    tituloModal(): string;
    seleccionadas(): { unidadmedidaid: number }[];
    onExportar(e: { formato: string; detalle: boolean }): void;
    onCerrar(): void;
    onApply(): void;
    onPageSize(n: number): void;
    onPage(n: number): void;
    rowsPagina(): UnidadMedida[];
    meta(): { page: number; pageSize: number; total: number; totalPages: number };
  };
}

function cabeceras(el: HTMLElement): string[] {
  return Array.from(el.querySelectorAll('thead th')).map((th) => th.textContent?.trim() ?? '');
}

function celdas(el: HTMLElement, colIndex: number): string[] {
  // +1: la primera celda es el checkbox de selección.
  return Array.from(el.querySelectorAll('tbody tr')).map(
    (tr) => tr.querySelectorAll('td')[colIndex + 1]?.textContent?.trim() ?? '',
  );
}

describe('UnidadMedidaListPage', () => {
  // La descarga crea un <a download> y lo pulsa. jsdom no implementa la navegación que eso
  // provoca y escupe un "Not implemented" por consola que no es un fallo, solo ruido.
  beforeEach(() => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    // No se sustituye `URL` entera (Angular la usa): solo estos dos métodos, que jsdom no trae
    // y por eso se asignan en vez de espiarse.
    URL.createObjectURL = vi.fn(() => 'blob:test');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('pinta el catálogo con la columna de orden y los dos códigos', async () => {
    // Las tres columnas que distinguen a esta pantalla: `#` (que solo existe desde la 0008) y
    // los dos códigos, el contable de dos caracteres y el internacional de SUNAT.
    const { el } = await setup();

    expect(el.querySelectorAll('tbody tr').length).toBe(2);
    expect(cabeceras(el)).toContain('#');
    expect(cabeceras(el)).toContain('ID contable');
    expect(cabeceras(el)).toContain('ID internacional');
    expect(celdas(el, 0)).toEqual(['1', '2']);
    expect(celdas(el, 3)).toEqual(['07', '12']);
    expect(celdas(el, 4)).toEqual(['NIU', 'BX']);
  });

  it('el filtro de texto va al SERVIDOR: buscar recarga el recurso con los parámetros', async () => {
    // No se filtra en memoria como en el molde: `phoenix.paunidadmedida_leer` recibe el filtro
    // y lo aplica con `public.buscar()`, que es la comparación del resto del sistema.
    const { fixture, api } = await setup();
    const c = comp(fixture);
    expect(api.consultas).toEqual([{ q: '', incluir_inactivas: false }]);

    c.filters.patchValue({ q: 'caja' });
    c.onApply();
    await asentar(fixture);

    expect(api.consultas.at(-1)).toEqual({ q: 'caja', incluir_inactivas: false });
    expect(c.rows().map((row) => row.unidadmedidaid)).toEqual([2]);
  });

  it('«Todas» pide las inactivas al servidor, que por defecto no las manda', async () => {
    // Es el motivo de ser de la 0008: el `paunidadmedida_leer` del legacy filtraba estado=true
    // a fuego y 17 de 27 unidades eran invisibles.
    const api = new UnidadMedidaApiMock();
    api.rows = [...api.rows, baldeInactiva()];
    const { fixture } = await setup(api);
    const c = comp(fixture);
    expect(c.rows().map((row) => row.unidadmedidaid)).toEqual([1, 2]);

    c.filters.patchValue({ estado: 'todas' });
    c.onApply();
    await asentar(fixture);

    expect(api.consultas.at(-1)).toEqual({ q: '', incluir_inactivas: true });
    expect(c.rows().map((row) => row.unidadmedidaid)).toEqual([1, 2, 30]);
  });

  it('«Solo inactivas» es híbrido: pide TODAS al servidor y descarta las activas en cliente', async () => {
    // El backend tiene un booleano, no un tri-estado: no sabe devolver solo las inactivas.
    const api = new UnidadMedidaApiMock();
    api.rows = [...api.rows, baldeInactiva()];
    const { fixture } = await setup(api);
    const c = comp(fixture);

    c.filters.patchValue({ estado: 'inactivas' });
    c.onApply();
    await asentar(fixture);

    expect(api.consultas.at(-1)).toEqual({ q: '', incluir_inactivas: true });
    expect(c.rows().map((row) => row.unidadmedidaid)).toEqual([30]);
  });

  it('alterna el estado y se queda con el valor que devuelve el backend', async () => {
    // Es un toggle: el cliente no manda el valor deseado, pero sí lee el resultante.
    const api = new UnidadMedidaApiMock();
    api.estadoResultante = false;
    const { fixture } = await setup(api);
    const c = comp(fixture);

    c.onToggleEstado(fila() as never);
    await asentar(fixture);

    expect(api.alternados).toEqual([1]);
    expect(c.rows()[0].estado).toBe(false);
  });

  it('revierte el estado si el backend falla', async () => {
    const api = new UnidadMedidaApiMock();
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
    expect(c.rows().map((row) => [row.unidadmedidaid, row.orden])).toEqual([
      [2, 1],
      [1, 2],
    ]);
  });

  it('revierte el orden si el backend falla', async () => {
    const api = new UnidadMedidaApiMock();
    api.fallar = true;
    const { fixture } = await setup(api);
    const c = comp(fixture);

    c.onReorder([...c.rows()].reverse() as never);
    await asentar(fixture);

    expect(c.rows().map((row) => row.unidadmedidaid)).toEqual([1, 2]);
  });

  it('el arrastre solo se enciende con el catálogo entero a la vista', async () => {
    // Incluido el filtro «Activas» que trae puesto la pantalla: reordenar viendo solo las
    // activas dejaría las inactivas intercaladas donde el azar quisiera.
    const { fixture } = await setup();
    const c = comp(fixture);
    expect(c.filtrando()).toBe(true);

    c.filters.patchValue({ estado: 'todas' });
    c.onApply();
    await asentar(fixture);
    expect(c.filtrando()).toBe(false);

    c.filters.patchValue({ q: 'caja' });
    c.onApply();
    await asentar(fixture);
    expect(c.filtrando()).toBe(true);
  });

  it('desactiva el arrastre cuando la lista no cabe en una página', async () => {
    // La grilla solo emitiría las filas visibles; renumerarlas desde 1 machacaría el resto.
    const api = new UnidadMedidaApiMock();
    api.rows = Array.from({ length: 30 }, (_, i) =>
      fila({ unidadmedidaid: i + 1, nombre: `FILA ${i + 1}`, orden: i + 1 }),
    );
    const { fixture } = await setup(api);
    const c = comp(fixture);

    c.filters.patchValue({ estado: 'todas' });
    c.onApply();
    await asentar(fixture);

    expect(c.filtrando()).toBe(true);
  });

  it('el alta manda solo los cuatro campos del formulario', async () => {
    // `estado` y `orden` no viajan: el backend los fija él (activa, al final de la lista) y cada
    // uno tiene su propia acción en la grilla.
    const { fixture, api, notify } = await setup();
    const c = comp(fixture);

    c.onNuevo();
    c.form.patchValue({
      nombre: 'DOCENA',
      abreviatura: 'DOC',
      codigo_contable: '12',
      codigo_internacional: 'DZN',
    });
    c.onGuardar();
    await asentar(fixture);

    expect(api.creados).toEqual([
      { nombre: 'DOCENA', abreviatura: 'DOC', codigo_contable: '12', codigo_internacional: 'DZN' },
    ]);
    expect(c.modalAbierto()).toBe(false);
    expect(notify.exitos.length).toBe(1);
  });

  it('el formulario no ofrece ni estado ni orden', async () => {
    // Tenerlos aquí daría un segundo camino para lo que ya hacen el arrastre y la etiqueta de
    // estado de la grilla — y el stored procedure ni siquiera los recibe.
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

  it('los maxlength del formulario salen de la COLUMNA, no del legacy', async () => {
    // UnidadMedidaEdit.php declara 20 para la abreviatura (varchar(10)) y para el código
    // contable (varchar(2)): dejaba escribir diez veces lo que cabe.
    const { fixture, el } = await setup();
    comp(fixture).onNuevo();
    fixture.detectChanges();

    const maxlength = (nombre: string) =>
      el.querySelector(`erp-modal [formControlName="${nombre}"]`)?.getAttribute('maxlength');

    expect(maxlength('nombre')).toBe('50');
    expect(maxlength('abreviatura')).toBe('10');
    expect(maxlength('codigo_contable')).toBe('2');
    expect(maxlength('codigo_internacional')).toBe('20');
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
    const api = new UnidadMedidaApiMock();
    api.fallar = true;
    const { fixture } = await setup(api);
    const c = comp(fixture);

    c.onNuevo();
    c.form.patchValue({ nombre: 'UNIDAD' });
    c.onGuardar();
    await asentar(fixture);

    expect(c.modalAbierto()).toBe(true);
    expect(c.form.getRawValue().nombre).toBe('UNIDAD');
  });

  it('editar precarga los campos editables y manda un PUT', async () => {
    const { fixture, api } = await setup();
    const c = comp(fixture);

    c.onEditar(fila() as never);
    expect(c.tituloModal()).toBe('Editar unidad de medida');
    expect(c.form.getRawValue()).toEqual({
      nombre: 'UNIDAD',
      abreviatura: 'UND',
      codigo_contable: '07',
      codigo_internacional: 'NIU',
    });

    c.form.patchValue({ nombre: 'UNIDAD EDITADA' });
    c.onGuardar();
    await asentar(fixture);

    expect(api.actualizados.length).toBe(1);
    expect(api.actualizados[0].id).toBe(1);
    expect(api.actualizados[0].input.nombre).toBe('UNIDAD EDITADA');
    expect(api.creados).toEqual([]);
  });

  it('la edición no cambia ni el estado ni el orden del registro', async () => {
    // Si volvieran al cuerpo, editar una unidad inactiva la reactivaría — y son 17.
    const api = new UnidadMedidaApiMock();
    api.rows = [fila(), baldeInactiva()];
    const { fixture } = await setup(api);
    const c = comp(fixture);

    c.filters.patchValue({ estado: 'todas' });
    c.onApply();
    await asentar(fixture);

    c.onEditar(baldeInactiva() as never);
    c.form.patchValue({ nombre: 'BALDE GRANDE' });
    c.onGuardar();
    await asentar(fixture);

    expect(api.actualizados[0].input).not.toHaveProperty('estado');
    expect(api.actualizados[0].input).not.toHaveProperty('orden');
    expect(c.rows().map((row) => [row.unidadmedidaid, row.estado, row.orden])).toEqual([
      [1, true, 1],
      [30, false, 3],
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

  it('eliminar quita la fila de la lista sin recargar el recurso', async () => {
    // El filtro es de servidor: recargar tras cada borrado costaría una petición y haría
    // parpadear la lista entera.
    const { fixture, api } = await setup();
    const c = comp(fixture);
    const consultasPrevias = api.consultas.length;

    c.onEliminar(fila() as never);
    await asentar(fixture);

    expect(api.eliminados).toEqual([1]);
    expect(c.rows().map((row) => row.unidadmedidaid)).toEqual([2]);
    expect(api.consultas.length).toBe(consultasPrevias);
  });

  it('la grilla ofrece checkbox de selección', async () => {
    const { el } = await setup();
    expect(el.querySelectorAll('tbody input[type="checkbox"]').length).toBe(2);
  });

  it('el borrado en lote va en UNA petición y quita las filas', async () => {
    const { fixture, api } = await setup();
    const c = comp(fixture);

    c.onSeleccion([{ unidadmedidaid: 1 }, { unidadmedidaid: 2 }] as never);
    c.onEliminarSeleccionadas();
    await asentar(fixture);

    expect(api.lotes).toEqual([[1, 2]]);
    expect(c.rows()).toEqual([]);
    expect(c.seleccionadas()).toEqual([]);
  });

  it('el lote es parcial: conserva las filas que fallaron', async () => {
    // El caso real: BALDE está inactiva pero la usan 2 productos, así que su borrado falla
    // mientras el resto del lote sí sale.
    const api = new UnidadMedidaApiMock();
    api.loteResultado = [
      { unidadmedidaid: 1, ok: true },
      { unidadmedidaid: 2, ok: false, mensaje: 'Tiene productos o pedidos relacionados.' },
    ];
    const { fixture, notify } = await setup(api);
    const c = comp(fixture);

    c.onSeleccion([{ unidadmedidaid: 1 }, { unidadmedidaid: 2 }] as never);
    c.onEliminarSeleccionadas();
    await asentar(fixture);

    expect(c.rows().map((row) => row.unidadmedidaid)).toEqual([2]);
    expect(notify.errores.length).toBe(1);
  });

  it('el borrado en lote pide confirmación', async () => {
    const { fixture, api, confirm } = await setup();
    const c = comp(fixture);
    confirm.respuesta = false;

    c.onSeleccion([{ unidadmedidaid: 1 }] as never);
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

    c.filters.patchValue({ q: 'caja' });
    c.onApply();
    await asentar(fixture);
    c.onExportar({ formato: 'csv', detalle: false });

    // La descarga la dispara `exportCsv` creando un <a> y pulsándolo.
    expect(anchor).toHaveBeenCalled();
    expect(c.rows().length).toBe(1);
  });

  it('sin historia previa, cerrar vuelve a /inicio', async () => {
    // ⚠ NO al índice de tablas básicas: esta pantalla no cuelga de ese hub, es una opción de
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

  it('pagina en CLIENTE: el endpoint filtra pero devuelve el catálogo entero', async () => {
    // Filtro en servidor y paginación en servidor no son lo mismo: la respuesta no trae `meta`.
    const api = new UnidadMedidaApiMock();
    api.rows = Array.from({ length: 30 }, (_, i) =>
      fila({ unidadmedidaid: i + 1, nombre: `FILA ${i + 1}`, orden: i + 1 }),
    );
    const { fixture, el } = await setup(api);
    const c = comp(fixture);

    expect(api.consultas.length).toBe(1);
    expect(c.meta()).toMatchObject({ total: 30, pageSize: 25, totalPages: 2 });
    expect(el.querySelectorAll('tbody tr').length).toBe(25);

    c.onPage(2);
    fixture.detectChanges();
    expect(el.querySelectorAll('tbody tr').length).toBe(5);
    // Cambiar de página no vuelve a pedir nada: las 30 filas ya estaban en memoria.
    expect(api.consultas.length).toBe(1);
  });
});
