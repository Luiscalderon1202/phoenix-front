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
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MarcaApi } from '@phoenix/catalogo/data-access';
import type { PageMeta } from '@phoenix/shared/api';
import {
  MARCA_MAX_ABREVIATURA,
  MARCA_MAX_NOMBRE,
  type Marca,
  type MarcaInput,
  type MarcaListQuery,
} from '@phoenix/catalogo/domain';
import {
  CellTemplate,
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
 * Mantenimiento de Marcas (`catalogo.marca`, menuweb 73, proceso `CAT-MARCA`).
 *
 * CRUD completo en un modal contra `POST`/`PUT`: el stored procedure del legacy resuelve el
 * alta y la edición enteras en una llamada.
 *
 * ⚠ Es la ÚNICA de las cinco pantallas del módulo que PAGINA y FILTRA EN SERVIDOR. `page`,
 * `page_size` y `q` entran en la query del `resource`, así que cambiar cualquiera de los tres
 * re-dispara la petición; la grilla recibe `rows()` a pelo, sin trocear, porque la respuesta
 * ya viene troceada. El `total` del pie sale de `meta`, no de contar filas en memoria.
 *
 * ⚠⚠ EN PRODUCCIÓN, BUSCAR MARCAS POR NOMBRE NO HACE NADA. `ajMarca.php:17` llama
 * `$oM->Leer($vNombre)` contra una firma `Leer($vInicio=0, $vFin=0, $vNombre='')`: el texto
 * cae en `$vInicio`, `intval()` lo vuelve 0 y la llamada real es SIEMPRE
 * `pamarca_leer(0, 0, '')`. La función SQL sí sabe paginar y filtrar —tiene su
 * `pamarca_count` y todo, sin un solo llamador en el repo—, simplemente nadie la llamaba
 * bien. Esta pantalla la usa como fue diseñada: es una CORRECCIÓN DELIBERADA del legacy, no
 * una divergencia accidental. Si alguien compara ambas pantallas y ve que aquí el filtro sí
 * responde, la que está mal es la vieja.
 *
 * Sin columna `#`, sin columna de estado y sin arrastre: `catalogo.marca` tiene tres columnas
 * —`marcaid`, `nombre`, `abreviatura`— y no existe ni `estado` ni `orden`. El legacy aparenta
 * lo contrario con código muerto en sus tres capas (un `change_status` que invoca una función
 * SQL inexistente, un `change_order` que llama a un método que no existe, y un
 * `head_order_table.php` de 0 bytes), enganchado además a `td:nth-child(6) img`, una celda
 * que nunca fue una imagen. No se migra nada de eso.
 *
 * Sin reporte PDF ni menú Imprimir: el PDF no es estándar en una pantalla de mantenimiento
 * —cuesta un endpoint y una definición de columnas en el backend— y este recurso no lo tiene.
 */
@Component({
  selector: 'erp-marca-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    PageHeader,
    FilterPanel,
    DataGrid,
    CellTemplate,
    Icon,
    Modal,
    ExportMenu,
    GridFooter,
  ],
  templateUrl: './marca-list-page.html',
  styleUrl: './marca-list-page.scss',
})
export class MarcaListPage {
  private readonly api = inject(MarcaApi);
  private readonly fb = inject(FormBuilder);
  private readonly notify = inject(NotificationService);
  private readonly confirm = inject(ConfirmService);
  private readonly location = inject(Location);
  private readonly router = inject(Router);

  /**
   * Si esta pantalla se abrió desde otra de la app hay historia a la que volver; si se llegó
   * pegando la URL en la barra, no. Se resuelve al construir, que es cuando la navegación que
   * montó el componente todavía sabe de dónde venía.
   */
  private readonly hayHistoria = !!this.router.lastSuccessfulNavigation()?.previousNavigation;

  /**
   * Cierra la pantalla y vuelve por donde se vino. Sin historia previa, `location.back()`
   * sacaría al usuario FUERA del ERP, así que en ese caso se sube a `/inicio`.
   *
   * ⚠ NO se vuelve a `/mantenimiento/tablas-basicas`: Marcas no cuelga de ese hub, es una
   * opción de menú propia con su propio permiso. Mandar ahí al usuario lo dejaría en una
   * pantalla que puede no tener concedida.
   */
  protected onCerrar(): void {
    if (this.hayHistoria) {
      this.location.back();
      return;
    }
    void this.router.navigate(['/inicio']);
  }

  protected readonly maxAbreviatura = MARCA_MAX_ABREVIATURA;
  protected readonly maxNombre = MARCA_MAX_NOMBRE;

  // ── Filtros (en SERVIDOR) ───────────────────────────────────────────
  protected readonly filters = this.fb.nonNullable.group({
    q: '',
  });

  /**
   * Filtros ya confirmados. Solo cambia al pulsar "Buscar": si el `resource` leyera el
   * formulario directamente, cada tecleo en la caja de búsqueda dispararía una consulta.
   */
  private readonly applied = signal(this.filters.getRawValue());

