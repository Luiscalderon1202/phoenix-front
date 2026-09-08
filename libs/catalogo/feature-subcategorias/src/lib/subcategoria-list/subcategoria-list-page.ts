import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  resource,
  signal,
} from '@angular/core';
import { Location } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CategoriaApi, SubcategoriaApi } from '@phoenix/catalogo/data-access';
import type { PageMeta } from '@phoenix/shared/api';
import {
  SUBCATEGORIA_MAX_ABREVIATURA,
  SUBCATEGORIA_MAX_NOMBRE,
  type Subcategoria,
  type SubcategoriaFiltros,
  type SubcategoriaInput,
} from '@phoenix/catalogo/domain';
import {
  CellTemplate,
  ComboSearch,
  ConfirmService,
  DataGrid,
  type ExportChoice,
  ExportMenu,
  FilterPanel,
  type GridColumn,
  GridFooter,
  Icon,
  Modal,
  NotificationService,
  PageHeader,
} from '@phoenix/shared/ui';
import { exportCsv, exportXls } from '@phoenix/shared/util';

/** Tamaños de página del pie de grilla. */
const PAGE_SIZES = [10, 25, 50, 100];

/**
 * Mantenimiento de Subcategorías (`catalogo.subcategoria`).
 *
 * Es la única de las cinco pantallas del módulo que CUELGA DE OTRA: toda subcategoría
 * pertenece a una categoría, la relación es obligatoria y tiene clave foránea de verdad. De ahí
 * salen sus tres diferencias con el molde:
 *
 * - **Dos filtros y los dos al SERVIDOR** (texto y categoría). No es capricho: el stored
 *   procedure `pasubcategoria_leer(vnombre, vcategoriaid)` los aplica bien los dos, y el de
 *   categoría es el que usa el enlace padre→hijo. La PAGINACIÓN, en cambio, sigue en cliente:
 *   el endpoint devuelve el catálogo entero, sin `meta`.
 * - **Un segundo `resource` trae el catálogo de categorías** (`GET /categorias`), que alimenta
 *   a la vez el desplegable del filtro y el selector obligatorio del formulario. No hace falta
 *   un endpoint `/catalogos/...` nuevo: se reusa el de la pantalla hermana.
 * - **Al entrar se lee `?categoriaid=` de la URL** y se preselecciona ese filtro, porque desde
 *   Categorías se llega aquí ya acotado (lo que el legacy hace con
 *   `SubCategoria.php?categoriaid=<id>`).
 *
 * ⚠⚠ **LA UNICIDAD DEL NOMBRE ES GLOBAL, NO POR CATEGORÍA.**
 * `pasubcategoria_actualizar` compara el nombre contra TODA la tabla, sin acotar por
 * `categoriaid`. Dos categorías **no** pueden tener subcategorías homónimas: no puede haber un
 * «GENÉRICOS» en ABARROTES y otro en LIMPIEZA. Si un usuario se extraña de un 409 «ya existe»
 * señalando una subcategoría de otra categoría, NO es un fallo: es el stored procedure del
 * legacy, y se hereda tal cual. Es lo contrario de Motivos de notas, donde la columna `tipo` sí
 * parte el catálogo y también la unicidad; quien venga de aquella pantalla da por hecha una
 * simetría que aquí no existe. Ni el mensaje del backend ni ningún texto de esta pantalla deben
 * sugerir que la restricción es «dentro de la categoría».
 *
 * ⚠ **Esta pantalla NO cuelga del hub de Tablas Básicas.** No aparece en `TablasBasicas.php` ni
 * en `tablas.ts`: es una opción de menú propia (`basic.menuweb` 75, «SubCategorias», bajo el
 * padre 70 «Catalogo») con su PROPIO proceso de permiso. Por eso `onCerrar()` vuelve a
 * `/inicio` y no al índice de tablas básicas como hace el molde.
 *
 * ⚠ **El legacy declara DOS procesos y aquí se exige UNO.** `SubCategoria.php:8` pone
 * `array("CAT-CATEGORIA","CAT-SUBCATEGORIA")` —la única pantalla del módulo con un array— y
 * allí se evaluaba como un OR: bastaba tener concedido cualquiera de los dos. La ruta de esta
 * pantalla exige SOLO `CAT-SUBCATEGORIA`; tener el mantenimiento de categorías no da derecho a
 * tocar el de subcategorías. Es una decisión tomada, no un descuido. (En el legacy la
 * diferencia era teórica: `TienePermisoMenu()` hace `return true` con el cuerpo comentado.)
 *
 * Sin interruptor de estado y sin reordenar: la tabla no tiene columnas `estado` ni `orden` —el
 * `case "change_status"` de `ajSubCategoria.php` llama a una función que no existe en la base—,
 * así que el recurso se queda en seis endpoints. Sin reporte PDF: el legacy no imprime este
 * catálogo.
 */
