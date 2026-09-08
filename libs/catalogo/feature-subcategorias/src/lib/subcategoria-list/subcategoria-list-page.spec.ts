import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { CategoriaApi, SubcategoriaApi } from '@phoenix/catalogo/data-access';
import type {
  Categoria,
  Subcategoria,
  SubcategoriaFiltros,
  SubcategoriaInput,
} from '@phoenix/catalogo/domain';
import { ConfirmService, NotificationService } from '@phoenix/shared/ui';
import { SubcategoriaListPage } from './subcategoria-list-page';

function fila(over: Partial<Subcategoria> = {}): Subcategoria {
  return {
    subcategoriaid: 1,
    nombre: 'GENERICOS',
    abreviatura: 'GEN',
    categoriaid: 1,
    categoria_nombre: 'ABARROTES',
    count_productos: 0,
    ...over,
  };
}

/**
 * Doble del API: registra lo que se le pide y devuelve lo que se le configure.
 *
 * `consultas` es lo que hace útil este doble: los DOS filtros de la pantalla van al SERVIDOR,
 * así que la única forma de comprobarlos es mirar con qué se llamó a `list()`.
 */
class SubcategoriaApiMock {
  rows: Subcategoria[] = [
    fila(),
    fila({
      subcategoriaid: 2,
      nombre: 'LACTEOS',
      abreviatura: 'LAC',
      categoriaid: 2,
      categoria_nombre: 'REFRIGERADOS',
      count_productos: 4,
    }),
  ];

  /** Cada llamada a `list()`, con sus filtros: los filtros se resuelven en el backend. */
  readonly consultas: SubcategoriaFiltros[] = [];
  readonly eliminados: number[] = [];
  readonly creados: SubcategoriaInput[] = [];
  readonly actualizados: { id: number; input: SubcategoriaInput }[] = [];
  readonly lotes: readonly number[][] = [];
  /** Resultado por id del lote; por defecto todo OK. */
  loteResultado: { subcategoriaid: number; ok: boolean; mensaje?: string }[] | null = null;

  /** Cuando es true, las mutaciones fallan: sirve para probar el modal que se queda abierto. */
  fallar = false;

  list(filtros: SubcategoriaFiltros = {}) {
    this.consultas.push(filtros);
    // El filtro lo aplica el backend; aquí se emula lo justo para que las filas cuadren.
    const catid = filtros.categoriaid;
    const texto = (filtros.q ?? '').toLocaleLowerCase('es');
    return of(
      this.rows.filter(
        (row) =>
          (!catid || row.categoriaid === catid) &&
          (!texto || row.nombre.toLocaleLowerCase('es').includes(texto)),
      ),
    );
  }

  create(input: SubcategoriaInput) {
    this.creados.push(input);
    if (this.fallar) return throwError(() => new Error('409'));
    return of(fila({ subcategoriaid: 99, ...input }));
  }

  update(id: number, input: SubcategoriaInput) {
    this.actualizados.push({ id, input });
    if (this.fallar) return throwError(() => new Error('409'));
    const previo = this.rows.find((row) => row.subcategoriaid === id);
    return of(fila({ ...previo, subcategoriaid: id, ...input }));
  }

  remove(id: number) {
    this.eliminados.push(id);
    if (this.fallar) return throwError(() => new Error('409'));
    return of(undefined as unknown as void);
  }

  removeLote(ids: readonly number[]) {
    (this.lotes as number[][]).push([...ids]);
    if (this.fallar) return throwError(() => new Error('500'));
    return of(this.loteResultado ?? ids.map((subcategoriaid) => ({ subcategoriaid, ok: true })));
  }
}