  // ── Paginación (en SERVIDOR) ────────────────────────────────────────
  protected readonly pageSizes = PAGE_SIZES;
  protected readonly page = signal(1);
  protected readonly pageSize = signal(25);

  /**
   * Parámetros que se mandan al endpoint. `page` y `pageSize` entran AQUÍ, no en un troceado
   * de cliente: cambiar cualquiera re-dispara el `resource` y el backend devuelve otra página.
   */
  private readonly query = computed<MarcaListQuery>(() => ({
    page: this.page(),
    page_size: this.pageSize(),
    q: this.applied().q.trim(),
  }));

  private readonly marcas = resource({
    params: () => this.query(),
    loader: ({ params }) => firstValueFrom(this.api.list(params)),
  });

  /**
   * Lista de trabajo: copia editable de la página en curso. Existe para poder reflejar una
   * edición sin recargar (ver `patchRow`).
   *
   * `rows` es la página TAL CUAL la manda el backend: no hay `rowsPagina` que la vuelva a
   * trocear, porque ya viene troceada.
   */
  private readonly items = linkedSignal<Marca[]>(() => this.marcas.value()?.data ?? []);
  protected readonly rows = this.items;

  protected readonly loading = this.marcas.isLoading;
  protected readonly error = computed(() => {
    const e = this.marcas.error();
    return e instanceof Error ? e.message : e ? 'No se pudo cargar el catálogo de marcas.' : null;
  });

  /**
   * Meta del pie de grilla. `page`/`pageSize` salen de NUESTRAS señales (es lo que acabamos
   * de pedir: evita el parpadeo mientras llega la respuesta); solo `total` viene del backend,
   * de `pamarca_count(q)`, y de ahí se deriva el número de páginas.
   */
  protected readonly meta = computed<PageMeta>(() => {
    const page = this.page();
    const pageSize = this.pageSize();
    const total = this.marcas.value()?.meta.total ?? 0;
    const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1;
    return { page, pageSize, total, totalPages };
  });

  /**
   * Aplica los filtros. El `reload()` es explícito y NECESARIO: si el usuario vuelve a pulsar
   * "Buscar" sin haber cambiado nada, la query es idéntica y el `resource` no se re-dispara
   * solo. Con paginación de servidor eso dejaría el botón muerto.
   */
  protected onApply(): void {
    this.applied.set(this.filters.getRawValue());
    this.page.set(1); // el filtro cambia el universo: la página 3 anterior ya no significa nada
    this.seleccionadas.set([]);
    this.marcas.reload();
  }

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
  // NINGUNA lleva `sortable`: el ordenamiento del `erp-data-grid` es de CLIENTE y con
  // paginación de servidor solo ordenaría la página en curso, lo que engaña —parece que
  // ordena las 400 filas y ordena 25—. El orden lo decide el backend.
  //
  // Sin columna `#` (no hay `orden`) ni columna Estado (no hay `estado`).
  protected readonly columns: GridColumn<Marca>[] = [
    { key: 'nombre', header: 'Nombre' },
    { key: 'abreviatura', header: 'Abreviatura', width: '150px' },
    { key: 'count_productos', header: 'Productos', width: '180px' },
  ];

  /**
   * Aplica una edición sobre la fila que ya está en pantalla. Sirve para el `PUT`, que no
   * cambia ni el total ni la página: la fila sigue donde estaba y solo cambia su texto.
   *
   * El alta y el borrado NO usan esto: ver `onGuardar` y `onEliminar`.
   */
  private patchRow(marcaid: number, patch: Partial<Marca>): void {
    this.items.update((list) => list.map((it) => (it.marcaid === marcaid ? { ...it, ...patch } : it)));
  }

  // ── Selección de filas (borrado en lote) ────────────────────────────
  protected readonly seleccionadas = signal<Marca[]>([]);

  protected onSeleccion(filas: Marca[]): void {
    this.seleccionadas.set(filas);
  }

