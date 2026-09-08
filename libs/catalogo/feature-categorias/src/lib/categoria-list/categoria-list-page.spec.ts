import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { CategoriaApi } from '@phoenix/catalogo/data-access';
import type { Categoria, CategoriaFiltros, CategoriaInput } from '@phoenix/catalogo/domain';
import { ConfirmService, NotificationService } from '@phoenix/shared/ui';
import { CategoriaListPage } from './categoria-list-page';

function fila(over: Partial<Categoria> = {}): Categoria {
  return {
    categoriaid: 1,
    nombre: 'ABARROTES',
    abreviatura: 'ABA',
    cantidad_subcategorias: 3,
    ...over,
  };
}

/**
 * Doble del API.
 *
 * ⚠ `list` FILTRA, porque en esta pantalla el filtro por nombre va al SERVIDOR (`?q=`). El
 * doble replica ese comportamiento —y registra cada consulta en `consultas`— para que los
 * tests prueben lo que de verdad pasa (una recarga del recurso) y no un `filter` en memoria
 * que no existe.
 */
class CategoriaApiMock {
  rows: Categoria[] = [
    fila(),
    fila({ categoriaid: 2, nombre: 'BEBIDAS', abreviatura: 'BEB', cantidad_subcategorias: 0 }),
  ];

  readonly consultas: CategoriaFiltros[] = [];
  readonly eliminados: number[] = [];
  readonly creados: CategoriaInput[] = [];
  readonly actualizados: { id: number; input: CategoriaInput }[] = [];
  readonly lotes: readonly number[][] = [];
  /** Resultado por id del lote; por defecto todo OK. */
  loteResultado: { categoriaid: number; ok: boolean; mensaje?: string }[] | null = null;

  /** Cuando es true, las mutaciones fallan: sirve para probar el 409 y el modal abierto. */
  fallar = false;

  list(filtros: CategoriaFiltros = {}) {
    this.consultas.push({ ...filtros });
    let out = this.rows;
    if (filtros.q?.trim()) {
      const q = filtros.q.trim().toLowerCase();
      out = out.filter((r) => r.nombre.toLowerCase().includes(q));
    }
    return of(out);
  }

  create(input: CategoriaInput) {
    this.creados.push(input);
    if (this.fallar) return throwError(() => new Error('409'));
    return of(fila({ categoriaid: 99, ...input, cantidad_subcategorias: 0 }));
  }

  update(id: number, input: CategoriaInput) {
    this.actualizados.push({ id, input });
    if (this.fallar) return throwError(() => new Error('409'));
    const previo = this.rows.find((row) => row.categoriaid === id);
    return of(fila({ ...previo, categoriaid: id, ...input }));
  }

  remove(id: number) {
    this.eliminados.push(id);
    // 409 `categoria_has_relations`: la categoría tiene subcategorías registradas.
    if (this.fallar) return throwError(() => new Error('409'));
    return of(undefined as unknown as void);
  }