/** Doble del catálogo padre: puebla el desplegable del filtro y el selector del formulario. */
class CategoriaApiMock {
  categorias: Categoria[] = [
    { categoriaid: 1, nombre: 'ABARROTES', abreviatura: 'ABA', cantidad_subcategorias: 1 },
    { categoriaid: 2, nombre: 'REFRIGERADOS', abreviatura: 'REF', cantidad_subcategorias: 1 },
  ];
  list() {
    return of(this.categorias);
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

/**
 * Monta la pantalla. `categoriaidUrl` simula llegar desde el listado de Categorías con
 * `?categoriaid=<id>`, que es el enlace padre→hijo del legacy.
 */
async function setup(api = new SubcategoriaApiMock(), categoriaidUrl?: string) {
  const confirm = new ConfirmServiceMock();
  const notify = new NotificationServiceMock();
  const categoriaApi = new CategoriaApiMock();

  TestBed.configureTestingModule({
    imports: [SubcategoriaListPage],
    providers: [
      // `erp-page-header` monta los breadcrumbs, que leen la ruta activa.
      provideRouter([]),
      { provide: SubcategoriaApi, useValue: api },
      { provide: CategoriaApi, useValue: categoriaApi },
      { provide: ConfirmService, useValue: confirm },
      { provide: NotificationService, useValue: notify },
      // Va DESPUÉS de `provideRouter` para ganarle el token: la pantalla lee el query param
      // del `snapshot`, y sin ruta real no hay forma de ponerlo en la URL.
      ...(categoriaidUrl === undefined
        ? []
        : [
            {
              provide: ActivatedRoute,
              useValue: {
                snapshot: { queryParamMap: convertToParamMap({ categoriaid: categoriaidUrl }) },
              },
            },
          ]),
    ],
  });

  const fixture = TestBed.createComponent(SubcategoriaListPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, api, categoriaApi, confirm, notify, el: fixture.nativeElement as HTMLElement };
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
    filters: { patchValue(v: unknown): void; getRawValue(): { q: string; categoriaid: string } };
    form: { patchValue(v: unknown): void; getRawValue(): SubcategoriaInput };
    rows(): Subcategoria[];
    categorias(): Categoria[];
    columns: { key: string; header?: string }[];
    modalAbierto(): boolean;
    tituloModal(): string;
    seleccionadas(): { subcategoriaid: number }[];
    onExportar(e: { formato: string; detalle: boolean }): void;
    onCerrar(): void;
    onPageSize(n: number): void;
    onPage(n: number): void;
    rowsPagina(): Subcategoria[];
    meta(): { page: number; pageSize: number; total: number; totalPages: number };
  };
}

function celdas(el: HTMLElement, colIndex: number): string[] {
  // +1: la primera celda es el checkbox de selección.
  return Array.from(el.querySelectorAll('tbody tr')).map(
    (tr) => tr.querySelectorAll('td')[colIndex + 1]?.textContent?.trim() ?? '',
  );
}

describe('SubcategoriaListPage', () => {
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
  });

  it('el filtro de texto va al SERVIDOR, no se resuelve en memoria', async () => {
    // `pasubcategoria_leer(vnombre, ...)` lo aplica bien, así que se le manda.
    const { fixture, api } = await setup();
    const c = comp(fixture);

    c.filters.patchValue({ q: '  lacteos  ' });
    c.onApply();
    await asentar(fixture);

    expect(api.consultas.length).toBe(2);
    expect(api.consultas.at(-1)?.q).toBe('lacteos'); // recortado
    expect(c.rows().map((row) => row.subcategoriaid)).toEqual([2]);
  });

  it('el filtro de categoría va al SERVIDOR como entero', async () => {
    // El `<select>` devuelve texto; el contrato pide un entero.
    const { fixture, api } = await setup();
    const c = comp(fixture);

    c.filters.patchValue({ categoriaid: '2' });
    c.onApply();
    await asentar(fixture);

    expect(api.consultas.at(-1)?.categoriaid).toBe(2);
    expect(c.rows().map((row) => row.subcategoriaid)).toEqual([2]);
  });

  it('«Todas las categorías» manda undefined, no 0 ni cadena vacía', async () => {
    // El desplegable del legacy manda `-1` como centinela; aquí la ausencia de filtro se
    // expresa omitiendo el parámetro.
    const { fixture, api } = await setup();
    const c = comp(fixture);

    c.filters.patchValue({ categoriaid: '2' });
    c.onApply();
    await asentar(fixture);

    c.filters.patchValue({ categoriaid: '' });
    c.onApply();
    await asentar(fixture);

    const ultima = api.consultas.at(-1);
    expect(ultima?.categoriaid).toBeUndefined();
    expect(ultima?.categoriaid).not.toBe(0);
    expect(ultima?.categoriaid as unknown).not.toBe('');
    expect(c.rows().length).toBe(2);
  });

  it('el desplegable de categorías se puebla del catálogo padre', async () => {
    // Segundo `resource`: reusa `GET /categorias`, no hay endpoint de catálogo aparte.
    const { fixture, el } = await setup();
    const c = comp(fixture);

    expect(c.categorias().map((cat) => cat.nombre)).toEqual(['ABARROTES', 'REFRIGERADOS']);

    const opciones = Array.from(
      el.querySelectorAll<HTMLOptionElement>('select[formControlName="categoriaid"] option'),
    ).map((o) => o.textContent?.trim());
    expect(opciones).toEqual(['Todas las categorías', 'ABARROTES', 'REFRIGERADOS']);
  });

  it('el mismo catálogo alimenta el selector obligatorio del formulario', async () => {
    const { fixture, el } = await setup();
    const c = comp(fixture);

    c.onNuevo();
    fixture.detectChanges();

    const combo = el.querySelector('erp-modal erp-combo-search[formControlName="categoriaid"]');
    expect(combo).not.toBeNull();
    expect(c.categorias().length).toBe(2);
  });