@Component({
  selector: 'erp-subcategoria-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    PageHeader,
    FilterPanel,
    DataGrid,
    CellTemplate,
    ComboSearch,
    Icon,
    Modal,
    ExportMenu,
    GridFooter,
  ],
  templateUrl: './subcategoria-list-page.html',
  styleUrl: './subcategoria-list-page.scss',
})
export class SubcategoriaListPage {
  private readonly api = inject(SubcategoriaApi);
  private readonly categoriaApi = inject(CategoriaApi);
  private readonly fb = inject(FormBuilder);
  private readonly notify = inject(NotificationService);
  private readonly confirm = inject(ConfirmService);
  private readonly location = inject(Location);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /**
   * Si esta pantalla se abrió desde otra de la app hay historia a la que volver; si se llegó
   * pegando la URL en la barra, no. Se resuelve al construir, que es cuando la navegación que
   * montó el componente todavía sabe de dónde venía.
   */
  private readonly hayHistoria = !!this.router.lastSuccessfulNavigation()?.previousNavigation;

  /**
   * Cierra la pantalla y vuelve por donde se vino. Sin historia previa, `location.back()`
   * sacaría al usuario FUERA del ERP, así que se sube a `/inicio`.
   *
   * ⚠ NO al índice de tablas básicas, que es lo que hace el molde: esta pantalla no cuelga de
   * ese hub —es una opción de menú propia—, así que mandar allí al usuario lo dejaría en un
   * listado donde las subcategorías no aparecen.
   */
  protected onCerrar(): void {
    if (this.hayHistoria) {
      this.location.back();
      return;
    }
    void this.router.navigate(['/inicio']);
  }

  protected readonly maxNombre = SUBCATEGORIA_MAX_NOMBRE;
  protected readonly maxAbreviatura = SUBCATEGORIA_MAX_ABREVIATURA;

  // ── Catálogo de categorías (el padre) ───────────────────────────────
  /**
   * Segundo `resource`: alimenta el desplegable del filtro Y el selector obligatorio del
   * formulario. Se reusa `GET /categorias`, la pantalla hermana; no hay endpoint de catálogo
   * aparte ni hace falta.
   */
  private readonly catalogoCategorias = resource({
    loader: () => firstValueFrom(this.categoriaApi.list()),
  });
  protected readonly categorias = computed(() => this.catalogoCategorias.value() ?? []);

  // ── Filtros (los dos al SERVIDOR) ───────────────────────────────────
  /**
   * Categoría con la que se entra, leída de `?categoriaid=` de la URL.
   *
   * Se lee del `snapshot` de `ActivatedRoute` y NO del binding de entradas del router
   * (`withComponentInputBinding`, que sí está activado) por dos motivos:
   *
   * 1. El snapshot está disponible en el inicializador del campo, así que el formulario y la
   *    señal `applied` nacen ya con el filtro puesto y la PRIMERA petición al servidor sale ya
   *    acotada. Una `input()` se rellena después de construir, de modo que el `resource` se
   *    dispararía una vez sin filtro y otra con él: dos peticiones para una pantalla.
   * 2. Una `input()` seguiría vivo y volvería a escribir el filtro cada vez que la URL cambie.
   *    Aquí el query param es un valor de ARRANQUE, no una fuente de verdad continua: en cuanto
   *    el usuario toca el desplegable, manda el formulario.
   *
   * Cualquier valor no numérico o <= 0 se ignora (el legacy manda `-1` para «todas»).
   */
  private readonly categoriaDeLaUrl = (() => {
    const crudo = Number(this.route.snapshot.queryParamMap.get('categoriaid'));
    return Number.isFinite(crudo) && crudo > 0 ? String(crudo) : '';
  })();

