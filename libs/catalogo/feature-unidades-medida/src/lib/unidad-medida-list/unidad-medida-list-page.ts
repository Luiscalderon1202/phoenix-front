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
import { UnidadMedidaApi } from '@phoenix/catalogo/data-access';
import type { PageMeta } from '@phoenix/shared/api';
import {
  UNIDAD_MEDIDA_MAX_ABREVIATURA,
  UNIDAD_MEDIDA_MAX_CODIGO_CONTABLE,
  UNIDAD_MEDIDA_MAX_CODIGO_INTERNACIONAL,
  UNIDAD_MEDIDA_MAX_NOMBRE,
  type UnidadMedida,
  type UnidadMedidaInput,
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
 * Mantenimiento de Unidades de medida (`catalogo.unidadmedida`).
 *
 * ⚠ **El interruptor de estado y el arrastre para reordenar NO existían.** Los aporta la
 * migración 0008 de Phoenix, y son el motivo de que esta pantalla exista tal cual:
 *
 * - `estado` y `orden` están en la tabla desde siempre, pero ninguna función del legacy sabía
 *   escribirlos —`paunidadmedida_actualizar` hace un insert posicional de cinco valores sobre
 *   siete columnas— y `paunidadmedida_leer` filtraba `estado=true` A FUEGO.
 * - En producción **17 de 27 unidades están inactivas y eran invisibles**, sin manera de
 *   reactivarlas desde la aplicación. Una de ellas, BALDE, está inactiva **y en uso** por 2
 *   productos y 2 líneas de pedido.
 * - Las ramas `change_status` y `change_order` del PHP llamaban a funciones que no existen en la
 *   base; nunca llegaban a ejecutarse porque su selector de la celda tampoco casaba. Código
 *   muerto en tres capas a la vez. La 0008 no las revive: pone funciones nuevas en el esquema
 *   `phoenix`, así que el legacy sigue igual de roto y igual de inofensivo.
 *
 * De ahí que ésta sea la ÚNICA de las cinco pantallas del catálogo con columna `#`, interruptor
 * de estado por fila y filas arrastrables.
 *
 * Otras dos diferencias frente al molde de Condiciones de pago:
 *
 * - **Los filtros van al SERVIDOR** (`phoenix.paunidadmedida_leer` los recibe y los aplica).
 *   Filtrar aquí sería reimplementar `public.buscar()`, que normaliza tildes con dos erratas
 *   conocidas; mejor heredar la comparación que hace el resto del sistema.
 * - **La paginación sigue siendo de CLIENTE**: el endpoint filtra pero NO pagina, devuelve el
 *   catálogo entero y sin `meta`. Filtro en servidor y paginación en cliente no son lo mismo.
 *
 * Y esta pantalla NO cuelga del hub de Tablas Básicas —es una opción de menú propia, `menuweb`
 * 74, con su propio proceso `CAT-UNIDAD-MEDIDA`—, así que cerrar vuelve a `/inicio`.
 */
@Component({
  selector: 'erp-unidad-medida-list-page',
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
  templateUrl: './unidad-medida-list-page.html',
  styleUrl: './unidad-medida-list-page.scss',
})
export class UnidadMedidaListPage {
  private readonly api = inject(UnidadMedidaApi);
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
   * sacaría al usuario FUERA del ERP.
   *
   * ⚠ Y el destino de reserva es `/inicio`, NO el índice de tablas básicas: esta pantalla no
   * cuelga de ese hub, es una opción de menú propia bajo «Catalogo».
   */
  protected onCerrar(): void {
    if (this.hayHistoria) {
      this.location.back();
      return;
    }
    void this.router.navigate(['/inicio']);
  }

  protected readonly maxNombre = UNIDAD_MEDIDA_MAX_NOMBRE;
  protected readonly maxAbreviatura = UNIDAD_MEDIDA_MAX_ABREVIATURA;
  protected readonly maxCodigoContable = UNIDAD_MEDIDA_MAX_CODIGO_CONTABLE;
  protected readonly maxCodigoInternacional = UNIDAD_MEDIDA_MAX_CODIGO_INTERNACIONAL;

  // ── Filtros (en SERVIDOR) ───────────────────────────────────────────
  /**
   * `estado` NO es un parámetro del endpoint: es la forma que toma en la UI el único
   * interruptor que el backend entiende, `incluir_inactivas`. Ver el `loader`.
   */
  protected readonly filters = this.fb.nonNullable.group({
    q: '',
    estado: 'activas', // 'activas' | 'todas' | 'inactivas'
  });
  private readonly applied = signal(this.filters.getRawValue());

  // ── Datos ───────────────────────────────────────────────────────────
  // El recurso depende de los filtros aplicados: pulsar "Buscar" recarga.
  private readonly catalogo = resource({
    params: () => this.applied(),
    loader: async ({ params }) => {
      const lista = await firstValueFrom(
        this.api.list({ q: params.q, incluir_inactivas: params.estado !== 'activas' }),
      );
      // ⚠ HÍBRIDO A PROPÓSITO: el backend sabe devolver «solo activas» (el default del legacy) y
      // «todas», pero NO «solo inactivas» — `phoenix.paunidadmedida_leer` tiene un booleano, no
      // tres estados. Y esa tercera vista es justo la que hace falta aquí: es la que enseña las
      // 17 unidades que llevaban años escondidas. Así que se piden todas y se descartan las
      // activas en cliente. Si algún día el SP acepta un tri-estado, esta línea se borra.
      return params.estado === 'inactivas' ? lista.filter((u) => !u.estado) : lista;
    },
  });

  /**
   * Lista de trabajo: copia editable del resultado. Permite alternar el estado y reordenar de
   * forma optimista sin esperar al backend ni recargar el catálogo entero.
   *
   * Como el filtro es de servidor, las mutaciones se aplican AQUÍ y el `resource` solo se
   * recarga cuando algo falla: recargarlo tras cada alta o borrado dispararía una petición y
   * haría parpadear la lista entera.
   */
  private readonly items = linkedSignal<UnidadMedida[]>(() => this.catalogo.value() ?? []);

  /** Las filas ya vienen filtradas del servidor: aquí no se vuelve a filtrar. */
  protected readonly rows = this.items;

  protected readonly loading = this.catalogo.isLoading;
  protected readonly error = computed(() => {
    const e = this.catalogo.error();
    return e instanceof Error
      ? e.message
      : e
        ? 'No se pudo cargar el catálogo de unidades de medida.'
        : null;
  });

  protected onApply(): void {
    this.applied.set(this.filters.getRawValue());
    this.page.set(1); // el filtro cambia el universo: la página 3 anterior ya no significa nada
    this.seleccionadas.set([]);
  }

  // ── Paginación (en cliente) ─────────────────────────────────────────
  // El endpoint FILTRA pero no PAGINA: devuelve el catálogo entero, sin `meta`. El troceado se
  // hace aquí. Es real: la grilla pinta solo la página, y el pie dice cuántas hay.
  protected readonly pageSizes = PAGE_SIZES;
  protected readonly page = signal(1);
  protected readonly pageSize = signal(25);

  /** Filas de la página en curso: es lo que se pinta. */
  protected readonly rowsPagina = computed<UnidadMedida[]>(() => {
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

  /**
   * El arrastre solo se enciende cuando lo que se ve ES el catálogo entero: sin texto buscado,
   * con el estado en «Todas» y en una sola página. En cualquier otro caso la grilla emitiría
   * solo las filas visibles, y renumerarlas desde 1 machacaría el `orden` de las que no se ven.
   *
   * ⚠ Por eso el estado por defecto —«Activas»— también apaga el arrastre: es un filtro, aunque
   * sea el que trae puesto la pantalla. Reordenar viendo solo las activas dejaría las 17
   * inactivas intercaladas donde el azar quisiera. Ver `onReorder`.
   */
  protected readonly filtrando = computed(() => {
    const { q, estado } = this.applied();
    return q.trim() !== '' || estado !== 'todas' || this.meta().totalPages > 1;
  });

  // ── Columnas ────────────────────────────────────────────────────────
  // Sin `sortable`: el orden de este catálogo es un dato editable (`orden`), no una vista. Dejar
  // ordenar por columna haría que el arrastre guardase un orden que no es el que se está viendo.
  protected readonly columns: GridColumn<UnidadMedida>[] = [
    { key: 'orden', header: '#', width: '60px', align: 'right', mono: true },
    { key: 'nombre', header: 'Nombre' },
    { key: 'abreviatura', header: 'Abreviatura', width: '140px' },
    { key: 'codigo_contable', header: 'ID contable', width: '120px', mono: true },
    { key: 'codigo_internacional', header: 'ID internacional', width: '150px', mono: true },
    { key: 'estado', header: 'Estado', width: '110px' },
  ];

  // ── Estado ──────────────────────────────────────────────────────────
  /**
   * Alterna el estado de forma optimista y lo revierte si el backend falla (el
   * `error-interceptor` ya notificó el motivo).
   *
   * El endpoint es un TOGGLE: no se le manda el valor deseado. Pero sí devuelve el estado
   * resultante, así que al confirmar se pinta lo que dice el backend — si otro usuario lo cambió
   * entre medias, la fila queda correcta.
   *
   * La fila NO desaparece aunque deje de cumplir el filtro aplicado: el filtro es de servidor y
   * se resuelve al buscar, no a cada cambio. Reactivar una unidad y verla saltar de la lista al
   * instante sería peor que dejarla a la vista hasta la próxima búsqueda.
   */
  protected async onToggleEstado(row: UnidadMedida): Promise<void> {
    this.patchRow(row.unidadmedidaid, { estado: !row.estado });
    try {
      const resultado = await firstValueFrom(this.api.alternarEstado(row.unidadmedidaid));
      if (typeof resultado?.estado === 'boolean') {
        this.patchRow(row.unidadmedidaid, { estado: resultado.estado });
      }
    } catch {
      this.patchRow(row.unidadmedidaid, { estado: row.estado });
    }
  }

  private patchRow(id: number, patch: Partial<UnidadMedida>): void {
    this.items.update((list) =>
      list.map((it) => (it.unidadmedidaid === id ? { ...it, ...patch } : it)),
    );
  }

  // ── Selección de filas (borrado en lote) ────────────────────────────
  protected readonly seleccionadas = signal<UnidadMedida[]>([]);

  protected onSeleccion(filas: UnidadMedida[]): void {
    this.seleccionadas.set(filas);
  }

  /**
   * Borrado en lote: UNA petición, no N. El endpoint responde 200 con el resultado por id porque
   * el lote es parcial por diseño —una unidad en uso falla mientras el resto sí se borra—, así
   * que el saldo se lee de las filas.
   */
  protected async onEliminarSeleccionadas(): Promise<void> {
    const filas = this.seleccionadas();
    if (filas.length === 0) return;

    const ok = await this.confirm.ask({
      title: 'Eliminar unidades de medida',
      message: `¿Eliminar ${filas.length} registro(s) seleccionado(s)? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      tone: 'danger',
    });
    if (!ok) return;

    try {
      const resultados = await firstValueFrom(
        this.api.removeLote(filas.map((f) => f.unidadmedidaid)),
      );
      const fallos = resultados.filter((res) => !res.ok);
      const eliminados = resultados.length - fallos.length;

      if (eliminados > 0) {
        const borrados = new Set(
          resultados.filter((res) => res.ok).map((res) => res.unidadmedidaid),
        );
        this.items.update((list) => list.filter((it) => !borrados.has(it.unidadmedidaid)));
        this.notify.success(`Se eliminaron ${eliminados} registro(s).`);
      }
      if (fallos.length > 0) {
        // Los motivos se repiten ("tiene productos o pedidos relacionados"), así que se
        // deduplican en vez de sacar un toast por fila.
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

  // ── Reordenamiento ──────────────────────────────────────────────────
  /**
   * Guarda el nuevo orden tras arrastrar una fila.
   *
   * `desde` es la posición 1-based de la primera fila enviada, y el backend calcula
   * `orden = posición + (desde-1)`. Como aquí siempre se manda la lista COMPLETA, `desde` es 1 y
   * la numeración queda 1..n.
   *
   * Por eso el arrastre se apaga con cualquier filtro puesto —incluido el de «Activas» que trae
   * la pantalla— y con la lista repartida en varias páginas: la grilla emitiría solo las filas
   * visibles. Ver `filtrando`.
   */
  protected async onReorder(filas: UnidadMedida[]): Promise<void> {
    const previo = this.items();
    // Optimista: se renumera en local para que el `#` cuadre al instante con la posición.
    this.items.set(filas.map((f, i) => ({ ...f, orden: i + 1 })));

    try {
      await firstValueFrom(
        this.api.reordenar(
          filas.map((f) => f.unidadmedidaid),
          1,
        ),
      );
    } catch {
      this.items.set(previo);
    }
  }

  // ── Alta y edición ──────────────────────────────────────────────────
  protected readonly modalAbierto = signal(false);
  /** `null` = alta; con valor = edición de ese registro. */
  protected readonly editando = signal<UnidadMedida | null>(null);
  protected readonly guardando = signal(false);

  /**
   * Los cuatro campos que acepta el backend. Ni `estado` ni `orden`: cada uno tiene su propia
   * acción en la grilla —pulsar su etiqueta de estado y arrastrar la fila— y ésa es su única
   * fuente de verdad. El stored procedure tampoco los recibe.
   *
   * Los `maxlength` salen de la COLUMNA: el formulario del legacy declara 20 para la abreviatura
   * (`varchar(10)`) y para el código contable (`varchar(2)`).
   */
  protected readonly form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(UNIDAD_MEDIDA_MAX_NOMBRE)]],
    abreviatura: ['', [Validators.maxLength(UNIDAD_MEDIDA_MAX_ABREVIATURA)]],
    codigo_contable: ['', [Validators.maxLength(UNIDAD_MEDIDA_MAX_CODIGO_CONTABLE)]],
    codigo_internacional: ['', [Validators.maxLength(UNIDAD_MEDIDA_MAX_CODIGO_INTERNACIONAL)]],
  });

  protected readonly tituloModal = computed(() =>
    this.editando() ? 'Editar unidad de medida' : 'Nueva unidad de medida',
  );

  protected onNuevo(): void {
    this.editando.set(null);
    this.form.reset({ nombre: '', abreviatura: '', codigo_contable: '', codigo_internacional: '' });
    this.modalAbierto.set(true);
  }

  protected onEditar(row: UnidadMedida): void {
    this.editando.set(row);
    this.form.reset({
      nombre: row.nombre,
      abreviatura: row.abreviatura,
      codigo_contable: row.codigo_contable,
      codigo_internacional: row.codigo_internacional,
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

    const input: UnidadMedidaInput = this.form.getRawValue();
    const enEdicion = this.editando();
    this.guardando.set(true);

    try {
      if (enEdicion) {
        const actualizado = await firstValueFrom(this.api.update(enEdicion.unidadmedidaid, input));
        this.patchRow(enEdicion.unidadmedidaid, actualizado);
        this.notify.success(`Se actualizó "${actualizado.nombre}".`);
      } else {
        const creado = await firstValueFrom(this.api.create(input));
        // Se añade al final de la lista, que es donde el backend lo coloca (orden = último+1).
        // Se añade SIN recargar el recurso: el alta nace activa, así que solo desentonaría con
        // el filtro «Solo inactivas», y aun ahí es mejor que el usuario vea lo que acaba de
        // crear que no que desaparezca sin explicación.
        this.items.update((list) => [...list, creado]);
        this.notify.success(`Se creó "${creado.nombre}".`);
      }
      this.modalAbierto.set(false);
    } catch {
      // 409 (nombre duplicado) y 422 (validación): el `error-interceptor` ya mostró el `message`
      // del backend, que en 4xx es seguro. El modal se queda abierto con lo escrito para poder
      // corregirlo.
    } finally {
      this.guardando.set(false);
    }
  }

  // ── Eliminación ─────────────────────────────────────────────────────
  protected async onEliminar(row: UnidadMedida): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Eliminar unidad de medida',
      message: `¿Eliminar "${row.nombre}"? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      tone: 'danger',
    });
    if (!ok) return;

    try {
      await firstValueFrom(this.api.remove(row.unidadmedidaid));
      this.items.update((list) => list.filter((it) => it.unidadmedidaid !== row.unidadmedidaid));
      this.seleccionadas.update((sel) =>
        sel.filter((s) => s.unidadmedidaid !== row.unidadmedidaid),
      );
      this.notify.success(`Se eliminó "${row.nombre}".`);
    } catch {
      // 409 si algún producto o alguna línea de pedido la usa: ya lo notificó el interceptor. Se
      // recarga —con el filtro aplicado, no sin él— por si el catálogo cambió por otro lado.
      this.catalogo.reload();
    }
  }

  // ── Exportación ─────────────────────────────────────────────────────
  /**
   * Exporta a Excel o CSV **lo que se está viendo**, filtro incluido: se genera en el navegador
   * a partir de las filas ya cargadas, sin pedir nada al backend.
   */
  protected onExportar(e: ExportChoice): void {
    const cabeceras = [
      'Orden',
      'ID',
      'Nombre',
      'Abreviatura',
      'ID contable',
      'ID internacional',
      'Estado',
    ];
    const matriz = [
      cabeceras,
      ...this.rows().map((u) => [
        u.orden,
        u.unidadmedidaid,
        u.nombre,
        u.abreviatura,
        u.codigo_contable,
        u.codigo_internacional,
        u.estado ? 'Activa' : 'Inactiva',
      ]),
    ];

    if (e.formato === 'csv') {
      exportCsv('unidades-medida.csv', matriz);
    } else {
      exportXls('unidades-medida.xls', matriz);
    }
  }
}