  it('`?categoriaid=` de la URL preselecciona el filtro y ya sale en la PRIMERA consulta', async () => {
    // Es el enlace padre→hijo: `SubCategoria.php?categoriaid=<id>` en el legacy. Se lee del
    // snapshot para que no haya una primera petición sin filtro.
    const { fixture, api } = await setup(new SubcategoriaApiMock(), '2');
    const c = comp(fixture);

    expect(c.filters.getRawValue().categoriaid).toBe('2');
    expect(api.consultas.length).toBe(1);
    expect(api.consultas[0].categoriaid).toBe(2);
    expect(c.rows().map((row) => row.subcategoriaid)).toEqual([2]);
  });

  it('un `?categoriaid=` inservible se ignora en vez de acotar a nada', async () => {
    // El legacy manda `-1` para «todas»; y la URL la escribe cualquiera.
    const { fixture, api } = await setup(new SubcategoriaApiMock(), '-1');
    const c = comp(fixture);

    expect(c.filters.getRawValue().categoriaid).toBe('');
    expect(api.consultas[0].categoriaid).toBeUndefined();
    expect(c.rows().length).toBe(2);
  });

  it('la grilla no ofrece arrastre ni columnas de orden o estado', async () => {
    // La tabla no tiene columnas `estado` ni `orden`: el `change_status` del legacy llama a
    // una función que no existe en la base.
    const { fixture, el } = await setup();
    const c = comp(fixture);

    expect(c.columns.map((col) => col.key)).toEqual([
      'nombre',
      'abreviatura',
      'categoria_nombre',
      'count_productos',
    ]);
    expect(el.querySelector('.col-reorder')).toBeNull();
    expect(el.querySelector('.badge--on, .badge--off')).toBeNull();
    expect(el.querySelector('select[formControlName="estado"]')).toBeNull();
  });

  it('el alta manda `categoriaid` en el cuerpo', async () => {
    // Es obligatorio: la columna es NOT NULL con clave foránea.
    const { fixture, api, notify } = await setup();
    const c = comp(fixture);

    c.onNuevo();
    c.form.patchValue({ categoriaid: 2, nombre: 'QUESOS', abreviatura: 'QUE' });
    c.onGuardar();
    await asentar(fixture);

    expect(api.creados).toEqual([{ categoriaid: 2, nombre: 'QUESOS', abreviatura: 'QUE' }]);
    expect(c.modalAbierto()).toBe(false);
    expect(notify.exitos.length).toBe(1);
  });

  it('no envía nada si no se eligió categoría', async () => {
    // `required` deja pasar el 0 —que es la categoría centinela «NO DEFINIDO»—, así que quien
    // lo corta es el `min(1)`.
    const { fixture, api } = await setup();
    const c = comp(fixture);

    c.onNuevo();
    c.form.patchValue({ categoriaid: 0, nombre: 'QUESOS' });
    c.onGuardar();
    await asentar(fixture);

    expect(api.creados).toEqual([]);
    expect(c.modalAbierto()).toBe(true);
  });

  it('no envía nada si falta el nombre', async () => {
    const { fixture, api } = await setup();
    const c = comp(fixture);

    c.onNuevo();
    c.form.patchValue({ categoriaid: 1, nombre: '' });
    c.onGuardar();
    await asentar(fixture);

    expect(api.creados).toEqual([]);
    expect(c.modalAbierto()).toBe(true);
  });

  it('deja el modal abierto con lo escrito si el guardado falla', async () => {
    // 409 por nombre duplicado —que aquí puede venir de OTRA categoría, porque la unicidad es
    // global— o por categoría inexistente: hay que poder corregirlo sin volver a teclearlo.
    const api = new SubcategoriaApiMock();
    api.fallar = true;
    const { fixture } = await setup(api);
    const c = comp(fixture);

    c.onNuevo();
    c.form.patchValue({ categoriaid: 1, nombre: 'LACTEOS' });
    c.onGuardar();
    await asentar(fixture);

    expect(c.modalAbierto()).toBe(true);
    expect(c.form.getRawValue()).toEqual({ categoriaid: 1, nombre: 'LACTEOS', abreviatura: '' });
  });