  /** Cadena vacía = «sin filtro»; el data-access la omite de la query. */
  protected readonly filters = this.fb.nonNullable.group({
    q: '',
    categoriaid: this.categoriaDeLaUrl, // '' | id como texto (lo que devuelve el <select>)
  });

  /**
   * Filtros ya confirmados. Solo cambia al pulsar «Buscar»: si el `resource` leyera el
   * formulario directamente, cada tecleo en la caja de búsqueda dispararía una consulta.
   */
  private readonly applied = signal(this.filters.getRawValue());

  /** Parámetros que se mandan al endpoint. Cambiar cualquiera re-dispara el `resource`. */
  private readonly query = computed<SubcategoriaFiltros>(() => {
    const f = this.applied();
    // El `<select>` devuelve texto; el contrato pide un entero. `''` → `undefined` (sin
    // filtro): ni `0` ni `''`, que el backend tendría que normalizar y que ensuciarían la URL.
    const categoriaid = Number(f.categoriaid);
    return {
      q: f.q.trim(),
      categoriaid: Number.isFinite(categoriaid) && categoriaid > 0 ? categoriaid : undefined,
    };
  });

  // ── Datos ───────────────────────────────────────────────────────────
  private readonly catalogo = resource({
    params: () => this.query(),
    loader: ({ params }) => firstValueFrom(this.api.list(params)),
  });

  /**
   * Lista de trabajo: copia editable del resultado. Permite reflejar altas, ediciones y
   * borrados sin recargar el catálogo entero.
   */
  private readonly items = linkedSignal<Subcategoria[]>(() => this.catalogo.value() ?? []);
  protected readonly rows = this.items;

  protected readonly loading = this.catalogo.isLoading;
  protected readonly error = computed(() => {
    const e = this.catalogo.error();
    return e instanceof Error
      ? e.message
      : e
        ? 'No se pudo cargar el catálogo de subcategorías.'
        : null;
  });

  protected onApply(): void {
    this.applied.set(this.filters.getRawValue());
    this.page.set(1); // el filtro cambia el universo: la página 3 anterior ya no significa nada
    this.seleccionadas.set([]);
  }

  // ── Paginación (en cliente) ─────────────────────────────────────────
  // El endpoint devuelve el catálogo entero ya filtrado, sin `meta`: el troceado se hace aquí.
  protected readonly pageSizes = PAGE_SIZES;
  protected readonly page = signal(1);
  protected readonly pageSize = signal(25);

  /** Filas de la página en curso: es lo que se pinta. */
  protected readonly rowsPagina = computed<Subcategoria[]>(() => {
    const filas = this.rows();
    const size = this.pageSize();
    if (size <= 0) return filas; // "Todos"
    const inicio = (this.page() - 1) * size;
    return filas.slice(inicio, inicio + size);
  });

  protected readonly meta = computed<PageMeta>(() => {
    const total = this.rows().length;
    const pageSize = this.pageSize();
    const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1;
    return { page: this.page(), pageSize, total, totalPages };
  });

  protected onPage(p: number): void {
    this.page.set(p);
    this.seleccionadas.set([]); // otras filas: la selección previa ya no significa nada
  }

  protected onPageSize(ps: number): void {
    this.pageSize.set(ps);
    this.page.set(1);
    this.seleccionadas.set([]);
  }

