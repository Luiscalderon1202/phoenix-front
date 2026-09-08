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
import { AlmacenApi, ReferenciaApi, TipoEmpresaApi } from '@phoenix/basic/data-access';
import type { PageMeta } from '@phoenix/shared/api';
import {
  ALMACEN_MAX_ABREVIATURA,
  ALMACEN_MAX_DIRECCION,
  ALMACEN_MAX_EMAIL,
  ALMACEN_MAX_NOMBRE,
  ALMACEN_MAX_NOMBRE_COMERCIAL,
  ALMACEN_MAX_TELEFONO,
  ALMACEN_MAX_WEB,
  DISTRITO_MIN_BUSQUEDA,
  type Almacen,
  type AlmacenInput,
  type Distrito,
  etiquetaDistrito,
  limpiarDetallePersonas,
} from '@phoenix/basic/domain';
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

/** Opción del combo de distrito: el id más la etiqueta ya compuesta. */
interface OpcionDistrito {
  distritoid: number;
  etiqueta: string;
  nombre: string;
}

/** Los tres filtros que viajan al servidor, empaquetados para el `resource`. */
interface FiltrosServidor {
  q: string;
  zonaid: number;
  unidadnegocioid: number;
  tipoempresaid: number;
}

/**
 * Mantenimiento de Locales / Tiendas (`basic.almacen`, proceso `ALMACEN`, menuweb 69).
 *
 * ⚠ La tabla se llama `almacen` pero esto son LOCALES: la sede física —con su dirección, su
 * teléfono y su distrito— desde la que se vende. Por eso la referencian la caja, las series,
 * los correlativos de pedido y los precios por almacén.
 *
 * Esto es el MANTENIMIENTO. La configuración de venta por local vive en
 * `basic.empresa_almacen`, tras un procedimiento de ~55 argumentos, y es otro tramo: aquí no
 * se toca ni el grupo de stock ni la empresa a la que pertenece el local.
 *
 * Reparto de trabajo entre servidor y cliente, que aquí NO coincide:
 *
 * - **Texto, zona, unidad de negocio y tipo de empresa van al SERVIDOR**: los cuatro los
 *   acepta `basic.paalmacen_leer`. Filtrar el texto aquí sería reimplementar `public.buscar()`,
 *   que normaliza acentos con erratas conocidas.
 * - **El filtro de estado va al CLIENTE**: el stored procedure devuelve activos e inactivos
 *   sin parámetro que lo module, así que no hay nada que delegarle.
 * - **La paginación va al CLIENTE**: el endpoint devuelve el catálogo entero y sin `meta`. No
 *   acepta `vinicio`/`vfin` y no existe un `paalmacen_count` con el que emparejarlo.
 *
 * ⚠ **No hay borrado en lote y la grilla no es seleccionable.** `paalmacen_eliminar`
 * comprueba cinco tablas —ventas, ingresos, salidas, transferencias y caja— y, si las pasa,
 * limpia CATORCE satélites antes de borrar la fila. Eso no se hace marcando casillas.
 */
@Component({
  selector: 'erp-almacen-list-page',
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
  templateUrl: './almacen-list-page.html',
  styleUrl: './almacen-list-page.scss',
})
export class AlmacenListPage {
  private readonly api = inject(AlmacenApi);
  private readonly referencia = inject(ReferenciaApi);
  private readonly tipoEmpresaApi = inject(TipoEmpresaApi);
  private readonly fb = inject(FormBuilder);
  private readonly notify = inject(NotificationService);
  private readonly confirm = inject(ConfirmService);
  private readonly location = inject(Location);
  private readonly router = inject(Router);

  private readonly hayHistoria = !!this.router.lastSuccessfulNavigation()?.previousNavigation;

  /** Cierra y vuelve por donde se vino. Sin historia, `location.back()` sacaría del ERP. */
  protected onCerrar(): void {
    if (this.hayHistoria) {
      this.location.back();
      return;
    }
    void this.router.navigate(['/inicio']);
  }

  protected readonly maxNombre = ALMACEN_MAX_NOMBRE;
  protected readonly maxNombreComercial = ALMACEN_MAX_NOMBRE_COMERCIAL;
  protected readonly maxAbreviatura = ALMACEN_MAX_ABREVIATURA;
  protected readonly maxDireccion = ALMACEN_MAX_DIRECCION;
  protected readonly maxTelefono = ALMACEN_MAX_TELEFONO;
  protected readonly maxEmail = ALMACEN_MAX_EMAIL;
  protected readonly maxWeb = ALMACEN_MAX_WEB;
  protected readonly minBusquedaDistrito = DISTRITO_MIN_BUSQUEDA;