  removeLote(ids: readonly number[]) {
    (this.lotes as number[][]).push([...ids]);
    if (this.fallar) return throwError(() => new Error('500'));
    return of(this.loteResultado ?? ids.map((categoriaid) => ({ categoriaid, ok: true })));
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

async function setup(api = new CategoriaApiMock()) {
  const confirm = new ConfirmServiceMock();
  const notify = new NotificationServiceMock();

  TestBed.configureTestingModule({
    imports: [CategoriaListPage],
    providers: [
      // `erp-page-header` monta los breadcrumbs y el enlace a subcategorías necesita el router.
      provideRouter([]),
      { provide: CategoriaApi, useValue: api },
      { provide: ConfirmService, useValue: confirm },
      { provide: NotificationService, useValue: notify },
    ],
  });

  const fixture = TestBed.createComponent(CategoriaListPage);
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

/** Acceso al componente sin exponer sus miembros protegidos al resto del test. */
function comp(fixture: { componentInstance: unknown }) {
  return fixture.componentInstance as unknown as Record<string, (...a: never[]) => unknown> & {
    filters: { patchValue(v: unknown): void };
    form: { patchValue(v: unknown): void; getRawValue(): CategoriaInput };
    rows(): Categoria[];
    modalAbierto(): boolean;
    tituloModal(): string;
    seleccionadas(): { categoriaid: number }[];
    onExportar(e: { formato: string; detalle: boolean }): void;
    onCerrar(): void;
    onPage(n: number): void;
    rowsPagina(): Categoria[];
    meta(): { page: number; pageSize: number; total: number; totalPages: number };
  };
}

function celdas(el: HTMLElement, colIndex: number): string[] {
  // +1: la primera celda es el checkbox de selección.
  return Array.from(el.querySelectorAll('tbody tr')).map(
    (tr) => tr.querySelectorAll('td')[colIndex + 1]?.textContent?.trim() ?? '',
  );
}

describe('CategoriaListPage', () => {
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
    expect(celdas(el, 0)).toEqual(['ABARROTES', 'BEBIDAS']);
  });

  it('el filtro por nombre va al SERVIDOR: buscar recarga el recurso con `q`', async () => {
    // No se filtra en memoria: el endpoint acepta `?q=` y se lo pasa tal cual al stored
    // procedure.
    const { fixture, api } = await setup();
    const c = comp(fixture);
    expect(api.consultas).toEqual([{ q: '' }]);

    c.filters.patchValue({ q: 'bebi' });
    c.onApply();
    await asentar(fixture);

    expect(api.consultas.at(-1)).toEqual({ q: 'bebi' });
    expect(c.rows().map((row) => row.categoriaid)).toEqual([2]);
  });

  it('el filtro vacío no viaja como `q=`: sería filtrar por la cadena vacía', async () => {
    // Lo omite el servicio, no la pantalla; aquí se comprueba que la pantalla no lo esquiva
    // mandando otra cosa.
    const { fixture, api } = await setup();
    const c = comp(fixture);

    c.filters.patchValue({ q: '   ' });
    c.onApply();
    await asentar(fixture);

    expect(api.consultas.at(-1)).toEqual({ q: '   ' });
    expect(c.rows().length).toBe(2);
  });

  it('no ofrece columna de orden, ni de estado, ni arrastre: la tabla son tres columnas', async () => {
    // `catalogo.categoria` no tiene `estado` ni `orden`, y las funciones
    // pacategoria_cambiar_estado / _cambiar_orden que llama el legacy no existen en la base.
    const { el } = await setup();
    const cabeceras = Array.from(el.querySelectorAll('thead th')).map((th) =>
      th.textContent?.trim(),
    );
    expect(cabeceras).toContain('Nombre');
    expect(cabeceras).toContain('Abreviatura');
    expect(cabeceras).toContain('Subcategorías');
    expect(cabeceras).not.toContain('#');
    expect(cabeceras).not.toContain('Estado');
    expect(el.querySelector('.dragHandle')).toBeNull();
    expect(el.querySelector('tbody .badge')).toBeNull();
  });

  it('el contador de subcategorías es un enlace con el categoriaid en los query params', async () => {
    // Es el enlace padre → hijo del legacy (`SubCategoria.php?categoriaid=<id>`). La pantalla
    // de subcategorías lee ese query param.
    const { el } = await setup();
    const enlaces = Array.from(el.querySelectorAll<HTMLAnchorElement>('tbody a.sc-link'));

    expect(enlaces.length).toBe(2);
    expect(enlaces[0].getAttribute('href')).toBe('/mantenimiento/subcategorias?categoriaid=1');
    expect(enlaces[0].textContent?.trim()).toBe('3');
    expect(enlaces[1].getAttribute('href')).toBe('/mantenimiento/subcategorias?categoriaid=2');
  });

  it('el enlace se pinta apagado cuando la categoría no tiene subcategorías', async () => {
    const { el } = await setup();
    const enlaces = Array.from(el.querySelectorAll<HTMLAnchorElement>('tbody a.sc-link'));

    expect(enlaces[0].classList.contains('sc-link--vacio')).toBe(false);
    expect(enlaces[1].classList.contains('sc-link--vacio')).toBe(true);
  });

  it('el alta manda solo los dos campos del formulario', async () => {
    // `cantidad_subcategorias` es derivado y de solo lectura: no viaja nunca en el cuerpo.
    const { fixture, api, notify } = await setup();
    const c = comp(fixture);

    c.onNuevo();
    c.form.patchValue({ nombre: 'LIMPIEZA', abreviatura: 'LIM' });
    c.onGuardar();
    await asentar(fixture);

    expect(api.creados).toEqual([{ nombre: 'LIMPIEZA', abreviatura: 'LIM' }]);
    expect(c.modalAbierto()).toBe(false);
    expect(notify.exitos.length).toBe(1);
  });

  it('el formulario no ofrece ni estado, ni orden, ni el contador de subcategorías', async () => {
    const { fixture, el } = await setup();
    const c = comp(fixture);

    c.onNuevo();
    fixture.detectChanges();

    expect(c.form.getRawValue()).toEqual({ nombre: '', abreviatura: '' });
    expect(el.querySelector('erp-modal [formControlName="estado"]')).toBeNull();
    expect(el.querySelector('erp-modal [formControlName="orden"]')).toBeNull();
    expect(el.querySelector('erp-modal [formControlName="cantidad_subcategorias"]')).toBeNull();
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
    // ⚠ Aquí el duplicado DISTINGUE ACENTOS: «CAFÉ» y «CAFE» pueden coexistir, al contrario
    // que en las otras cuatro pantallas del módulo.
    const api = new CategoriaApiMock();
    api.fallar = true;
    const { fixture } = await setup(api);
    const c = comp(fixture);

    c.onNuevo();
    c.form.patchValue({ nombre: 'CAFÉ' });
    c.onGuardar();
    await asentar(fixture);

    expect(c.modalAbierto()).toBe(true);
    expect(c.form.getRawValue().nombre).toBe('CAFÉ');
  });

  it('editar precarga los campos y manda un PUT', async () => {
    const { fixture, api } = await setup();
    const c = comp(fixture);

    c.onEditar(fila() as never);
    expect(c.tituloModal()).toBe('Editar categoría');
    expect(c.form.getRawValue()).toEqual({ nombre: 'ABARROTES', abreviatura: 'ABA' });

    c.form.patchValue({ nombre: 'ABARROTES EDITADO' });
    c.onGuardar();
    await asentar(fixture);

    expect(api.actualizados.length).toBe(1);
    expect(api.actualizados[0].id).toBe(1);
    expect(api.actualizados[0].input).toEqual({
      nombre: 'ABARROTES EDITADO',
      abreviatura: 'ABA',
    });
    expect(api.creados).toEqual([]);
    expect(c.rows()[0].nombre).toBe('ABARROTES EDITADO');
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
    expect(c.rows().map((row) => row.categoriaid)).toEqual([2]);
  });

  it('un 409 al borrar deja la fila en la lista', async () => {
    // La categoría tiene subcategorías registradas: el backend responde 409
    // `categoria_has_relations` y el mensaje lo redacta él. La pantalla recarga y la fila
    // sigue ahí.
    const api = new CategoriaApiMock();
    api.fallar = true;
    const { fixture } = await setup(api);
    const c = comp(fixture);

    c.onEliminar(fila() as never);
    await asentar(fixture);

    expect(api.eliminados).toEqual([1]);
    expect(c.rows().map((row) => row.categoriaid)).toEqual([1, 2]);
  });

  it('la grilla ofrece checkbox de selección', async () => {
    const { el } = await setup();
    expect(el.querySelectorAll('tbody input[type="checkbox"]').length).toBe(2);
  });

  it('el borrado en lote va en UNA petición y quita las filas', async () => {
    const { fixture, api } = await setup();
    const c = comp(fixture);

    c.onSeleccion([{ categoriaid: 1 }, { categoriaid: 2 }] as never);
    c.onEliminarSeleccionadas();
    await asentar(fixture);

    expect(api.lotes).toEqual([[1, 2]]);
    expect(c.rows()).toEqual([]);
    expect(c.seleccionadas()).toEqual([]);
  });

  it('el lote es parcial: conserva las filas que fallaron', async () => {
    const api = new CategoriaApiMock();
    api.loteResultado = [
      { categoriaid: 1, ok: false, mensaje: 'Tiene subcategorías registradas.' },
      { categoriaid: 2, ok: true },
    ];
    const { fixture, notify } = await setup(api);
    const c = comp(fixture);

    c.onSeleccion([{ categoriaid: 1 }, { categoriaid: 2 }] as never);
    c.onEliminarSeleccionadas();
    await asentar(fixture);

    expect(c.rows().map((row) => row.categoriaid)).toEqual([1]);
    expect(notify.errores.length).toBe(1);
  });

  it('el borrado en lote pide confirmación', async () => {
    const { fixture, api, confirm } = await setup();
    const c = comp(fixture);
    confirm.respuesta = false;

    c.onSeleccion([{ categoriaid: 1 }] as never);
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

    c.filters.patchValue({ q: 'bebi' });
    c.onApply();
    await asentar(fixture);
    c.onExportar({ formato: 'csv', detalle: false });

    // La descarga la dispara `exportCsv` creando un <a> y pulsándolo.
    expect(anchor).toHaveBeenCalled();
    expect(c.rows().length).toBe(1);
  });

  it('sin historia previa, cerrar vuelve a /inicio', async () => {
    // Esta pantalla NO cuelga del índice de tablas básicas: es una opción de menú propia, así
    // que subir allí llevaría al usuario a una pantalla que no es su padre.
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

  it('pagina en CLIENTE: el endpoint devuelve el catálogo entero sin meta', async () => {
    const api = new CategoriaApiMock();
    api.rows = Array.from({ length: 30 }, (_, i) =>
      fila({ categoriaid: i + 1, nombre: `FILA ${i + 1}` }),
    );
    const { fixture, el } = await setup(api);
    const c = comp(fixture);

    expect(c.meta()).toMatchObject({ total: 30, pageSize: 25, totalPages: 2 });
    expect(el.querySelectorAll('tbody tr').length).toBe(25);

    c.onPage(2);
    fixture.detectChanges();
    expect(el.querySelectorAll('tbody tr').length).toBe(5);
    // Cambiar de página NO vuelve a pedir nada: solo el filtro va al servidor.
    expect(api.consultas.length).toBe(1);
  });

  it('el total del pie refleja el filtro del servidor, no el universo', async () => {
    const { fixture } = await setup();
    const c = comp(fixture);

    c.filters.patchValue({ q: 'bebi' });
    c.onApply();
    await asentar(fixture);

    expect(c.meta()).toMatchObject({ total: 1, page: 1 });
  });
});