  // ── Columnas ────────────────────────────────────────────────────────
  // Sin columna `#` y sin columna Estado: esta tabla no tiene `orden` ni `estado`.
  //
  // ⚠ La cabecera de la tercera columna dice «Categoría», no «Subcategoría». El listado del
  // legacy la rotula «SUBCATEGORIA» pintando debajo el nombre de la categoría PADRE: es un
  // error suyo y no se hereda.
  protected readonly columns: GridColumn<Subcategoria>[] = [
    { key: 'nombre', header: 'Nombre' },
    { key: 'abreviatura', header: 'Abreviatura', width: '150px' },
    { key: 'categoria_nombre', header: 'Categoría', width: '220px' },
    { key: 'count_productos', header: 'Productos', width: '160px' },
  ];

  /** Aplica un cambio puntual sobre una fila de la lista de trabajo. Lo usa `onGuardar()`. */
  private patchRow(id: number, patch: Partial<Subcategoria>): void {
    this.items.update((list) =>
      list.map((it) => (it.subcategoriaid === id ? { ...it, ...patch } : it)),
    );
  }

  // ── Selección de filas (borrado en lote) ────────────────────────────
  protected readonly seleccionadas = signal<Subcategoria[]>([]);

  protected onSeleccion(filas: Subcategoria[]): void {
    this.seleccionadas.set(filas);
  }