  it('editar precarga la categoría y la manda de vuelta en el PUT', async () => {
    // El stored procedure hace `set categoriaid = incategoriaid`: omitirla movería la
    // subcategoría a la categoría 0.
    const { fixture, api } = await setup();
    const c = comp(fixture);

    c.onEditar(api.rows[1] as never);
    expect(c.tituloModal()).toBe('Editar subcategoría');
    expect(c.form.getRawValue()).toEqual({
      categoriaid: 2,
      nombre: 'LACTEOS',
      abreviatura: 'LAC',
    });

    c.form.patchValue({ nombre: 'LACTEOS EDITADO' });
    c.onGuardar();
    await asentar(fixture);

    expect(api.actualizados.length).toBe(1);
    expect(api.actualizados[0].id).toBe(2);
    expect(api.actualizados[0].input.categoriaid).toBe(2);
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
    expect(c.rows().map((row) => row.subcategoriaid)).toEqual([2]);
  });

  it('la grilla ofrece checkbox de selección', async () => {
    const { el } = await setup();
    expect(el.querySelectorAll('tbody input[type="checkbox"]').length).toBe(2);
  });

  it('el borrado en lote va en UNA petición y quita las filas', async () => {
    const { fixture, api } = await setup();
    const c = comp(fixture);

    c.onSeleccion([{ subcategoriaid: 1 }, { subcategoriaid: 2 }] as never);
    c.onEliminarSeleccionadas();
    await asentar(fixture);

    expect(api.lotes).toEqual([[1, 2]]);
    expect(c.rows()).toEqual([]);
    expect(c.seleccionadas()).toEqual([]);
  });

  it('el lote es parcial: conserva las filas que fallaron', async () => {
    const api = new SubcategoriaApiMock();
    api.loteResultado = [
      { subcategoriaid: 1, ok: true },
      { subcategoriaid: 2, ok: false, mensaje: 'Tiene productos registrados.' },
    ];
    const { fixture, notify } = await setup(api);
    const c = comp(fixture);

    c.onSeleccion([{ subcategoriaid: 1 }, { subcategoriaid: 2 }] as never);
    c.onEliminarSeleccionadas();
    await asentar(fixture);

    expect(c.rows().map((row) => row.subcategoriaid)).toEqual([2]);
    expect(notify.errores.length).toBe(1);
  });

  it('pinta el nombre de la categoría padre, que viene derivado en la fila', async () => {
    // ⚠ La cabecera dice «Categoría»: el legacy la rotula «SUBCATEGORIA» pintando debajo el
    // nombre de la categoría padre, y ese error no se hereda.
    const { fixture, el } = await setup();
    const c = comp(fixture);

    expect(celdas(el, 2)).toEqual(['ABARROTES', 'REFRIGERADOS']);
    expect(c.columns[2]).toMatchObject({ key: 'categoria_nombre', header: 'Categoría' });
  });

  it('la celda de productos tiene tres formas: guion, texto y badge', async () => {
    const api = new SubcategoriaApiMock();
    api.rows = [
      fila({ subcategoriaid: 1, count_productos: 0 }),
      fila({ subcategoriaid: 2, count_productos: 1 }),
      fila({ subcategoriaid: 3, count_productos: 7 }),
    ];
    const { el } = await setup(api);

    expect(celdas(el, 3)).toEqual(['—', 'Solo un producto', '7']);
    expect(el.querySelectorAll('tbody .badge').length).toBe(1);
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
    const anchor = vi.spyOn(HTMLAnchorElement.prototype, 'click');
    const { fixture } = await setup();
    const c = comp(fixture);

    c.filters.patchValue({ categoriaid: '2' });
    c.onApply();
    await asentar(fixture);
    c.onExportar({ formato: 'csv', detalle: false });

    expect(anchor).toHaveBeenCalled();
    expect(c.rows().length).toBe(1);
  });

  it('sin historia previa, cerrar vuelve a /inicio', async () => {
    // NO al índice de tablas básicas: esta pantalla no cuelga de ese hub, es una opción de
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

  it('pagina en CLIENTE: el endpoint devuelve el catálogo entero, sin meta', async () => {
    const api = new SubcategoriaApiMock();
    api.rows = Array.from({ length: 30 }, (_, i) =>
      fila({ subcategoriaid: i + 1, nombre: `FILA ${i + 1}` }),
    );
    const { fixture, el } = await setup(api);
    const c = comp(fixture);

    expect(c.meta()).toMatchObject({ total: 30, pageSize: 25, totalPages: 2 });
    expect(el.querySelectorAll('tbody tr').length).toBe(25);

    c.onPage(2);
    fixture.detectChanges();
    expect(el.querySelectorAll('tbody tr').length).toBe(5);
    // Paginar NO vuelve a pedir nada: solo la carga inicial.
    expect(api.consultas.length).toBe(1);
  });

  it('el total del pie refleja lo que devolvió el filtro', async () => {
    const { fixture } = await setup();
    const c = comp(fixture);

    c.filters.patchValue({ categoriaid: '2' });
    c.onApply();
    await asentar(fixture);

    expect(c.meta()).toMatchObject({ total: 1, page: 1 });
  });
});