  // ── Filtros ─────────────────────────────────────────────────────────
  protected readonly filters = this.fb.nonNullable.group({
    q: '',
    zonaid: 0,
    unidadnegocioid: 0,
    tipoempresaid: 0,
    estado: 'todas', // solo este se resuelve en cliente
  });

  /**
   * ⚠ DOS señales, no una con el `getRawValue()` entero. El `resource` depende de
   * `appliedServidor`, y `estado` NO viaja al backend: metidos en el mismo objeto, cambiar el
   * selector de estado produciría un objeto nuevo y dispararía una petición idéntica a la
   * anterior.
   *
   * `appliedServidor` sí es un objeto —son cuatro valores—, así que solo se fija cuando alguno
   * cambia de verdad; ver `onApply`.
   */
  private readonly appliedServidor = signal<FiltrosServidor>({
    q: '',
    zonaid: 0,
    unidadnegocioid: 0,
    tipoempresaid: 0,
  });
  private readonly appliedEstado = signal('todas');

  // ── Datos ───────────────────────────────────────────────────────────
  private readonly catalogo = resource({
    params: () => this.appliedServidor(),
    loader: ({ params }) => firstValueFrom(this.api.list(params)),
  });

  /** Copia editable del resultado, para tocar estado y orden sin recargar. */
  private readonly items = linkedSignal<Almacen[]>(() =>
    this.catalogo.hasValue() ? this.catalogo.value() : [],
  );

  /** Lo que trajo el servidor, con el filtro de estado aplicado en cliente. */
  protected readonly rows = computed<Almacen[]>(() => {
    const estado = this.appliedEstado();
    const lista = this.items();
    if (estado === 'activos') return lista.filter((a) => a.estado);
    if (estado === 'inactivos') return lista.filter((a) => !a.estado);
    return lista;
  });

  protected readonly loading = this.catalogo.isLoading;
  protected readonly error = computed(() => {
    const e = this.catalogo.error();
    return e instanceof Error ? e.message : e ? 'No se pudo cargar el listado de locales.' : null;
  });

  /**
   * Aplica los filtros. Los cuatro de servidor se fijan juntos, pero **solo si alguno cambió**:
   * `signal` compara por referencia y un objeto nuevo con el mismo contenido recargaría el
   * `resource` sin motivo.
   */
  protected onApply(): void {
    const { q, zonaid, unidadnegocioid, tipoempresaid, estado } = this.filters.getRawValue();
    const nuevo: FiltrosServidor = {
      q: q.trim(),
      zonaid,
      unidadnegocioid,
      tipoempresaid,
    };
    const previo = this.appliedServidor();
    const cambio =
      previo.q !== nuevo.q ||
      previo.zonaid !== nuevo.zonaid ||
      previo.unidadnegocioid !== nuevo.unidadnegocioid ||
      previo.tipoempresaid !== nuevo.tipoempresaid;
    if (cambio) this.appliedServidor.set(nuevo);

    this.appliedEstado.set(estado);
    this.page.set(1); // el filtro cambia el universo: la página anterior ya no significa nada
  }

  // ── Paginación (en cliente) ─────────────────────────────────────────
  protected readonly pageSizes = PAGE_SIZES;
  protected readonly page = signal(1);
  protected readonly pageSize = signal(25);

