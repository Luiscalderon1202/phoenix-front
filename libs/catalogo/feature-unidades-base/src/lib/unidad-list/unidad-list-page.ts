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
import { UnidadApi } from '@phoenix/catalogo/data-access';
import type { PageMeta } from '@phoenix/shared/api';
import {
  UNIDAD_MAX_ABREVIATURA,
  UNIDAD_MAX_CODIGO_CONTABLE,
  UNIDAD_MAX_CODIGO_INTERNACIONAL,
  UNIDAD_MAX_NOMBRE,
  type Unidad,
  type UnidadInput,
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
 * Mantenimiento de Unidades base (`catalogo.unidad`, pantalla «Unidad Base» del legacy,
 * `Unidad.php`, `menuweb` 92).
 *
 * ⚠ **NO es la pantalla de Unidades de Medida.** `catalogo.unidad` y `catalogo.unidadmedida`
 * son dos tablas distintas, con dos pantallas distintas y dos permisos distintos —`CAT-UNIDAD`
 * aquí, `CAT-UNIDAD-MEDIDA` allí—, y un producto necesita las dos a la vez:
 * `ProductoEdit.php:150-164` pinta los dos selectores lado a lado, la unidad de medida
 * obligatoria y la unidad base opcional. No son sinónimos ni alternativas.
 *
 * Cuatro cosas que conviene tener presentes antes de tocarla:
 *
 * - **SÍ hay interruptor de estado por fila.** Es el único recurso del módulo `catalogo` con
 *   `pa*_cambiar_estado` en la base, y el único cuyo stored procedure audita en `rastro.campo`.
 *   ⚠ Y es la única fuente de verdad del estado: `UnidadEdit.php:45` pinta un switch «ACTIVO»
 *   que **no hace nada**, porque `Acceso.clsUnidad.php` nunca le pasa el estado al stored
 *   procedure —la llamada tiene seis argumentos y ninguno es el estado—. Ese campo se
 *   rellenaba, se enviaba y se descartaba. Aquí sale del formulario y pasa a la grilla.
 * - **El listado del legacy tampoco podía pintar el estado**, aunque la función para moverlo
 *   existiera: `catalogo.type_unidad_leer` no trae la columna. La lectura CON estado la aporta
 *   la migración 0008 (`phoenix.paunidad_leer`).
 * - **No hay orden ni arrastre.** La tabla no tiene columna `orden`: sin columna `#`, sin
 *   `PATCH /orden` y con la grilla no reordenable. Siete endpoints, no ocho.
 * - **Los filtros van al SERVIDOR** y la paginación se queda en CLIENTE: el endpoint devuelve
 *   el catálogo entero ya filtrado, sin `meta`.
 *
 * Sin reporte PDF ni menú Imprimir: el PDF no es estándar en una pantalla de mantenimiento y
 * este recurso no lo tiene.
 */
@Component({
  selector: 'erp-unidad-list-page',
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
  templateUrl: './unidad-list-page.html',
  styleUrl: './unidad-list-page.scss',
})
export class UnidadListPage {
  private readonly api = inject(UnidadApi);
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
   * ⚠ **No** al índice de tablas básicas: esta pantalla no cuelga de ese hub —es una opción de
   * menú propia bajo «Catálogo»— y llevar allí al usuario le mentiría sobre dónde estaba.
   */
  protected onCerrar(): void {
    if (this.hayHistoria) {
      this.location.back();
      return;
    }
    void this.router.navigate(['/inicio']);
  }

  protected readonly maxNombre = UNIDAD_MAX_NOMBRE;
  protected readonly maxAbreviatura = UNIDAD_MAX_ABREVIATURA;
  protected readonly maxCodigoContable = UNIDAD_MAX_CODIGO_CONTABLE;
  protected readonly maxCodigoInternacional = UNIDAD_MAX_CODIGO_INTERNACIONAL;

  // ── Filtros (en SERVIDOR) ───────────────────────────────────────────
  // Dos: el texto libre, que el stored procedure resuelve con `public.buscar()`, y el alcance
  // por estado. Pulsar "Buscar" recarga el recurso; no se filtra en memoria.
  protected readonly filters = this.fb.nonNullable.group({
    q: '',
    alcance: 'activas', // 'activas' | 'inactivas' | 'todas'
  });
  private readonly applied = signal(this.filters.getRawValue());

  // ── Datos ───────────────────────────────────────────────────────────
  private readonly catalogo = resource({
    params: () => this.applied(),
    loader: async ({ params }) => {
      const filas = await firstValueFrom(
        this.api.list({ q: params.q, incluir_inactivas: params.alcance !== 'activas' }),
      );
      // ⚠ HÍBRIDO a propósito: «Sólo inactivas» no existe en el backend —`incluir_inactivas`
      // es un ensancha-alcance, no un selector—, así que se piden TODAS y se descartan aquí
      // las activas. Es el único filtro de esta pantalla que no lo resuelve el servidor, y se
      // puede permitir porque el endpoint ya devuelve el catálogo entero.
      return params.alcance === 'inactivas' ? filas.filter((u) => !u.estado) : filas;
    },
  });

  /**
   * Lista de trabajo: copia editable del resultado. Permite alternar el estado de forma
   * optimista sin esperar al backend ni recargar el catálogo entero.
   */
  private readonly items = linkedSignal<Unidad[]>(() => this.catalogo.value() ?? []);
  protected readonly rows = this.items;

  protected readonly loading = this.catalogo.isLoading;
  protected readonly error = computed(() => {
    const e = this.catalogo.error();
    return e instanceof Error
      ? e.message
      : e
        ? 'No se pudo cargar el catálogo de unidades base.'
        : null;
  });

  protected onApply(): void {
    this.applied.set(this.filters.getRawValue());
    this.page.set(1); // el filtro cambia el universo: la página 3 anterior ya no significa nada
    this.seleccionadas.set([]);
  }

  // ── Paginación (en cliente) ─────────────────────────────────────────
  // El endpoint devuelve el catálogo entero ya filtrado y sin `meta`: el troceado se hace aquí.
  // Es real: la grilla pinta sólo la página, y el pie dice cuántas hay.
  protected readonly pageSizes = PAGE_SIZES;
  protected readonly page = signal(1);
  protected readonly pageSize = signal(25);

  /** Filas de la página en curso: es lo que se pinta. */
  protected readonly rowsPagina = computed<Unidad[]>(() => {
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
  // Sin columna `#`: esta tabla no tiene `orden`. El backend la devuelve por nombre.
  protected readonly columns: GridColumn<Unidad>[] = [
    { key: 'nombre', header: 'Nombre' },
    { key: 'abreviatura', header: 'Abreviatura', width: '150px' },
    { key: 'codigo_contable', header: 'ID contable', width: '140px', mono: true },
    { key: 'codigo_internacional', header: 'ID internacional', width: '160px', mono: true },
    { key: 'estado', header: 'Estado', width: '110px' },
  ];

  // ── Estado ──────────────────────────────────────────────────────────
  /**
   * Alterna el estado de forma optimista y lo revierte si el backend falla (el
   * `error-interceptor` ya notificó el motivo).
   *
   * El endpoint es un TOGGLE: no se le manda el valor deseado. Pero sí devuelve el estado
   * resultante, así que al confirmar se pinta lo que dice el backend — si otro usuario lo
   * cambió entre medias, la fila queda correcta.
   */
  protected async onToggleEstado(row: Unidad): Promise<void> {
    this.patchRow(row.unidadid, { estado: !row.estado });
    try {
      const resultado = await firstValueFrom(this.api.alternarEstado(row.unidadid));
      if (typeof resultado?.estado === 'boolean') {
        this.patchRow(row.unidadid, { estado: resultado.estado });
      }
    } catch {
      this.patchRow(row.unidadid, { estado: row.estado });
    }
  }

  private patchRow(id: number, patch: Partial<Unidad>): void {
    this.items.update((list) => list.map((it) => (it.unidadid === id ? { ...it, ...patch } : it)));
  }

  // ── Selección de filas (borrado en lote) ────────────────────────────
  protected readonly seleccionadas = signal<Unidad[]>([]);

  protected onSeleccion(filas: Unidad[]): void {
    this.seleccionadas.set(filas);
  }

  /**
   * Borrado en lote: UNA petición, no N. El endpoint responde 200 con el resultado por id
   * porque el lote es parcial por diseño —una unidad puede estar en uso en un producto o en
   * una guía mientras el resto sí se borra—, así que el saldo se lee de las filas.
   */
  protected async onEliminarSeleccionadas(): Promise<void> {
    const filas = this.seleccionadas();
    if (filas.length === 0) return;

    const ok = await this.confirm.ask({
      title: 'Eliminar unidades base',
      message: `¿Eliminar ${filas.length} registro(s) seleccionado(s)? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      tone: 'danger',
    });
    if (!ok) return;

    try {
      const resultados = await firstValueFrom(this.api.removeLote(filas.map((f) => f.unidadid)));
      const fallos = resultados.filter((res) => !res.ok);
      const eliminados = resultados.length - fallos.length;

      if (eliminados > 0) {
        const borrados = new Set(resultados.filter((res) => res.ok).map((res) => res.unidadid));
        this.items.update((list) => list.filter((it) => !borrados.has(it.unidadid)));
        this.notify.success(`Se eliminaron ${eliminados} registro(s).`);
      }
      if (fallos.length > 0) {
        // Los motivos se repiten ("tiene productos o guías relacionados"), así que se
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

  // ── Alta y edición ──────────────────────────────────────────────────
  protected readonly modalAbierto = signal(false);
  /** `null` = alta; con valor = edición de ese registro. */
  protected readonly editando = signal<Unidad | null>(null);
  protected readonly guardando = signal(false);

  /**
   * Los cuatro campos que acepta el backend. Sin `estado`: tiene su propia acción en la grilla
   * y ésa es su única fuente de verdad. (Y el switch «ACTIVO» del formulario del legacy nunca
   * llegó al stored procedure; ver la cabecera.)
   */
  protected readonly form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(UNIDAD_MAX_NOMBRE)]],
    abreviatura: ['', [Validators.maxLength(UNIDAD_MAX_ABREVIATURA)]],
    codigo_contable: ['', [Validators.maxLength(UNIDAD_MAX_CODIGO_CONTABLE)]],
    codigo_internacional: ['', [Validators.maxLength(UNIDAD_MAX_CODIGO_INTERNACIONAL)]],
  });

  protected readonly tituloModal = computed(() =>
    this.editando() ? 'Editar unidad base' : 'Nueva unidad base',
  );

  protected onNuevo(): void {
    this.editando.set(null);
    this.form.reset({ nombre: '', abreviatura: '', codigo_contable: '', codigo_internacional: '' });
    this.modalAbierto.set(true);
  }

  protected onEditar(row: Unidad): void {
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

    const input: UnidadInput = this.form.getRawValue();
    const enEdicion = this.editando();
    this.guardando.set(true);

    try {
      if (enEdicion) {
        const actualizado = await firstValueFrom(this.api.update(enEdicion.unidadid, input));
        this.patchRow(enEdicion.unidadid, actualizado);
        this.notify.success(`Se actualizó "${actualizado.nombre}".`);
      } else {
        const creado = await firstValueFrom(this.api.create(input));
        this.items.update((list) => [...list, creado]);
        this.notify.success(`Se creó "${creado.nombre}".`);
      }
      this.modalAbierto.set(false);
    } catch {
      // 409 (nombre duplicado) y 422 (validación): el `error-interceptor` ya mostró el
      // `message` del backend, que en 4xx es seguro. El modal se queda abierto con lo escrito
      // para poder corregirlo.
    } finally {
      this.guardando.set(false);
    }
  }

  // ── Eliminación ─────────────────────────────────────────────────────
  protected async onEliminar(row: Unidad): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Eliminar unidad base',
      message: `¿Eliminar "${row.nombre}"? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      tone: 'danger',
    });
    if (!ok) return;

    try {
      await firstValueFrom(this.api.remove(row.unidadid));
      this.items.update((list) => list.filter((it) => it.unidadid !== row.unidadid));
      this.seleccionadas.update((sel) => sel.filter((s) => s.unidadid !== row.unidadid));
      this.notify.success(`Se eliminó "${row.nombre}".`);
    } catch {
      // 409 si algún producto o alguna guía la usa: ya lo notificó el interceptor. Se recarga
      // por si el catálogo cambió por otro lado.
      this.catalogo.reload();
    }
  }

  // ── Exportación ─────────────────────────────────────────────────────
  /**
   * Exporta a Excel o CSV **lo que se está viendo**, filtro incluido: se genera en el
   * navegador a partir de las filas ya cargadas, sin pedir nada al backend.
   */
  protected onExportar(e: ExportChoice): void {
    const cabeceras = ['ID', 'Nombre', 'Abreviatura', 'ID contable', 'ID internacional', 'Estado'];
    const matriz = [
      cabeceras,
      ...this.rows().map((u) => [
        u.unidadid,
        u.nombre,
        u.abreviatura,
        u.codigo_contable,
        u.codigo_internacional,
        u.estado ? 'Activo' : 'Inactivo',
      ]),
    ];

    if (e.formato === 'csv') {
      exportCsv('unidades-base.csv', matriz);
    } else {
      exportXls('unidades-base.xls', matriz);
    }
  }
}
