import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  linkedSignal,
  resource,
  signal,
} from '@angular/core';
import { Location } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  CategoriaApi,
  LineaApi,
  MarcaApi,
  MasterApi,
  ProductoApi,
  SubcategoriaApi,
  UnidadMedidaApi,
} from '@phoenix/catalogo/data-access';
import type { PageMeta } from '@phoenix/shared/api';
import type {
  FiltroEstado,
  FiltroStock,
  FiltrosCatalogoProducto,
  Master,
  MasterListQuery,
  Producto,
  ProductoListQuery,
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
 * Tope al pedir un catálogo entero para poblar un desplegable.
 *
 * ⚠ Marcas y líneas PAGINAN en servidor, así que no hay un «traer todo»: se pide una página
 * grande. El backend acota `page_size` a 200, que es este número. Hoy hay 1 marca y 2 líneas en
 * producción, así que sobra de largo; si algún día pasan de 200, el desplegable se quedaría
 * corto y habría que cambiarlo por un buscador.
 */
const TOPE_CATALOGO = 200;

/** Las dos pestañas de la pantalla. */
type Pestana = 'productos' | 'masters';

/**
 * Pantalla de administración de Productos (`catalogo.producto` y `catalogo.master`, menuweb 76,
 * proceso `CAT-PRODUCTO`).
 *
 * ⚠ ES UNA PANTALLA CON DOS GRILLAS, no dos pantallas. `Producto.php` tiene dos pestañas
 * —«Productos Detallados» y «Productos Master»— que COMPARTEN los filtros y el permiso, y así se
 * migra: una sola ruta, un solo panel de filtros, dos listados.
 *
 * ⚠ ESTO ES LA ADMINISTRACIÓN, NO EL EDITOR. Se puede buscar, filtrar, activar, desactivar,
 * borrar y mover un producto de master. **No se puede crear ni editar**: eso vive en
 * `plantillas/ProductoMasterEdit.php`, contra un stored procedure de 64 argumentos que escribe
 * las 52 columnas del producto y las 17 del master a la vez, y es otro tramo. Por eso la grilla
 * no tiene botón «Nuevo» ni acción de editar.
 *
 * Reparto del trabajo, que aquí es todo de servidor:
 *
 * - **Los ocho filtros van al SERVIDOR**, incluido el de estado: al revés que en grupos, colores
 *   y tallas, los stored procedures de producto y master sí saben filtrar por estado.
 * - **Las dos grillas paginan en SERVIDOR** y cada una lleva SU página, como el legacy
 *   (`txtProPage` y `txtMasPage`): cambiar de pestaña no debe perder el sitio en la otra.
 * - Solo consulta la pestaña visible; la otra se queda quieta hasta que se la mira.
 *
 * ⚠ NO hay filtro por tipo de operación, aunque el legacy pinte ese desplegable:
 * `vtipooperacionid` es un parámetro muerto en los stored procedures y ese filtro nunca filtró
 * nada. El backend no lo expone y aquí no se inventa.
 *
 * ⚠ Los importes y el stock son CADENAS, no números: son `numeric` en la base y esto factura.
 * Se pintan tal cual y no se convierten.
 */
@Component({
  selector: 'erp-producto-list-page',
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
  templateUrl: './producto-list-page.html',
  styleUrl: './producto-list-page.scss',
})
export class ProductoListPage {
  private readonly productoApi = inject(ProductoApi);
  private readonly masterApi = inject(MasterApi);
  private readonly categoriaApi = inject(CategoriaApi);
  private readonly subcategoriaApi = inject(SubcategoriaApi);
  private readonly marcaApi = inject(MarcaApi);
  private readonly lineaApi = inject(LineaApi);
  private readonly unidadMedidaApi = inject(UnidadMedidaApi);

  private readonly fb = inject(FormBuilder);
  private readonly notify = inject(NotificationService);
  private readonly confirm = inject(ConfirmService);
  private readonly location = inject(Location);
  private readonly router = inject(Router);

  private readonly hayHistoria = !!this.router.lastSuccessfulNavigation()?.previousNavigation;

  /** Cierra y vuelve por donde se vino; sin historia, a `/inicio` y no a un hub. */
  protected onCerrar(): void {
    if (this.hayHistoria) {
      this.location.back();
      return;
    }
    void this.router.navigate(['/inicio']);
  }

  // ── Pestañas ────────────────────────────────────────────────────────
  protected readonly pestana = signal<Pestana>('productos');

  protected onPestana(p: Pestana): void {
    this.pestana.set(p);
    // La selección es de la grilla que se deja atrás: no significa nada en la otra.
    this.seleccionProductos.set([]);
    this.seleccionMasters.set([]);
  }

  // ── Filtros (todos al SERVIDOR) ─────────────────────────────────────
  protected readonly filters = this.fb.nonNullable.group({
    q: '',
    lineaid: 0,
    categoriaid: 0,
    subcategoriaid: 0,
    marcaid: 0,
    unidadmedidaid: 0,
    stock: '' as '' | FiltroStock,
    estado: '' as '' | FiltroEstado,
  });

  /**
   * Filtros ya confirmados. Solo cambian al pulsar «Buscar»: con paginación de servidor, leer el
   * formulario en vivo dispararía una consulta por tecla.
   */
  private readonly applied = signal(this.filters.getRawValue());

  /**
   * Los filtros comunes, en la forma que espera el cliente HTTP.
   *
   * El texto se recorta AQUÍ además de en el cliente HTTP —que también lo hace antes de armar
   * la URL—: así lo que guarda `applied` es lo que de verdad se está filtrando, y comparar dos
   * estados de filtro no depende de espacios sueltos.
   */
  private readonly filtrosComunes = computed<FiltrosCatalogoProducto>(() => {
    const a = this.applied();
    return {
      q: a.q.trim(),
      lineaid: a.lineaid,
      categoriaid: a.categoriaid,
      subcategoriaid: a.subcategoriaid,
      marcaid: a.marcaid,
      stock: a.stock || undefined,
      estado: a.estado || undefined,
    };
  });

  protected onApply(): void {
    this.applied.set(this.filters.getRawValue());
    // El filtro cambia el universo: las páginas anteriores ya no significan nada.
    this.pageProductos.set(1);
    this.pageMasters.set(1);
    this.seleccionProductos.set([]);
    this.seleccionMasters.set([]);
    this.productos.reload();
    this.masters.reload();
  }

  protected onLimpiar(): void {
    this.filters.reset({
      q: '',
      lineaid: 0,
      categoriaid: 0,
      subcategoriaid: 0,
      marcaid: 0,
      unidadmedidaid: 0,
      stock: '',
      estado: '',
    });
    this.onApply();
  }

  // ── Desplegables de los filtros ─────────────────────────────────────
  /**
   * Categorías y unidades de medida devuelven el catálogo entero; marcas y líneas PAGINAN, así
   * que se les pide una página de `TOPE_CATALOGO`. Ver la constante.
   */
  private readonly categorias = resource({
    loader: () => firstValueFrom(this.categoriaApi.list()),
  });
  protected readonly opcionesCategoria = computed(() => this.categorias.value() ?? []);

  private readonly unidadesMedida = resource({
    // `incluir_inactivas` a propósito: un producto puede seguir apuntando a una unidad apagada,
    // y si el desplegable no la ofrece no habría forma de filtrar por ella.
    loader: () => firstValueFrom(this.unidadMedidaApi.list({ incluir_inactivas: true })),
  });
  protected readonly opcionesUnidadMedida = computed(() => this.unidadesMedida.value() ?? []);

  private readonly marcas = resource({
    loader: () => firstValueFrom(this.marcaApi.list({ page: 1, page_size: TOPE_CATALOGO })),
  });
  protected readonly opcionesMarca = computed(() => this.marcas.value()?.data ?? []);

  private readonly lineas = resource({
    loader: () => firstValueFrom(this.lineaApi.list({ page: 1, page_size: TOPE_CATALOGO })),
  });
  protected readonly opcionesLinea = computed(() => this.lineas.value()?.data ?? []);

  /**
   * La categoría elegida EN EL FORMULARIO, no la aplicada: el desplegable de subcategorías tiene
   * que reaccionar en cuanto se cambia la categoría, sin esperar a «Buscar». Es la única parte
   * del formulario que se lee en vivo.
   */
  private readonly categoriaElegida = signal(0);

  private readonly subcategorias = resource({
    params: () => this.categoriaElegida(),
    loader: ({ params }) =>
      firstValueFrom(
        // Sin categoría, el backend devuelve todas: el desplegable sigue siendo usable.
        this.subcategoriaApi.list(params ? { categoriaid: params } : {}),
      ),
  });
  protected readonly opcionesSubcategoria = computed(() => this.subcategorias.value() ?? []);

  constructor() {
    // Encadenado categoría → subcategoría. Al cambiar la categoría se recarga la lista y se
    // limpia la subcategoría elegida, que casi seguro ya no pertenece a la nueva.
    this.filters.controls.categoriaid.valueChanges.subscribe((id) => {
      this.categoriaElegida.set(Number(id) || 0);
      this.filters.controls.subcategoriaid.setValue(0, { emitEvent: false });
    });

    // Al cambiar de pestaña, la que se muestra puede no haberse pedido nunca.
    effect(() => {
      this.pestana();
      queueMicrotask(() => this.recargarVisible());
    });
  }

  private recargarVisible(): void {
    if (this.pestana() === 'productos') {
      if (this.productos.status() === 'idle') this.productos.reload();
    } else if (this.masters.status() === 'idle') {
      this.masters.reload();
    }
  }

  // ── Paginación: UNA por pestaña ─────────────────────────────────────
  protected readonly pageSizes = PAGE_SIZES;
  protected readonly pageSize = signal(25);
  protected readonly pageProductos = signal(1);
  protected readonly pageMasters = signal(1);

  // ── Pestaña 1: productos ────────────────────────────────────────────
  /**
   * `params` devuelve `undefined` cuando la pestaña no está a la vista, y entonces el `resource`
   * no llama al loader: la grilla que no se mira no consulta.
   */
  private readonly queryProductos = computed<ProductoListQuery | undefined>(() => {
    if (this.pestana() !== 'productos') return undefined;
    const a = this.applied();
    return {
      ...this.filtrosComunes(),
      page: this.pageProductos(),
      page_size: this.pageSize(),
      unidadmedidaid: a.unidadmedidaid,
    };
  });

  private readonly productos = resource({
    params: () => this.queryProductos(),
    loader: ({ params }) => firstValueFrom(this.productoApi.list(params)),
  });

  /** Copia editable de la página, para reflejar un cambio de estado sin recargar. */
  private readonly itemsProductos = linkedSignal<Producto[]>(
    () => this.productos.value()?.data ?? [],
  );
  protected readonly rowsProductos = this.itemsProductos;

  protected readonly cargandoProductos = this.productos.isLoading;
  protected readonly errorProductos = computed(() => {
    const e = this.productos.error();
    return e instanceof Error ? e.message : e ? 'No se pudo cargar el listado de productos.' : null;
  });

  protected readonly metaProductos = computed<PageMeta>(() => {
    const pageSize = this.pageSize();
    const total = this.productos.value()?.meta.total ?? 0;
    return {
      page: this.pageProductos(),
      pageSize,
      total,
      totalPages: pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1,
    };
  });

  // Sin `sortable`: el ordenamiento del `erp-data-grid` es de CLIENTE y con paginación de
  // servidor solo ordenaría la página en curso. El backend sabe ordenar por seis columnas
  // (`order_by`); conectarlo es una mejora pendiente, no un adorno de la grilla.
  protected readonly columnasProductos: GridColumn<Producto>[] = [
    { key: 'productoid', header: 'ID', width: '70px', align: 'right', mono: true },
    { key: 'masterid', header: 'MID', width: '70px', align: 'right', mono: true },
    { key: 'nombre', header: 'Nombre' },
    { key: 'subcategoria_nombre', header: 'Subcategoría', width: '160px' },
    { key: 'marca_nombre', header: 'Marca', width: '140px' },
    { key: 'stock', header: 'Stock', width: '90px', align: 'right', mono: true },
    { key: 'precio_com', header: 'P. compra', width: '110px', align: 'right', mono: true },
    { key: 'precio_va', header: 'P. venta A', width: '110px', align: 'right', mono: true },
    { key: 'estado', header: 'Estado', width: '110px' },
  ];

  protected readonly seleccionProductos = signal<Producto[]>([]);
  protected onSeleccionProductos(filas: Producto[]): void {
    this.seleccionProductos.set(filas);
  }

  protected onPageProductos(p: number): void {
    this.pageProductos.set(p);
    this.seleccionProductos.set([]);
  }

  protected onPageSize(ps: number): void {
    this.pageSize.set(ps);
    this.pageProductos.set(1);
    this.pageMasters.set(1);
    this.seleccionProductos.set([]);
    this.seleccionMasters.set([]);
  }

  /**
   * Alterna el estado de forma optimista y lo revierte si el backend falla. El endpoint es un
   * TOGGLE y devuelve el estado resultante, así que al confirmar se pinta lo que dice la base.
   *
   * La fila NO desaparece aunque deje de cumplir el filtro de estado: ese filtro es de servidor
   * y se resuelve al buscar, no a cada cambio.
   */
  protected async onToggleProducto(row: Producto): Promise<void> {
    this.patchProducto(row.productoid, { estado: !row.estado });
    try {
      const r = await firstValueFrom(this.productoApi.alternarEstado(row.productoid));
      if (typeof r?.estado === 'boolean') this.patchProducto(row.productoid, { estado: r.estado });
    } catch {
      this.patchProducto(row.productoid, { estado: row.estado });
    }
  }

  private patchProducto(id: number, patch: Partial<Producto>): void {
    this.itemsProductos.update((list) =>
      list.map((it) => (it.productoid === id ? { ...it, ...patch } : it)),
    );
  }

  /**
   * Borra y RECARGA, en vez de quitar la fila en local: con paginación de servidor el `total`
   * del pie lo cuenta el backend y la fila que asciende desde la página siguiente tiene que
   * aparecer.
   */
  protected async onEliminarProducto(row: Producto): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Eliminar producto',
      message: `¿Eliminar "${row.nombre}"? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      tone: 'danger',
    });
    if (!ok) return;

    try {
      await firstValueFrom(this.productoApi.remove(row.productoid));
      this.notify.success(`Se eliminó "${row.nombre}".`);
    } catch {
      // 409 si tiene movimientos, 403 si falta el permiso `producto-delete`: el
      // `error-interceptor` ya mostró el motivo, que el backend manda en `message`.
    }
    this.seleccionProductos.set([]);
    this.productos.reload();
  }

  protected async onEliminarProductosSeleccionados(): Promise<void> {
    const filas = this.seleccionProductos();
    if (filas.length === 0) return;

    const ok = await this.confirm.ask({
      title: 'Eliminar productos',
      message: `¿Eliminar ${filas.length} producto(s)? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      tone: 'danger',
    });
    if (!ok) return;

    try {
      const res = await firstValueFrom(
        this.productoApi.removeLote(filas.map((f) => f.productoid)),
      );
      const fallos = res.filter((r) => !r.ok);
      const eliminados = res.length - fallos.length;
      if (eliminados > 0) this.notify.success(`Se eliminaron ${eliminados} producto(s).`);
      if (fallos.length > 0) {
        // Los motivos se repiten —ventas, pedidos…—, así que se deduplican en vez de sacar un
        // toast por fila.
        const motivos = [...new Set(fallos.map((f) => f.mensaje).filter(Boolean))];
        this.notify.error(
          `${fallos.length} de ${res.length} no se pudieron eliminar. ${motivos.join(' ')}`.trim(),
        );
      }
    } catch {
      // Fallo de la petición entera: ya lo notificó el interceptor.
    }
    this.seleccionProductos.set([]);
    this.productos.reload();
  }

  // ── Mover de master ─────────────────────────────────────────────────
  protected readonly moverAbierto = signal(false);
  protected readonly moviendo = signal(false);
  /** Producto que se está moviendo; `null` = el diálogo está cerrado. */
  protected readonly productoAMover = signal<Producto | null>(null);
  /** Master destino elegido en el diálogo. */
  protected readonly masterDestino = signal(0);
  /** Texto del buscador del diálogo. */
  protected readonly buscarMaster = signal('');

  /** Masters candidatos: se buscan aparte de la grilla, sin los filtros de la pantalla. */
  private readonly mastersParaMover = resource({
    params: () => (this.moverAbierto() ? this.buscarMaster() : undefined),
    loader: ({ params }) =>
      firstValueFrom(this.masterApi.list({ page: 1, page_size: 50, q: params })),
  });
  protected readonly candidatosMaster = computed(() => {
    const actual = this.productoAMover()?.masterid;
    // El master que ya tiene no es un destino: el backend lo rechazaría con 422.
    return (this.mastersParaMover.value()?.data ?? []).filter((m) => m.masterid !== actual);
  });

  protected onAbrirMover(row: Producto): void {
    this.productoAMover.set(row);
    this.masterDestino.set(0);
    this.buscarMaster.set('');
    this.moverAbierto.set(true);
  }

  protected onCerrarMover(): void {
    this.moverAbierto.set(false);
    this.productoAMover.set(null);
  }

  protected onBuscarMaster(valor: string): void {
    this.buscarMaster.set(valor);
  }

  protected onElegirMaster(valor: string): void {
    this.masterDestino.set(Number(valor) || 0);
  }

  /**
   * Mueve el producto y RECARGA la grilla.
   *
   * ⚠ La recarga no es opcional: mover un producto CAMBIA SU NOMBRE VISIBLE, porque el backend
   * lo compone con el nombre del master. Parchear la fila con solo el `masterid` dejaría el
   * nombre viejo en pantalla.
   */
  protected async onConfirmarMover(): Promise<void> {
    const row = this.productoAMover();
    const destino = this.masterDestino();
    if (!row || !destino || this.moviendo()) return;

    this.moviendo.set(true);
    try {
      await firstValueFrom(this.productoApi.cambiarMaster(row.productoid, destino));
      this.notify.success(`"${row.nombre}" se movió de master.`);
      this.moverAbierto.set(false);
      this.productoAMover.set(null);
      this.productos.reload();
    } catch {
      // 422 si el master no existe o es el mismo: el interceptor ya lo mostró. El diálogo se
      // queda abierto para poder elegir otro.
    } finally {
      this.moviendo.set(false);
    }
  }

  // ── Pestaña 2: masters ──────────────────────────────────────────────
  private readonly queryMasters = computed<MasterListQuery | undefined>(() => {
    if (this.pestana() !== 'masters') return undefined;
    return {
      ...this.filtrosComunes(),
      page: this.pageMasters(),
      page_size: this.pageSize(),
    };
  });

  private readonly masters = resource({
    params: () => this.queryMasters(),
    loader: ({ params }) => firstValueFrom(this.masterApi.list(params)),
  });

  private readonly itemsMasters = linkedSignal<Master[]>(() => this.masters.value()?.data ?? []);
  protected readonly rowsMasters = this.itemsMasters;

  protected readonly cargandoMasters = this.masters.isLoading;
  protected readonly errorMasters = computed(() => {
    const e = this.masters.error();
    return e instanceof Error ? e.message : e ? 'No se pudo cargar el listado de masters.' : null;
  });

  protected readonly metaMasters = computed<PageMeta>(() => {
    const pageSize = this.pageSize();
    const total = this.masters.value()?.meta.total ?? 0;
    return {
      page: this.pageMasters(),
      pageSize,
      total,
      totalPages: pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1,
    };
  });

  protected readonly columnasMasters: GridColumn<Master>[] = [
    { key: 'masterid', header: 'ID', width: '70px', align: 'right', mono: true },
    { key: 'nombre', header: 'Nombre' },
    { key: 'abreviatura', header: 'Abreviatura', width: '140px' },
    { key: 'categoria_nombre', header: 'Categoría', width: '160px' },
    { key: 'marca_nombre', header: 'Marca', width: '140px' },
    { key: 'cantidad_productos', header: 'Productos', width: '140px' },
    { key: 'stock', header: 'Stock', width: '90px', align: 'right', mono: true },
    { key: 'estado', header: 'Estado', width: '110px' },
  ];

  protected readonly seleccionMasters = signal<Master[]>([]);
  protected onSeleccionMasters(filas: Master[]): void {
    this.seleccionMasters.set(filas);
  }

  protected onPageMasters(p: number): void {
    this.pageMasters.set(p);
    this.seleccionMasters.set([]);
  }

  protected async onToggleMaster(row: Master): Promise<void> {
    this.patchMaster(row.masterid, { estado: !row.estado });
    try {
      const r = await firstValueFrom(this.masterApi.alternarEstado(row.masterid));
      if (typeof r?.estado === 'boolean') this.patchMaster(row.masterid, { estado: r.estado });
    } catch {
      this.patchMaster(row.masterid, { estado: row.estado });
    }
  }

  private patchMaster(id: number, patch: Partial<Master>): void {
    this.itemsMasters.update((list) =>
      list.map((it) => (it.masterid === id ? { ...it, ...patch } : it)),
    );
  }

  protected async onEliminarMaster(row: Master): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Eliminar master',
      message: `¿Eliminar "${row.nombre}"? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      tone: 'danger',
    });
    if (!ok) return;

    try {
      await firstValueFrom(this.masterApi.remove(row.masterid));
      this.notify.success(`Se eliminó "${row.nombre}".`);
    } catch {
      // 409 si le cuelgan productos: ya lo notificó el interceptor.
    }
    this.seleccionMasters.set([]);
    this.masters.reload();
  }

  protected async onEliminarMastersSeleccionados(): Promise<void> {
    const filas = this.seleccionMasters();
    if (filas.length === 0) return;

    const ok = await this.confirm.ask({
      title: 'Eliminar masters',
      message: `¿Eliminar ${filas.length} master(s)? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      tone: 'danger',
    });
    if (!ok) return;

    try {
      const res = await firstValueFrom(this.masterApi.removeLote(filas.map((f) => f.masterid)));
      const fallos = res.filter((r) => !r.ok);
      const eliminados = res.length - fallos.length;
      if (eliminados > 0) this.notify.success(`Se eliminaron ${eliminados} master(s).`);
      if (fallos.length > 0) {
        const motivos = [...new Set(fallos.map((f) => f.mensaje).filter(Boolean))];
        this.notify.error(
          `${fallos.length} de ${res.length} no se pudieron eliminar. ${motivos.join(' ')}`.trim(),
        );
      }
    } catch {
      // Fallo de la petición entera: ya lo notificó el interceptor.
    }
    this.seleccionMasters.set([]);
    this.masters.reload();
  }

  // ── Exportación ─────────────────────────────────────────────────────
  /**
   * Exporta **la página que se está viendo** de la pestaña activa.
   *
   * ⚠ Como en marcas y líneas: con paginación de servidor solo hay una página en memoria, y
   * bajar el resto costaría N peticiones. Se exporta lo que se ve, que es lo honesto.
   */
  protected onExportar(e: ExportChoice): void {
    if (this.pestana() === 'productos') {
      const matriz = [
        ['ID', 'MID', 'Nombre', 'Subcategoría', 'Marca', 'Stock', 'P. compra', 'P. venta A', 'Estado'],
        ...this.rowsProductos().map((p) => [
          p.productoid,
          p.masterid,
          p.nombre,
          p.subcategoria_nombre,
          p.marca_nombre,
          p.stock,
          p.precio_com,
          p.precio_va,
          p.estado ? 'Activo' : 'Inactivo',
        ]),
      ];
      if (e.formato === 'csv') exportCsv('productos.csv', matriz);
      else exportXls('productos.xls', matriz);
      return;
    }

    const matriz = [
      ['ID', 'Nombre', 'Abreviatura', 'Categoría', 'Marca', 'Productos', 'Stock', 'Estado'],
      ...this.rowsMasters().map((m) => [
        m.masterid,
        m.nombre,
        m.abreviatura,
        m.categoria_nombre,
        m.marca_nombre,
        m.cantidad_productos,
        m.stock,
        m.estado ? 'Activo' : 'Inactivo',
      ]),
    ];
    if (e.formato === 'csv') exportCsv('masters.csv', matriz);
    else exportXls('masters.xls', matriz);
  }
}