  protected readonly rowsPagina = computed<Almacen[]>(() => {
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
  }

  protected onPageSize(ps: number): void {
    this.pageSize.set(ps);
    this.page.set(1);
  }

  /** El arrastre solo vale con el catálogo entero a la vista. Ver el mismo caso en colores. */
  protected readonly filtrando = computed(() => {
    const f = this.appliedServidor();
    return (
      f.q !== '' ||
      f.zonaid !== 0 ||
      f.unidadnegocioid !== 0 ||
      f.tipoempresaid !== 0 ||
      this.appliedEstado() !== 'todas' ||
      this.meta().totalPages > 1
    );
  });

  // ── Columnas ────────────────────────────────────────────────────────
  protected readonly columns: GridColumn<Almacen>[] = [
    { key: 'orden', header: '#', width: '60px', align: 'right', mono: true },
    // ⚠ Los anchos están ajustados para que la SUMA quepa en el ancho útil de la
    // pantalla. Ocho columnas holgadas se pasan del presupuesto y la grilla lo resuelve
    // estrechando las de texto, que acaban partiendo cada nombre en tres líneas.
    { key: 'nombre', header: 'Local', width: '200px' },
    { key: 'zona_nombre', header: 'Zona', width: '110px' },
    { key: 'unidadnegocio_nombre', header: 'Unidad de negocio', width: '140px' },
    { key: 'tipoempresa_nombre', header: 'Tipo', width: '130px' },
    { key: 'distrito_nombre', header: 'Ubicación', width: '170px' },
    { key: 'cantidad_personas', header: 'Personal', width: '160px' },
    { key: 'estado', header: 'Estado', width: '110px' },
  ];

  /** Quita el marcado `[1]…[/1]` que el legacy mete en `personas_detalle`. */
  protected detallePersonas(row: Almacen): string {
    return limpiarDetallePersonas(row.personas_detalle);
  }

  // ── Estado ──────────────────────────────────────────────────────────
  protected async onToggleEstado(row: Almacen): Promise<void> {
    this.patchRow(row.almacenid, { estado: !row.estado });
    try {
      const resultado = await firstValueFrom(this.api.alternarEstado(row.almacenid));
      if (typeof resultado?.estado === 'boolean') {
        this.patchRow(row.almacenid, { estado: resultado.estado });
      }
    } catch {
      this.patchRow(row.almacenid, { estado: row.estado });
    }
  }

  private patchRow(id: number, patch: Partial<Almacen>): void {
    this.items.update((list) =>
      list.map((it) => (it.almacenid === id ? { ...it, ...patch } : it)),
    );
  }

  // ── Reordenamiento ──────────────────────────────────────────────────
  protected async onReorder(filas: Almacen[]): Promise<void> {
    const previo = this.items();
    this.items.set(filas.map((f, i) => ({ ...f, orden: i + 1 })));
    try {
      await firstValueFrom(this.api.reordenar(filas.map((f) => f.almacenid), 1));
    } catch {
      this.items.set(previo);
    }
  }

  // ── Catálogos de filtros y formulario ───────────────────────────────
  /**
   * Zonas y tipos de empresa: catálogos cortos, se cargan enteros una vez y sirven tanto al
   * panel de filtros como al formulario.
   *
   * ⚠ Las zonas son de SOLO LECTURA en Phoenix: `basic.zona` no tiene ni fila en
   * `basic.menuweb`. No hay pantalla que las mantenga, ni aquí ni en el legacy.
   */
  private readonly zonasRes = resource({
    loader: () => firstValueFrom(this.referencia.zonas()),
  });
  /**
   * ⚠ `hasValue()` y no `value() ?? []`. Un `resource` en estado de error **lanza**
   * `ResourceValueError` al leer `value()`, y como esto se lee durante el render, un catálogo
   * auxiliar caído se lleva por delante la pantalla ENTERA: ni grilla, ni aviso, nada.
   * Visto en vivo — un 500 en `/tipos-empresa` dejaba la página en blanco.
   *
   * Que un desplegable no cargue tiene que degradar ese desplegable, no la pantalla.
   */
  protected readonly zonas = computed(() =>
    this.zonasRes.hasValue() ? this.zonasRes.value() : [],
  );

  private readonly tiposEmpresaRes = resource({
    loader: () => firstValueFrom(this.tipoEmpresaApi.list()),
  });
  protected readonly tiposEmpresa = computed(() =>
    this.tiposEmpresaRes.hasValue() ? this.tiposEmpresaRes.value() : [],
  );

  /**
   * Unidades de negocio del FILTRO: todas, sin acotar. En el panel de filtros los desplegables
   * son independientes —se puede filtrar por unidad sin elegir tipo—, al contrario que en el
   * formulario, donde sí van encadenados.
   */
  private readonly unidadesFiltroRes = resource({
    loader: () => firstValueFrom(this.referencia.unidadesNegocio()),
  });
  protected readonly unidadesFiltro = computed(() =>
    this.unidadesFiltroRes.hasValue() ? this.unidadesFiltroRes.value() : [],
  );

  /**
   * Unidades de negocio del FORMULARIO, acotadas al tipo de empresa elegido: toda unidad de
   * negocio cuelga de un tipo, así que los dos selectores van encadenados.
   */
  protected readonly tipoEmpresaForm = signal(0);
  private readonly unidadesFormRes = resource({
    params: () => this.tipoEmpresaForm(),
    loader: ({ params }) => firstValueFrom(this.referencia.unidadesNegocio(params)),
  });
  protected readonly unidadesForm = computed(() =>
    this.unidadesFormRes.hasValue() ? this.unidadesFormRes.value() : [],
  );

  /**
   * Al cambiar el tipo de empresa se limpia la unidad elegida: la que estaba puesta pertenece
   * al tipo anterior y dejarla ahí mandaría al backend una combinación que no existe.
   */
  protected onTipoEmpresaCambio(valor: string | number | null): void {
    const id = Number(valor ?? 0);
    this.tipoEmpresaForm.set(id);
    this.form.controls.unidadnegocioid.setValue(0);
  }

  // ── Distritos (buscador, no catálogo) ───────────────────────────────
  protected readonly busquedaDistrito = signal('');

  /**
   * ⚠ Los distritos NO se cargan enteros: son 1.839 filas y el backend exige acotar. El
   * `ReferenciaApi` corta antes de salir a la red.
   */
  private readonly distritosRes = resource({
    params: () => this.busquedaDistrito(),
    loader: ({ params }) => firstValueFrom(this.referencia.distritos({ q: params })),
  });

  /** El distrito del local en edición, para que el combo pueda mostrar su etiqueta. */
  private readonly distritoActual = signal<OpcionDistrito | null>(null);

  protected readonly opcionesDistrito = computed<OpcionDistrito[]>(() => {
    const hallados = this.distritosRes.hasValue() ? this.distritosRes.value() : [];
    const encontrados: OpcionDistrito[] = hallados.map(
      (d: Distrito) => ({
        distritoid: d.distritoid,
        etiqueta: etiquetaDistrito(d),
        nombre: d.nombre,
      }),
    );
    const actual = this.distritoActual();
    if (actual && !encontrados.some((o) => o.distritoid === actual.distritoid)) {
      return [actual, ...encontrados];
    }
    return encontrados;
  });

  protected readonly buscandoDistritos = this.distritosRes.isLoading;

  protected onBuscarDistrito(texto: string): void {
    this.busquedaDistrito.set(texto.trim());
  }

  // ── Alta y edición ──────────────────────────────────────────────────
  protected readonly modalAbierto = signal(false);
  protected readonly editando = signal<Almacen | null>(null);
  protected readonly guardando = signal(false);

  /**
   * Los campos que escribe el stored procedure. Ni `estado` ni `orden` —cada uno tiene su
   * acción en la grilla— ni `grupoid`, que es de la configuración del local, otro tramo.
   */
  protected readonly form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(ALMACEN_MAX_NOMBRE)]],
    nombre_comercial: ['', [Validators.maxLength(ALMACEN_MAX_NOMBRE_COMERCIAL)]],
    abreviatura: ['', [Validators.maxLength(ALMACEN_MAX_ABREVIATURA)]],
    tipoempresaid: [0, [Validators.required, Validators.min(1)]],
    unidadnegocioid: [0, [Validators.required, Validators.min(1)]],
    zonaid: [0, [Validators.required, Validators.min(1)]],
    distritoid: [0, [Validators.required, Validators.min(1)]],
    direccion: ['', [Validators.maxLength(ALMACEN_MAX_DIRECCION)]],
    telefono: ['', [Validators.maxLength(ALMACEN_MAX_TELEFONO)]],
    email: ['', [Validators.maxLength(ALMACEN_MAX_EMAIL)]],
    web: ['', [Validators.maxLength(ALMACEN_MAX_WEB)]],
  });

  protected readonly tituloModal = computed(() =>
    this.editando() ? 'Editar local' : 'Nuevo local',
  );

  protected onNuevo(): void {
    this.editando.set(null);
    this.distritoActual.set(null);
    this.busquedaDistrito.set('');
    this.tipoEmpresaForm.set(0);
    this.form.reset({
      nombre: '',
      nombre_comercial: '',
      abreviatura: '',
      tipoempresaid: 0,
      unidadnegocioid: 0,
      zonaid: 0,
      distritoid: 0,
      direccion: '',
      telefono: '',
      email: '',
      web: '',
    });
    this.modalAbierto.set(true);
  }

  /**
   * Abre la edición pidiendo la FICHA, y aquí sí hace falta la petición: `nombre_comercial`
   * es un campo editable que **el listado no devuelve**. Sin la ficha, editar un local
   * borraría su nombre comercial sin que el usuario lo viera.
   */
  protected async onEditar(row: Almacen): Promise<void> {
    this.editando.set(row);
    this.distritoActual.set({
      distritoid: row.distritoid,
      etiqueta: `${row.distrito_nombre} (${row.provincia_nombre}, ${row.departamento_nombre})`,
      nombre: row.distrito_nombre,
    });
    this.busquedaDistrito.set('');
    this.tipoEmpresaForm.set(row.tipoempresaid);

    // Se abre con lo que ya se tiene para que el modal no espere en blanco, y se completa
    // cuando llega la ficha.
    this.form.reset({
      nombre: row.nombre,
      nombre_comercial: '',
      abreviatura: row.abreviatura,
      tipoempresaid: row.tipoempresaid,
      unidadnegocioid: row.unidadnegocioid,
      zonaid: row.zonaid,
      distritoid: row.distritoid,
      direccion: row.direccion,
      telefono: row.telefono,
      email: row.email,
      web: row.web,
    });
    this.modalAbierto.set(true);

    try {
      const ficha = await firstValueFrom(this.api.get(row.almacenid));
      this.form.patchValue({ nombre_comercial: ficha.nombre_comercial });
    } catch {
      // El interceptor ya notificó. El resto del formulario sigue siendo utilizable.
    }
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

    const input: AlmacenInput = this.form.getRawValue();
    const enEdicion = this.editando();
    this.guardando.set(true);

    try {
      if (enEdicion) {
        await firstValueFrom(this.api.update(enEdicion.almacenid, input));
      } else {
        await firstValueFrom(this.api.create(input));
      }
      this.notify.success(
        enEdicion ? `Se actualizó "${input.nombre}".` : `Se creó "${input.nombre}".`,
      );
      this.modalAbierto.set(false);
      /**
       * ⚠ Se RECARGA en vez de parchear en local: guardar devuelve una `AlmacenFicha`, que no
       * es la fila del listado —le faltan el orden, la empresa, las abreviaturas de los
       * catálogos y los contadores de personal—. Meterla tal cual dejaría celdas en blanco.
       */
      this.catalogo.reload();
    } catch {
      // 409 (nombre duplicado) y 422 (validación): el `error-interceptor` ya mostró el
      // `message` del backend. El modal se queda abierto con lo escrito.
    } finally {
      this.guardando.set(false);
    }
  }

  // ── Eliminación ─────────────────────────────────────────────────────
  /**
   * Borrado de UN local. No hay lote a propósito: el stored procedure comprueba cinco tablas
   * y, si las pasa, limpia catorce satélites —configuración, stock, series, correlativos,
   * permisos, precios por almacén…— antes de borrar la fila.
   */
  protected async onEliminar(row: Almacen): Promise<void> {
    const aviso =
      row.cantidad_personas > 0 ? ` Tiene ${row.cantidad_personas} persona(s) asignada(s).` : '';

    const ok = await this.confirm.ask({
      title: 'Eliminar local',
      message:
        `¿Eliminar "${row.nombre}"?${aviso} Se borrarán también su configuración, series, ` +
        'correlativos y precios por local. Esta acción no se puede deshacer.',
      confirmText: 'Eliminar',
      tone: 'danger',
    });
    if (!ok) return;

    try {
      await firstValueFrom(this.api.remove(row.almacenid));
      this.items.update((list) => list.filter((it) => it.almacenid !== row.almacenid));
      this.notify.success(`Se eliminó "${row.nombre}".`);
    } catch {
      // 409 si tiene movimientos: ya lo notificó el interceptor, con cuál de las cinco tablas
      // fue. Se recarga por si el listado cambió por otro lado.
      this.catalogo.reload();
    }
  }

  // ── Exportación ─────────────────────────────────────────────────────
  /** Exporta **lo que se está viendo**, filtros incluidos, generándolo en el navegador. */
  protected onExportar(e: ExportChoice): void {
    const cabeceras = [
      'Orden',
      'ID',
      'Local',
      'Abreviatura',
      'Zona',
      'Unidad de negocio',
      'Tipo de empresa',
      'Empresa',
      'Dirección',
      'Distrito',
      'Provincia',
      'Departamento',
      'Teléfono',
      'Email',
      'Personal',
      'Estado',
    ];
    const matriz = [
      cabeceras,
      ...this.rows().map((a) => [
        a.orden,
        a.almacenid,
        a.nombre,
        a.abreviatura,
        a.zona_nombre,
        a.unidadnegocio_nombre,
        a.tipoempresa_nombre,
        a.empresa_nombre,
        a.direccion,
        a.distrito_nombre,
        a.provincia_nombre,
        a.departamento_nombre,
        a.telefono,
        a.email,
        a.cantidad_personas,
        a.estado ? 'Activo' : 'Inactivo',
      ]),
    ];

    if (e.formato === 'csv') {
      exportCsv('locales.csv', matriz);
    } else {
      exportXls('locales.xls', matriz);
    }
  }
}
