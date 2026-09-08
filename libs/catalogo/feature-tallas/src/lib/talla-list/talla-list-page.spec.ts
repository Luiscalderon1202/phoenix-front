import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { TallaApi } from '@phoenix/catalogo/data-access';
import type {
  Talla,
  TallaFiltros,
  TallaInput,
  ResultadoLoteTalla,
} from '@phoenix/catalogo/domain';
import { ConfirmService, NotificationService } from '@phoenix/shared/ui';
import { TallaListPage } from './talla-list-page';

function talla(over: Partial<Talla> = {}): Talla {
  return {
    tallaid: 1,
    nombre: 'EXTRA GRANDE',
    abreviatura: 'XL',
    orden: 1,
    estado: true,
    cantidad_productos: 0,
    ...over,
  };
}

/**
 * Doble del API que se comporta como el backend de verdad.
 *
 * ⚠ `list()` FILTRA POR NOMBRE (como `catalogo.patalla_leer`) pero NO por estado ni por página:
 * devuelve el catálogo entero, activas e inactivas. Es justo ese reparto —nombre al servidor,
 * estado y paginación al cliente— el que prueban los tests de abajo, y con un doble que
 * filtrase por estado no se distinguiría de un filtro delegado.
 */
class TallaApiMock {
  rows: Talla[] = [
    talla(),
    talla({ tallaid: 2, nombre: 'MEDIANA', abreviatura: 'M', orden: 2, cantidad_productos: 3 }),
  ];

  /** Los filtros que ha recibido `list()`, en orden. */
  readonly consultas: TallaFiltros[] = [];
  readonly creadas: TallaInput[] = [];
  readonly actualizadas: { id: number; input: TallaInput }[] = [];
  readonly eliminadas: number[] = [];
  readonly lotes: readonly number[][] = [];
  readonly alternadas: number[] = [];
  readonly reordenes: { ids: number[]; desde: number }[] = [];

  /** Resultado por id del lote; por defecto todo OK. */
  loteResultado: ResultadoLoteTalla[] | null = null;
  /** Estado que devuelve `alternarEstado` (el contrato manda el RESULTANTE). */
  estadoResultante = false;
  /** Cuando es true, las mutaciones fallan: sirve para probar la reversión optimista. */
  fallar = false;

  list(filtros: TallaFiltros = {}) {
    this.consultas.push({ ...filtros });
    let out = this.rows;
    if (filtros.q?.trim()) {
      const q = filtros.q.trim().toLocaleLowerCase('es');
      out = out.filter((g) => g.nombre.toLocaleLowerCase('es').includes(q));
    }
    return of(out);
  }

  create(input: TallaInput) {
    this.creadas.push(input);
    if (this.fallar) return throwError(() => new Error('409'));
    const creada = talla({ tallaid: 99, ...input, orden: this.rows.length + 1 });
    this.rows = [...this.rows, creada];
    return of(creada);
  }

  update(id: number, input: TallaInput) {
    this.actualizadas.push({ id, input });
    if (this.fallar) return throwError(() => new Error('409'));
    const previa = this.rows.find((row) => row.tallaid === id);
    const actualizada = talla({ ...previa, tallaid: id, ...input });
    this.rows = this.rows.map((row) => (row.tallaid === id ? actualizada : row));
    return of(actualizada);
  }

  remove(id: number) {
    this.eliminadas.push(id);
    if (this.fallar) return throwError(() => new Error('409'));
    this.rows = this.rows.filter((row) => row.tallaid !== id);
    return of(undefined as unknown as void);
  }

  removeLote(ids: readonly number[]) {
    (this.lotes as number[][]).push([...ids]);
    if (this.fallar) return throwError(() => new Error('500'));
    const resultados = this.loteResultado ?? ids.map((tallaid) => ({ tallaid, ok: true }));
    const borradas = new Set(resultados.filter((r) => r.ok).map((r) => r.tallaid));
    this.rows = this.rows.filter((row) => !borradas.has(row.tallaid));
    return of(resultados);
  }