  /**
   * Borrado en lote: UNA petición, no N. El endpoint responde 200 con el resultado por id
   * porque el lote es parcial por diseño —una subcategoría con productos falla mientras el
   * resto sí se borra—, así que el saldo se lee de las filas.
   */
  protected async onEliminarSeleccionadas(): Promise<void> {
    const filas = this.seleccionadas();
    if (filas.length === 0) return;

    const ok = await this.confirm.ask({
      title: 'Eliminar subcategorías',
      message: `¿Eliminar ${filas.length} registro(s) seleccionado(s)? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      tone: 'danger',
    });
    if (!ok) return;

    try {
      const resultados = await firstValueFrom(
        this.api.removeLote(filas.map((f) => f.subcategoriaid)),
      );
      const fallos = resultados.filter((res) => !res.ok);
      const eliminados = resultados.length - fallos.length;

      if (eliminados > 0) {
        const borrados = new Set(resultados.filter((res) => res.ok).map((res) => res.subcategoriaid));
        this.items.update((list) => list.filter((it) => !borrados.has(it.subcategoriaid)));
        this.notify.success(`Se eliminaron ${eliminados} registro(s).`);
      }
      if (fallos.length > 0) {
        // Los motivos se repiten ("tiene productos registrados"), así que se deduplican en vez
        // de sacar un toast por fila.
        const motivos = [...new Set(fallos.map((f) => f.mensaje).filter(Boolean))];
        this.notify.error(
          `${fallos.length} de ${resultados.length} no se pudieron eliminar. ${motivos.join(' ')}`.trim(),
        );
      }
    } catch {
      // Fallo de la petición entera (no del lote): el `error-interceptor` ya lo notificó.
    }
    this.seleccionadas.set([]);
  }

  // ── Alta y edición ──────────────────────────────────────────────────
  protected readonly modalAbierto = signal(false);
  /** `null` = alta; con valor = edición de ese registro. */
  protected readonly editando = signal<Subcategoria | null>(null);
  protected readonly guardando = signal(false);

  /**
   * Los campos que acepta el backend. Ni `estado` ni `orden`: no existen en la tabla.
   *
   * `categoriaid` es OBLIGATORIO también al editar —el stored procedure lo reescribe siempre—,
   * y por eso lleva DOS validadores: `required` rechaza el vacío, pero deja pasar el `0`, que es
   * justamente la categoría centinela «NO DEFINIDO»; `min(1)` es quien lo corta. El backend
   * hace la misma comprobación (`Categoriaid <= 0` → `categoriaid_required`).
   */
  protected readonly form = this.fb.nonNullable.group({
    categoriaid: [0, [Validators.required, Validators.min(1)]],
    nombre: ['', [Validators.required, Validators.maxLength(SUBCATEGORIA_MAX_NOMBRE)]],
    abreviatura: ['', [Validators.maxLength(SUBCATEGORIA_MAX_ABREVIATURA)]],
  });

  protected readonly tituloModal = computed(() =>
    this.editando() ? 'Editar subcategoría' : 'Nueva subcategoría',
  );

  /**
   * Alta. Si hay un filtro de categoría puesto, esa categoría viene ya elegida: el usuario que
   * está viendo las subcategorías de ABARROTES casi siempre quiere crear otra de ABARROTES.
   */
  protected onNuevo(): void {
    this.editando.set(null);
    this.form.reset({
      categoriaid: this.query().categoriaid ?? 0,
      nombre: '',
      abreviatura: '',
    });
    this.modalAbierto.set(true);
  }

  protected onEditar(row: Subcategoria): void {
    this.editando.set(row);
    this.form.reset({
      categoriaid: row.categoriaid,
      nombre: row.nombre,
      abreviatura: row.abreviatura,
    });
    this.modalAbierto.set(true);
  }

  protected onCerrarModal(): void {
    this.modalAbierto.set(false);
  }

  protected async onGuardar(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.guardando()) return;

    const input: SubcategoriaInput = this.form.getRawValue();
    const enEdicion = this.editando();
    this.guardando.set(true);

    try {
      if (enEdicion) {
        const actualizado = await firstValueFrom(this.api.update(enEdicion.subcategoriaid, input));
        this.patchRow(enEdicion.subcategoriaid, actualizado);
        this.notify.success(`Se actualizó "${actualizado.nombre}".`);
      } else {
        const creado = await firstValueFrom(this.api.create(input));
        this.items.update((list) => [...list, creado]);
        this.notify.success(`Se creó "${creado.nombre}".`);
      }
      this.modalAbierto.set(false);
    } catch {
      // 409 (nombre duplicado —GLOBAL, no por categoría— o categoría inexistente) y 422
      // (validación): el `error-interceptor` ya mostró el `message` del backend, que en 4xx es
      // seguro. El modal se queda abierto con lo escrito para poder corregirlo.
    } finally {
      this.guardando.set(false);
    }
  }

  // ── Eliminación ─────────────────────────────────────────────────────
  protected async onEliminar(row: Subcategoria): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Eliminar subcategoría',
      message: `¿Eliminar "${row.nombre}"? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      tone: 'danger',
    });
    if (!ok) return;

    try {
      await firstValueFrom(this.api.remove(row.subcategoriaid));
      this.items.update((list) => list.filter((it) => it.subcategoriaid !== row.subcategoriaid));
      this.seleccionadas.update((sel) =>
        sel.filter((s) => s.subcategoriaid !== row.subcategoriaid),
      );
      this.notify.success(`Se eliminó "${row.nombre}".`);
    } catch {
      // 409 si algún master o el stock valorado la usan: ya lo notificó el interceptor. Se
      // recarga por si el catálogo cambió por otro lado.
      this.catalogo.reload();
    }
  }

  // ── Exportación ─────────────────────────────────────────────────────
  /**
   * Exporta a Excel o CSV **lo que se está viendo**, filtro incluido: se genera en el navegador
   * a partir de las filas ya cargadas, sin pedir nada al backend.
   *
   * Sin columna Estado: no existe en esta tabla.
   */
  protected onExportar(e: ExportChoice): void {
    const cabeceras = ['ID', 'Nombre', 'Abreviatura', 'Categoría', 'Productos'];
    const matriz = [
      cabeceras,
      ...this.rows().map((t) => [
        t.subcategoriaid,
        t.nombre,
        t.abreviatura,
        t.categoria_nombre,
        t.count_productos,
      ]),
    ];

    if (e.formato === 'csv') {
      exportCsv('subcategorias.csv', matriz);
    } else {
      exportXls('subcategorias.xls', matriz);
    }
  }
}
