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
import { EmpresaApi, ReferenciaApi } from '@phoenix/basic/data-access';
import type { PageMeta } from '@phoenix/shared/api';
import {
  DISTRITO_MIN_BUSQUEDA,
  EMPRESA_LONGITUD_RUC,
  EMPRESA_MAX_ABREVIATURA,
  EMPRESA_MAX_DIRECCION,
  EMPRESA_MAX_EMAIL,
  EMPRESA_MAX_NOMBRE,
  EMPRESA_MAX_NOMBRE_COMERCIAL,
  EMPRESA_MAX_TELEFONO,
  EMPRESA_MAX_URL,
  type Distrito,
  type Empresa,
  type EmpresaInput,
  etiquetaDistrito,
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

/**
 * Mantenimiento de Empresas (`basic.empresa`, proceso `EMPRESA`, menuweb 6).
 *
 * La empresa es la persona jurídica que factura. Esto es el MANTENIMIENTO del catálogo: la
 * configuración —certificados, series, correlativos, webservices de SUNAT— es otra pantalla
 * (`EmpresaConfig.php`, ~95 argumentos) y otro tramo.
 *
 * ⚠ **TODO el filtrado y TODA la paginación son de cliente, y no por gusto:**
 * `basic.paempresa_leer()` **no acepta ningún argumento**. Ni texto, ni estado, ni página.
 * Al contrario que su hermana de locales, que tiene cuatro filtros. No hay nada que
 * delegarle al servidor, así que el `resource` no lleva `params` y se recarga a mano.
 *
 * ⚠ **No hay borrado en lote y la grilla no es seleccionable**, y no por omisión: contra
 * `basic.empresa` apuntan más de veinte claves foráneas. Borrar la persona jurídica que
 * factura no se hace marcando casillas.
 *
 * El distrito no se sirve como catálogo: son 1.839 filas y el backend exige acotar la
 * búsqueda. Por eso el formulario tiene un buscador propio en vez de un desplegable lleno.
 */
@Component({
  selector: 'erp-empresa-list-page',
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
  templateUrl: './empresa-list-page.html',
  styleUrl: './empresa-list-page.scss',
})
export class EmpresaListPage {
  private readonly api = inject(EmpresaApi);
  private readonly referencia = inject(ReferenciaApi);
  private readonly fb = inject(FormBuilder);
  private readonly notify = inject(NotificationService);
  private readonly confirm = inject(ConfirmService);
  private readonly location = inject(Location);
  private readonly router = inject(Router);

  /**
   * Si esta pantalla se abrió desde otra de la app hay historia a la que volver; si se llegó
   * pegando la URL en la barra, no.
   */
  private readonly hayHistoria = !!this.router.lastSuccessfulNavigation()?.previousNavigation;

  /** Cierra y vuelve por donde se vino. Sin historia, `location.back()` sacaría del ERP. */
  protected onCerrar(): void {
    if (this.hayHistoria) {
      this.location.back();
      return;
    }
    void this.router.navigate(['/inicio']);
  }

  protected readonly maxNombre = EMPRESA_MAX_NOMBRE;
  protected readonly maxNombreComercial = EMPRESA_MAX_NOMBRE_COMERCIAL;
  protected readonly maxAbreviatura = EMPRESA_MAX_ABREVIATURA;
  protected readonly maxDireccion = EMPRESA_MAX_DIRECCION;
  protected readonly maxUrl = EMPRESA_MAX_URL;
  protected readonly maxEmail = EMPRESA_MAX_EMAIL;
  protected readonly maxTelefono = EMPRESA_MAX_TELEFONO;
  protected readonly longitudRuc = EMPRESA_LONGITUD_RUC;
  protected readonly minBusquedaDistrito = DISTRITO_MIN_BUSQUEDA;

  // ── Filtros (los dos en cliente) ────────────────────────────────────
  protected readonly filters = this.fb.nonNullable.group({
    q: '',
    estado: 'todas', // 'todas' | 'activos' | 'inactivos'
  });
  /**
   * Dos señales primitivas y no una de objeto: `signal<string>` deduplica, así que fijarlas
   * al mismo valor no notifica a nadie. Con un objeto literal cada `onApply()` produciría uno
   * nuevo y recalcularía la lista sin motivo.
   *
   * Aquí ninguna de las dos viaja al backend —el endpoint no acepta filtros—, pero se
   * mantiene la misma forma que en el resto de pantallas para que se lean igual.
   */
  private readonly appliedQ = signal('');
  private readonly appliedEstado = signal('todas');

  // ── Datos ───────────────────────────────────────────────────────────
  /**
   * ⚠ Sin `params`: no hay nada que mandarle. El endpoint devuelve el catálogo entero y no
   * acepta filtros, así que la única forma de repetir la petición es `reload()`.
   */
  private readonly catalogo = resource({
    loader: () => firstValueFrom(this.api.list()),
  });

  /**
   * Lista de trabajo: copia editable del resultado. Permite alternar estado, reordenar, dar
   * de alta y borrar de forma optimista sin recargar el catálogo entero.
   */
  private readonly items = linkedSignal<Empresa[]>(() =>
    this.catalogo.hasValue() ? this.catalogo.value() : [],
  );

  /**
   * Filas visibles. El texto busca sobre lo que el usuario ve escrito en la grilla —razón
   * social, RUC, abreviatura y corporación—, no solo sobre el nombre: si el RUC está en la
   * columna, tiene que poder buscarse por él.
   */
  protected readonly rows = computed<Empresa[]>(() => {
    const q = this.appliedQ().toLocaleLowerCase();
    const estado = this.appliedEstado();

    return this.items().filter((e) => {
      if (estado === 'activos' && !e.estado) return false;
      if (estado === 'inactivos' && e.estado) return false;
      if (!q) return true;
      return (
        e.nombre.toLocaleLowerCase().includes(q) ||
        e.ruc.toLocaleLowerCase().includes(q) ||
        e.abreviatura.toLocaleLowerCase().includes(q) ||
        e.nombre_comercial.toLocaleLowerCase().includes(q) ||
        e.corporacion_nombre.toLocaleLowerCase().includes(q)
      );
    });
  });

  protected readonly loading = this.catalogo.isLoading;
  protected readonly error = computed(() => {
    const e = this.catalogo.error();
    return e instanceof Error ? e.message : e ? 'No se pudo cargar el catálogo de empresas.' : null;
  });

  protected onApply(): void {
    const { q, estado } = this.filters.getRawValue();
    this.appliedQ.set(q.trim());
    this.appliedEstado.set(estado);
    this.page.set(1); // el filtro cambia el universo: la página 3 anterior ya no significa nada
  }

  // ── Paginación (en cliente) ─────────────────────────────────────────
  protected readonly pageSizes = PAGE_SIZES;
  protected readonly page = signal(1);
  protected readonly pageSize = signal(25);

  protected readonly rowsPagina = computed<Empresa[]>(() => {
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

  /**
   * El arrastre solo se enciende cuando lo que se ve ES el catálogo entero. En cualquier otro
   * caso la grilla emitiría solo las filas visibles, y renumerarlas desde 1 machacaría el
   * `orden` de las que no se ven.
   */
  protected readonly filtrando = computed(
    () => this.appliedQ() !== '' || this.appliedEstado() !== 'todas' || this.meta().totalPages > 1,
  );

  // ── Columnas ────────────────────────────────────────────────────────
  // Sin `sortable`: el orden de este catálogo es un dato editable (`orden`), no una vista.
  protected readonly columns: GridColumn<Empresa>[] = [
    { key: 'orden', header: '#', width: '60px', align: 'right', mono: true },
    { key: 'ruc', header: 'RUC', width: '130px', mono: true },
    // Ancho explícito: sin él la grilla estrecha esta columna hasta partir la razón
    // social en cuatro líneas, aunque sobre sitio a la derecha.
    { key: 'nombre', header: 'Razón social', width: '280px' },
    { key: 'abreviatura', header: 'Abreviatura', width: '140px' },
    { key: 'corporacion_nombre', header: 'Corporación', width: '150px' },
    { key: 'distrito_nombre', header: 'Ubicación', width: '200px' },
    { key: 'cantidad_almacenes', header: 'Locales', width: '110px' },
    { key: 'estado', header: 'Estado', width: '110px' },
  ];

  // ── Estado ──────────────────────────────────────────────────────────
  /**
   * Alterna el estado de forma optimista y lo revierte si el backend falla (el
   * `error-interceptor` ya notificó el motivo). El endpoint es un TOGGLE, pero devuelve el
   * estado resultante, así que al confirmar se pinta lo que dice el backend.
   */
  protected async onToggleEstado(row: Empresa): Promise<void> {
    this.patchRow(row.empresaid, { estado: !row.estado });
    try {
      const resultado = await firstValueFrom(this.api.alternarEstado(row.empresaid));
      if (typeof resultado?.estado === 'boolean') {
        this.patchRow(row.empresaid, { estado: resultado.estado });
      }
    } catch {
      this.patchRow(row.empresaid, { estado: row.estado });
    }
  }

  private patchRow(id: number, patch: Partial<Empresa>): void {
    this.items.update((list) =>
      list.map((it) => (it.empresaid === id ? { ...it, ...patch } : it)),
    );
  }

  // ── Reordenamiento ──────────────────────────────────────────────────
  /**
   * Guarda el nuevo orden tras arrastrar. Se manda la lista COMPLETA con `desde = 1`, así que
   * la numeración queda 1..n; por eso el arrastre se apaga con cualquier filtro puesto.
   */
  protected async onReorder(filas: Empresa[]): Promise<void> {
    const previo = this.items();
    this.items.set(filas.map((f, i) => ({ ...f, orden: i + 1 })));
    try {
      await firstValueFrom(this.api.reordenar(filas.map((f) => f.empresaid), 1));
    } catch {
      this.items.set(previo);
    }
  }

  // ── Catálogos del formulario ────────────────────────────────────────
  /**
   * Corporaciones: catálogo corto y estable, se carga entero una vez.
   *
   * ⚠ De SOLO LECTURA: su pantalla del legacy (`basic.menuweb` 95) está con `estado=false`.
   * Si hace falta una corporación nueva, hoy se crea contra la base.
   */
  private readonly corporacionesRes = resource({
    loader: () => firstValueFrom(this.referencia.corporaciones()),
  });
  /**
   * ⚠ `hasValue()` y no `value() ?? []`. Un `resource` en estado de error **lanza**
   * `ResourceValueError` al leer `value()`, y como esto se lee durante el render, un catálogo
   * auxiliar caído se lleva por delante la pantalla ENTERA: ni grilla, ni aviso, nada.
   * Visto en vivo — un 500 en `/tipos-empresa` dejaba la página en blanco.
   *
   * Que un desplegable no cargue tiene que degradar ese desplegable, no la pantalla.
   */
  protected readonly corporaciones = computed(() =>
    this.corporacionesRes.hasValue() ? this.corporacionesRes.value() : [],
  );

  /**
   * Texto con el que se buscan distritos. Es una señal aparte del formulario porque no es un
   * campo que se guarde: solo alimenta la búsqueda.
   */
  protected readonly busquedaDistrito = signal('');

  /**
   * ⚠ Los distritos NO se cargan enteros: son 1.839 filas y el backend exige al menos dos
   * caracteres. El `ReferenciaApi` corta antes de salir a la red, así que con menos de dos
   * esto no gasta ninguna petición.
   */
  private readonly distritosRes = resource({
    params: () => this.busquedaDistrito(),
    loader: ({ params }) => firstValueFrom(this.referencia.distritos({ q: params })),
  });

  /**
   * El distrito de la empresa que se está editando, para que el combo pueda mostrar su
   * etiqueta antes de que el usuario busque nada. Sin esto, al abrir «Editar» el campo
   * aparecería vacío aunque el valor esté puesto.
   */
  private readonly distritoActual = signal<OpcionDistrito | null>(null);

  /** Opciones del combo: lo que trajo la búsqueda, más el actual si no viene ya en la lista. */
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
  /** `null` = alta; con valor = edición de ese registro. */
  protected readonly editando = signal<Empresa | null>(null);
  protected readonly guardando = signal(false);

  /**
   * Los campos que acepta el backend. Ni `estado` ni `orden` —cada uno tiene su acción en la
   * grilla—, ni el IGV, que se configura en otra pantalla, ni `cantidad_almacenes`, derivado.
   */
  protected readonly form = this.fb.nonNullable.group({
    ruc: [
      '',
      [
        Validators.required,
        // Once dígitos exactos: ni diez, ni doce, ni letras. Lo mismo que valida el backend.
        Validators.pattern(`^\\d{${EMPRESA_LONGITUD_RUC}}$`),
      ],
    ],
    nombre: ['', [Validators.required, Validators.maxLength(EMPRESA_MAX_NOMBRE)]],
    nombre_comercial: ['', [Validators.maxLength(EMPRESA_MAX_NOMBRE_COMERCIAL)]],
    abreviatura: ['', [Validators.maxLength(EMPRESA_MAX_ABREVIATURA)]],
    corporacionid: [0, [Validators.required, Validators.min(1)]],
    distritoid: [0, [Validators.required, Validators.min(1)]],
    direccion: ['', [Validators.maxLength(EMPRESA_MAX_DIRECCION)]],
    telefono: ['', [Validators.maxLength(EMPRESA_MAX_TELEFONO)]],
    email: ['', [Validators.maxLength(EMPRESA_MAX_EMAIL)]],
    url: ['', [Validators.maxLength(EMPRESA_MAX_URL)]],
  });

  protected readonly tituloModal = computed(() =>
    this.editando() ? 'Editar empresa' : 'Nueva empresa',
  );

  protected onNuevo(): void {
    this.editando.set(null);
    this.distritoActual.set(null);
    this.busquedaDistrito.set('');
    this.form.reset({
      ruc: '',
      nombre: '',
      nombre_comercial: '',
      abreviatura: '',
      corporacionid: 0,
      distritoid: 0,
      direccion: '',
      telefono: '',
      email: '',
      url: '',
    });
    this.modalAbierto.set(true);
  }

  /**
   * Abre la edición con los datos de la FILA, sin volver a pedir la ficha.
   *
   * La ficha (`GET /empresas/{id}`) trae país, ubigeo e IGV, pero **ninguno de los tres es
   * editable aquí**, y todo lo que sí lo es ya viene en el listado. Pedirla sería una
   * petición para descartar su contenido.
   */
  protected onEditar(row: Empresa): void {
    this.editando.set(row);
    this.distritoActual.set({
      distritoid: row.distritoid,
      etiqueta: `${row.distrito_nombre} (${row.provincia_nombre}, ${row.departamento_nombre})`,
      nombre: row.distrito_nombre,
    });
    this.busquedaDistrito.set('');
    this.form.reset({
      ruc: row.ruc,
      nombre: row.nombre,
      nombre_comercial: row.nombre_comercial,
      abreviatura: row.abreviatura,
      corporacionid: row.corporacionid,
      distritoid: row.distritoid,
      direccion: row.direccion,
      telefono: row.telefono,
      email: row.email,
      url: row.url,
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

    const input: EmpresaInput = this.form.getRawValue();
    const enEdicion = this.editando();
    this.guardando.set(true);

    try {
      if (enEdicion) {
        await firstValueFrom(this.api.update(enEdicion.empresaid, input));
      } else {
        await firstValueFrom(this.api.create(input));
      }
      this.notify.success(
        enEdicion ? `Se actualizó "${input.nombre}".` : `Se creó "${input.nombre}".`,
      );
      this.modalAbierto.set(false);
      /**
       * ⚠ Se RECARGA en vez de parchear la fila en local, al revés que en otras pantallas.
       * El motivo: guardar devuelve una `EmpresaFicha`, que NO es la fila del listado —le
       * faltan `corporacion_nombre`, la cadena geográfica y `cantidad_almacenes`, todos
       * resueltos por el servidor—. Meterla tal cual dejaría celdas en blanco.
       */
      this.catalogo.reload();
    } catch {
      // 409 (RUC, nombre o abreviatura duplicados) y 422 (validación): el `error-interceptor`
      // ya mostró el `message` del backend. El modal se queda abierto con lo escrito.
    } finally {
      this.guardando.set(false);
    }
  }

  // ── Eliminación ─────────────────────────────────────────────────────
  /**
   * Borrado de UNA empresa. No hay lote a propósito: contra `basic.empresa` apuntan más de
   * veinte claves foráneas.
   */
  protected async onEliminar(row: Empresa): Promise<void> {
    const aviso =
      row.cantidad_almacenes > 0
        ? ` Tiene ${row.cantidad_almacenes} local(es) asociado(s).`
        : '';

    const ok = await this.confirm.ask({
      title: 'Eliminar empresa',
      message: `¿Eliminar "${row.nombre}"?${aviso} Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      tone: 'danger',
    });
    if (!ok) return;

    try {
      await firstValueFrom(this.api.remove(row.empresaid));
      this.items.update((list) => list.filter((it) => it.empresaid !== row.empresaid));
      this.notify.success(`Se eliminó "${row.nombre}".`);
    } catch {
      // 409 si tiene ventas o series: ya lo notificó el interceptor. Se recarga por si el
      // catálogo cambió por otro lado.
      this.catalogo.reload();
    }
  }

  // ── Exportación ─────────────────────────────────────────────────────
  /** Exporta **lo que se está viendo**, filtros incluidos, generándolo en el navegador. */
  protected onExportar(e: ExportChoice): void {
    const cabeceras = [
      'Orden',
      'ID',
      'RUC',
      'Razón social',
      'Nombre comercial',
      'Abreviatura',
      'Corporación',
      'Dirección',
      'Distrito',
      'Provincia',
      'Departamento',
      'Teléfono',
      'Email',
      'Locales',
      'Estado',
    ];
    const matriz = [
      cabeceras,
      ...this.rows().map((e2) => [
        e2.orden,
        e2.empresaid,
        e2.ruc,
        e2.nombre,
        e2.nombre_comercial,
        e2.abreviatura,
        e2.corporacion_nombre,
        e2.direccion,
        e2.distrito_nombre,
        e2.provincia_nombre,
        e2.departamento_nombre,
        e2.telefono,
        e2.email,
        e2.cantidad_almacenes,
        e2.estado ? 'Activo' : 'Inactivo',
      ]),
    ];

    if (e.formato === 'csv') {
      exportCsv('empresas.csv', matriz);
    } else {
      exportXls('empresas.xls', matriz);
    }
  }
}