  alternarEstado(tallaid: number) {
    this.alternadas.push(tallaid);
    if (this.fallar) return throwError(() => new Error('500'));
    return of({ tallaid, estado: this.estadoResultante });
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

async function setup(api = new TallaApiMock()) {
  const confirm = new ConfirmServiceMock();
  const notify = new NotificationServiceMock();

  TestBed.configureTestingModule({
    imports: [TallaListPage],
    providers: [
      // `erp-page-header` monta los breadcrumbs, que leen la ruta activa.
      provideRouter([]),
      { provide: TallaApi, useValue: api },
      { provide: ConfirmService, useValue: confirm },
      { provide: NotificationService, useValue: notify },
    ],
  });

  const fixture = TestBed.createComponent(TallaListPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, api, confirm, notify, el: fixture.nativeElement as HTMLElement };
}

/** Deja correr las promesas encadenadas y repinta. */
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
    form: { patchValue(v: unknown): void; getRawValue(): TallaInput };
    columns: { key: string; header?: string; sortable?: boolean }[];
    rows(): Talla[];
    rowsPagina(): Talla[];
    modalAbierto(): boolean;
    tituloModal(): string;
    seleccionadas(): { tallaid: number }[];
    filtrando(): boolean;
    onExportar(e: { formato: string; detalle: boolean }): void;
    onCerrar(): void;
    onApply(): void;
    onPage(n: number): void;
    onPageSize(n: number): void;
    meta(): { page: number; pageSize: number; total: number; totalPages: number };
  };
}