  /**
   * Borrado en lote: UNA petición, no N. El endpoint responde 200 con el resultado por id
   * porque el lote es parcial por diseño —una marca puede fallar por tener masters mientras
   * el resto sí se borra—, así que el saldo se lee de las filas y no del código HTTP.
   *
   * Al terminar se RECARGA del servidor en vez de quitar las filas en local: con paginación
   * de servidor, borrar 3 de 25 dejaría una página de 22 con un `total` del pie que ya no es
   * cierto, y las filas que ascienden desde la página siguiente no aparecerían.
   */
  protected async onEliminarSeleccionadas(): Promise<void> {
    const filas = this.seleccionadas();
    if (filas.length === 0) return;

    const ok = await this.confirm.ask({
      title: 'Eliminar marcas',
      message: `¿Eliminar ${filas.length} registro(s) seleccionado(s)? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      tone: 'danger',
    });
    if (!ok) return;

    try {
      const resultados = await firstValueFrom(this.api.removeLote(filas.map((f) => f.marcaid)));
      const fallos = resultados.filter((res) => !res.ok);
      const eliminadas = resultados.length - fallos.length;

      if (eliminadas > 0) this.notify.success(`Se eliminaron ${eliminadas} registro(s).`);
      if (fallos.length > 0) {
        // Los motivos se repiten ("tiene productos registrados"), así que se deduplican en
        // vez de sacar un toast por fila.
        const motivos = [...new Set(fallos.map((f) => f.mensaje).filter(Boolean))];
        this.notify.error(
          `${fallos.length} de ${resultados.length} no se pudieron eliminar. ${motivos.join(' ')}`.trim(),
        );
      }
    } catch {
      // Fallo de la petición entera (no del lote): el `error-interceptor` ya lo notificó.
    }
    this.seleccionadas.set([]);
    this.marcas.reload();
  }

  // ── Alta y edición ──────────────────────────────────────────────────
  protected readonly modalAbierto = signal(false);
  /** `null` = alta; con valor = edición de ese registro. */
  protected readonly editando = signal<Marca | null>(null);
  protected readonly guardando = signal(false);

  /**
   * Los dos únicos campos que acepta el backend. `count_productos` no está: es derivado y de
   * solo lectura, lo calcula la base contando productos.
   */
  protected readonly form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(MARCA_MAX_NOMBRE)]],
    abreviatura: ['', [Validators.maxLength(MARCA_MAX_ABREVIATURA)]],
  });

  protected readonly tituloModal = computed(() => (this.editando() ? 'Editar marca' : 'Nueva marca'));

  protected onNuevo(): void {
    this.editando.set(null);
    this.form.reset({ nombre: '', abreviatura: '' });
    this.modalAbierto.set(true);
  }

  protected onEditar(row: Marca): void {
    this.editando.set(row);
    this.form.reset({ nombre: row.nombre, abreviatura: row.abreviatura });
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

    const input: MarcaInput = this.form.getRawValue();
    const enEdicion = this.editando();
    this.guardando.set(true);

    try {
      if (enEdicion) {
        // La edición no cambia ni el total ni el sitio de la fila: se parchea en local.
        const actualizada = await firstValueFrom(this.api.update(enEdicion.marcaid, input));
        this.patchRow(enEdicion.marcaid, actualizada);
        this.notify.success(`Se actualizó "${actualizada.nombre}".`);
      } else {
        const creada = await firstValueFrom(this.api.create(input));
        this.notify.success(`Se creó "${creada.nombre}".`);
        // ⚠ Aquí NO se hace `items.update([...list, creada])` como en las pantallas de
        // catálogo completo. Con paginación de servidor, añadir la fila en local descuadra el
        // `total` del pie —que viene de `pamarca_count`, no de contar filas— y deja la página
        // en curso con 26 registros de 25. Además la marca nueva puede pertenecer a otra
        // página según el orden del backend. Se recarga y punto.
        this.marcas.reload();
      }
      this.modalAbierto.set(false);
    } catch {
      // 409 (nombre duplicado) y 422 (validación): el `error-interceptor` ya mostró el
      // `message` del backend, que en 4xx es seguro. El modal se queda abierto con lo
      // escrito para poder corregirlo.
    } finally {
      this.guardando.set(false);
    }
  }

  // ── Eliminación ─────────────────────────────────────────────────────
  /**
   * Borra una fila y RECARGA, en vez de quitarla de `items`: mismo motivo que el lote — el
   * `total` del pie lo cuenta el backend y la fila que asciende desde la página siguiente
   * tiene que aparecer.
   */
  protected async onEliminar(row: Marca): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Eliminar marca',
      message: `¿Eliminar "${row.nombre}"? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      tone: 'danger',
    });
    if (!ok) return;

    try {
      await firstValueFrom(this.api.remove(row.marcaid));
      this.seleccionadas.update((sel) => sel.filter((s) => s.marcaid !== row.marcaid));
      this.notify.success(`Se eliminó "${row.nombre}".`);
    } catch {
      // 409 si algún master la usa: ya lo notificó el interceptor. Se recarga igual, por si
      // el catálogo cambió por otro lado.
    }
    this.marcas.reload();
  }

  // ── Exportación ─────────────────────────────────────────────────────
  /**
   * Exporta a Excel o CSV **la página que se está viendo**.
   *
   * ⚠ Ojo con la diferencia respecto a las pantallas de catálogo completo: allí se exporta
   * todo lo filtrado porque todo está en memoria. Aquí solo hay una página cargada, y pedir
   * el resto significaría N peticiones al backend. Se exporta lo que se ve, que es lo honesto.
   */
  protected onExportar(e: ExportChoice): void {
    const cabeceras = ['ID', 'Nombre', 'Abreviatura', 'Productos'];
    const matriz = [
      cabeceras,
      ...this.rows().map((m) => [m.marcaid, m.nombre, m.abreviatura, m.count_productos]),
    ];

    if (e.formato === 'csv') {
      exportCsv('marcas.csv', matriz);
    } else {
      exportXls('marcas.xls', matriz);
    }
  }
}