/** Último filtro que recibió el backend. */
function ultima(api: TallaApiMock): TallaFiltros {
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
function catalogo(n: number): Talla[] {
  return Array.from({ length: n }, (_, i) =>
    talla({
      tallaid: i + 1,
      nombre: `TALLA ${String(i + 1).padStart(2, '0')}`,
      abreviatura: `G${i + 1}`,
      orden: i + 1,
    }),
  );
}

describe('TallaListPage', () => {
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

  it('pinta el catálogo con la columna de orden y la de estado', async () => {
    const { fixture, el } = await setup();
    const c = comp(fixture);

    expect(el.querySelectorAll('tbody tr').length).toBe(2);
    expect(c.columns.map((col) => col.key)).toEqual([
      'orden',
      'nombre',
      'abreviatura',
      'cantidad_productos',
      'estado',
    ]);
    expect(celdas(el, 1)).toEqual(['EXTRA GRANDE', 'MEDIANA']);
  });

  it('ninguna columna es ordenable', async () => {
    // El orden de este catálogo es un dato editable (`orden`), no una vista: dejar ordenar por
    // columna haría que el arrastre guardase un orden que no es el que se está viendo.
    const { fixture, el } = await setup();
    expect(comp(fixture).columns.some((col) => col.sortable)).toBe(false);
    expect(el.querySelectorAll('thead .sort').length).toBe(0);
  });

  it('arranca mostrando activas e inactivas, sin mandarle el estado al backend', async () => {
    // `catalogo.patalla_leer` no tiene parámetro de estado: devuelve todo. Por eso el selector
    // arranca en «Todos» y el filtro se resuelve en el cliente.
    const api = new TallaApiMock();
    api.rows = [talla(), talla({ tallaid: 2, nombre: 'APAGADA', estado: false, orden: 2 })];
    const { fixture } = await setup(api);

    expect(ultima(api)).toEqual({ q: '' });
    expect(comp(fixture).rows().map((row) => row.nombre)).toEqual(['EXTRA GRANDE', 'APAGADA']);
  });

  it('el filtro por nombre VA AL SERVIDOR', async () => {
    // Filtrar aquí sería reimplementar `public.buscar()`, que normaliza tildes con dos erratas
    // conocidas: mejor heredar la comparación que hace el resto del sistema.
    const { fixture, api } = await setup();
    const c = comp(fixture);

    c.filters.patchValue({ q: 'mediana' });
    c.onApply();
    await asentar(fixture);

    expect(ultima(api).q).toBe('mediana');
    expect(c.rows().map((row) => row.nombre)).toEqual(['MEDIANA']);
  });

  it('el filtro de estado se resuelve EN CLIENTE, sin volver a consultar', async () => {
    // El endpoint no sabe filtrar por estado, así que no hay nada que delegarle: cambiar el
    // selector no debe disparar una petición.
    const api = new TallaApiMock();
    api.rows = [talla(), talla({ tallaid: 2, nombre: 'APAGADA', estado: false, orden: 2 })];
    const { fixture } = await setup(api);
    const c = comp(fixture);
    const antes = api.consultas.length;

    c.filters.patchValue({ estado: 'inactivas' });
    c.onApply();
    await asentar(fixture);

    expect(api.consultas.length).toBe(antes); // ni una petición más
    expect(c.rows().map((row) => row.nombre)).toEqual(['APAGADA']);

    c.filters.patchValue({ estado: 'activas' });
    c.onApply();
    await asentar(fixture);
    expect(c.rows().map((row) => row.nombre)).toEqual(['EXTRA GRANDE']);
  });

  it('la paginación es de CLIENTE: trocea lo que ya trajo', async () => {
    // El endpoint devuelve el catálogo entero y sin `meta`: no existe `patalla_count`.
    const api = new TallaApiMock();
    api.rows = catalogo(30);
    const { fixture, el } = await setup(api);
    const c = comp(fixture);
    const antes = api.consultas.length;

    expect(c.rows().length).toBe(30); // todo en memoria
    expect(el.querySelectorAll('tbody tr').length).toBe(25); // solo se pinta la página
    expect(c.meta()).toMatchObject({ page: 1, pageSize: 25, total: 30, totalPages: 2 });

    c.onPage(2);
    fixture.detectChanges();

    expect(api.consultas.length).toBe(antes); // no se vuelve al servidor
    expect(c.rowsPagina().length).toBe(5);
    expect(c.rowsPagina()[0].nombre).toBe('TALLA 26');
  });

  it('cambiar el tamaño de página vuelve a la primera', async () => {
    const api = new TallaApiMock();
    api.rows = catalogo(30);
    const { fixture } = await setup(api);
    const c = comp(fixture);

    c.onPage(2);
    c.onPageSize(10);
    fixture.detectChanges();

    expect(c.meta()).toMatchObject({ page: 1, pageSize: 10, total: 30, totalPages: 3 });
  });

  it('alterna el estado y se queda con el valor que devuelve el backend', async () => {
    // El endpoint es un TOGGLE: no se le manda el valor deseado. Pero sí devuelve el resultante,
    // y es ése el que se pinta.
    const api = new TallaApiMock();
    api.estadoResultante = false;
    const { fixture } = await setup(api);
    const c = comp(fixture);

    c.onToggleEstado(talla() as never);
    await asentar(fixture);

    expect(api.alternadas).toEqual([1]);
    expect(c.rows()[0].estado).toBe(false);
  });

  it('revierte el estado si el backend falla', async () => {
    const api = new TallaApiMock();
    api.fallar = true;
    const { fixture } = await setup(api);
    const c = comp(fixture);

    c.onToggleEstado(talla() as never);
    await asentar(fixture);

    expect(c.rows()[0].estado).toBe(true);
  });

  it('al reordenar manda la lista completa desde la posición 1 y renumera en local', async () => {
    // Aquí la función es del LEGACY y ya sirve: `catalogo.patalla_cambiar_orden` recibe `vstart`
    // y numera `orden = posición + (vstart-1)`. La pantalla le manda 1 porque solo deja arrastrar
    // con el catálogo entero a la vista, así que la numeración queda 1..n.
    const { fixture, api } = await setup();
    const c = comp(fixture);

    const invertido = [...c.rows()].reverse();
    c.onReorder(invertido as never);
    await asentar(fixture);

    expect(api.reordenes).toEqual([{ ids: [2, 1], desde: 1 }]);
    expect(c.rows().map((row) => [row.tallaid, row.orden])).toEqual([
      [2, 1],
      [1, 2],
    ]);
  });

  it('revierte el orden si el backend falla', async () => {
    const api = new TallaApiMock();
    api.fallar = true;
    const { fixture } = await setup(api);
    const c = comp(fixture);

    const antes = c.rows().map((row) => row.tallaid);
    c.onReorder([...c.rows()].reverse() as never);
    await asentar(fixture);

    expect(c.rows().map((row) => row.tallaid)).toEqual(antes);
  });

  it('el arrastre solo se enciende con el catálogo entero a la vista', async () => {
    // Con cualquier filtro puesto la grilla emitiría solo las filas visibles, y renumerarlas
    // desde 1 machacaría el `orden` de las que no se ven.
    const { fixture } = await setup();
    const c = comp(fixture);
    expect(c.filtrando()).toBe(false); // arranca en «Todos» y sin texto

    c.filters.patchValue({ estado: 'activas' });
    c.onApply();
    await asentar(fixture);
    expect(c.filtrando()).toBe(true);

    c.filters.patchValue({ estado: 'todas', q: 'mediana' });
    c.onApply();
    await asentar(fixture);
    expect(c.filtrando()).toBe(true);
  });

  it('desactiva el arrastre cuando la lista no cabe en una página', async () => {
    const api = new TallaApiMock();
    api.rows = catalogo(30);
    const { fixture } = await setup(api);
    const c = comp(fixture);

    expect(c.meta().totalPages).toBe(2);
    expect(c.filtrando()).toBe(true);

    c.onPageSize(100);
    fixture.detectChanges();
    expect(c.filtrando()).toBe(false);
  });

  it('el alta manda SOLO los dos campos del formulario', async () => {
    // Ni `estado` ni `orden` ni `cantidad_productos`: los dos primeros tienen su propia acción
    // en la grilla y el tercero es derivado.
    const { fixture, api, notify } = await setup();
    const c = comp(fixture);

    c.onNuevo();
    c.form.patchValue({ nombre: 'PEQUEÑA', abreviatura: 'S' });
    c.onGuardar();
    await asentar(fixture);

    expect(api.creadas).toEqual([{ nombre: 'PEQUEÑA', abreviatura: 'S' }]);
    expect(c.modalAbierto()).toBe(false);
    expect(notify.exitos.length).toBe(1);
  });

  it('el formulario no ofrece ni estado, ni orden, ni el conteo de productos', async () => {
    const { fixture, el } = await setup();
    const c = comp(fixture);

    c.onNuevo();
    fixture.detectChanges();

    expect(c.form.getRawValue()).toEqual({ nombre: '', abreviatura: '' });
    expect(el.querySelector('erp-modal [formControlName="estado"]')).toBeNull();
    expect(el.querySelector('erp-modal [formControlName="orden"]')).toBeNull();
    expect(el.querySelector('erp-modal [formControlName="cantidad_productos"]')).toBeNull();
  });

  it('tras crear añade la fila al final sin volver al servidor', async () => {
    // El backend coloca el alta al final del orden (`patalla_ultimo_orden()+1`), así que la
    // lista en memoria puede reflejarlo sin recargar y sin hacer parpadear la pantalla.
    const { fixture, api } = await setup();
    const c = comp(fixture);
    const antes = api.consultas.length;

    c.onNuevo();
    c.form.patchValue({ nombre: 'PEQUEÑA', abreviatura: 'S' });
    c.onGuardar();
    await asentar(fixture);

    expect(api.consultas.length).toBe(antes);
    expect(c.rows().map((row) => row.nombre)).toEqual(['EXTRA GRANDE', 'MEDIANA', 'PEQUEÑA']);
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
    const api = new TallaApiMock();
    api.fallar = true;
    const { fixture } = await setup(api);
    const c = comp(fixture);

    c.onNuevo();
    c.form.patchValue({ nombre: 'EXTRA GRANDE', abreviatura: 'XL' });
    c.onGuardar();
    await asentar(fixture);

    expect(c.modalAbierto()).toBe(true);
    expect(c.form.getRawValue()).toEqual({ nombre: 'EXTRA GRANDE', abreviatura: 'XL' });
  });

  it('editar precarga los dos campos y manda un PUT', async () => {
    const { fixture, api } = await setup();
    const c = comp(fixture);

    c.onEditar(talla({ tallaid: 2, nombre: 'MEDIANA', abreviatura: 'M' }) as never);
    expect(c.tituloModal()).toBe('Editar talla');
    expect(c.form.getRawValue()).toEqual({ nombre: 'MEDIANA', abreviatura: 'M' });

    c.form.patchValue({ nombre: 'MEDIANA LARGA' });
    c.onGuardar();
    await asentar(fixture);

    expect(api.actualizadas).toEqual([
      { id: 2, input: { nombre: 'MEDIANA LARGA', abreviatura: 'M' } },
    ]);
    expect(api.creadas).toEqual([]);
  });

  it('la edición no cambia ni el estado ni el orden del registro', async () => {
    // El backend le devuelve al stored procedure el estado que la fila ya tenía, y su update no
    // menciona la columna `orden`.
    const api = new TallaApiMock();
    api.rows = [talla({ tallaid: 1, estado: false, orden: 7 })];
    const { fixture } = await setup(api);
    const c = comp(fixture);

    c.onEditar(api.rows[0] as never);
    c.form.patchValue({ nombre: 'RENOMBRADO' });
    c.onGuardar();
    await asentar(fixture);

    expect(c.rows()[0]).toMatchObject({ nombre: 'RENOMBRADO', estado: false, orden: 7 });
  });

  it('eliminar pide confirmación antes de llamar al backend', async () => {
    const { fixture, api, confirm } = await setup();
    const c = comp(fixture);
    confirm.respuesta = false;

    c.onEliminar(talla() as never);
    await asentar(fixture);

    expect(confirm.preguntas.length).toBe(1);
    expect(api.eliminadas).toEqual([]);
  });

  it('elimina y quita la fila de la lista', async () => {
    const { fixture, api, notify } = await setup();
    const c = comp(fixture);

    c.onEliminar(talla() as never);
    await asentar(fixture);

    expect(api.eliminadas).toEqual([1]);
    expect(c.rows().map((row) => row.tallaid)).toEqual([2]);
    expect(notify.exitos.length).toBe(1);
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
    const api = new TallaApiMock();
    api.loteResultado = [
      { tallaid: 1, ok: true },
      { tallaid: 2, ok: false, codigo: 'talla_has_relations', mensaje: 'Tiene productos registrados.' },
    ];
    const { fixture, notify } = await setup(api);
    const c = comp(fixture);

    c.onSeleccion([{ tallaid: 1 }, { tallaid: 2 }] as never);
    c.onEliminarSeleccionadas();
    await asentar(fixture);

    expect(c.rows().map((row) => row.tallaid)).toEqual([2]);
    expect(notify.exitos).toEqual(['Se eliminaron 1 registro(s).']);
    expect(notify.errores.length).toBe(1);
    expect(notify.errores[0]).toContain('Tiene productos registrados.');
  });

  it('sin productos, la celda queda en gris', async () => {
    // Un cero repetido 25 veces es ruido; el legacy también deja la celda en blanco.
    const api = new TallaApiMock();
    api.rows = [talla({ cantidad_productos: 0 })];
    const { el } = await setup(api);

    expect(celdas(el, 3)).toEqual(['—']);
    expect(el.querySelector('tbody .badge--conteo')).toBeNull();
  });

  it('con un solo producto lo dice con palabras, sin badge', async () => {
    const api = new TallaApiMock();
    api.rows = [talla({ cantidad_productos: 1 })];
    const { el } = await setup(api);

    expect(celdas(el, 3)).toEqual(['Solo un producto']);
    expect(el.querySelector('tbody .badge--conteo')).toBeNull();
  });

  it('con varios productos pinta el número en un badge', async () => {
    const api = new TallaApiMock();
    api.rows = [talla({ cantidad_productos: 12 })];
    const { el } = await setup(api);

    expect(celdas(el, 3)).toEqual(['12 productos']);
    expect(el.querySelector('tbody .badge--conteo')?.textContent?.trim()).toBe('12');
  });

  it('lleva un único menú —Exportar— y el botón de cerrar en la cabecera', async () => {
    // Este recurso no tiene reporte PDF, así que tampoco menú Imprimir ni visor.
    const { el } = await setup();
    expect(el.querySelectorAll('erp-export-menu').length).toBe(1);
    expect(el.querySelector('.btn-cerrar')).not.toBeNull();
    expect(el.querySelector('erp-file-viewer')).toBeNull();
    expect(el.querySelector('erp-print-header')).toBeNull();
  });

  it('exporta lo filtrado sin pedir nada al backend', async () => {
    // Todo está en memoria: se genera en el navegador.
    const anchor = vi.spyOn(HTMLAnchorElement.prototype, 'click');
    const api = new TallaApiMock();
    api.rows = catalogo(30);
    const { fixture } = await setup(api);
    const c = comp(fixture);
    const antes = api.consultas.length;

    c.onExportar({ formato: 'csv', detalle: false });

    expect(anchor).toHaveBeenCalled();
    expect(api.consultas.length).toBe(antes);
    expect(c.rows().length).toBe(30); // se exporta todo lo filtrado, no solo la página
  });

  it('sin historia previa, cerrar vuelve a /inicio', async () => {
    // ⚠ NO a /mantenimiento/tablas-basicas: Tallas no cuelga de ese hub.
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
