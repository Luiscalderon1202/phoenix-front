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
import { TipMovCajaApi } from '@phoenix/tesoreria/data-access';
import type { PageMeta } from '@phoenix/shared/api';
import {
  TIPMOVCAJA_MAX_ABREVIATURA,
  TIPMOVCAJA_MAX_NOMBRE,
  TIPMOVCAJA_MAX_REQUIERE,
  TIPOS_MOVIMIENTO_CAJA,
  etiquetaTipoMovimientoCaja,
  type TipMovCaja,
  type TipMovCajaInput,
  type TipoMovimientoCaja,
} from '@phoenix/tesoreria/domain';
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
 * Mantenimiento de Tipos de movimiento de caja (`tesoreria.tipmovcaja`).
 *
 * Es la pantalla del bloque que más se sale del molde, y conviene tener presentes las tres
 * diferencias antes de tocarla:
 *
 * - **Los filtros van al SERVIDOR.** Son los tres que manda el legacy (nombre, tipo, estado) y
 *   el backend los resuelve en Go. No los resuelve el stored procedure: su traducción de
 *   `tipo` está rota —espera `E` para los egresos y la tabla guarda `S`—, así que en el legacy
 *   filtrar por egreso no devuelve nada. Aquí sí devuelve.
 * - **No se reordena.** La tabla no tiene columna `orden`; el listado llega por nombre, no hay
 *   columna `#` y la grilla no es arrastrable.
 * - **Hay DOS interruptores por fila.** Además del estado, `requerir_mesanio` se alterna desde
 *   la grilla, porque el legacy le dedica su propia función y también es un toggle.
 *
 * El formulario no ofrece estructura ni las dos cuentas contables: el legacy las tiene
 * comentadas y el backend las conserva solas. Ver el modelo de dominio.
 */
@Component({
  selector: 'erp-tipmovcaja-list-page',
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
  templateUrl: './tipmovcaja-list-page.html',
  styleUrl: './tipmovcaja-list-page.scss',
})
export class TipMovCajaListPage {
  private readonly api = inject(TipMovCajaApi);
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

  /** Cierra la pantalla; sin historia previa sube al índice de tablas básicas. */
  protected onCerrar(): void {
    if (this.hayHistoria) {
      this.location.back();
      return;
    }
    void this.router.navigate(['/mantenimiento/tablas-basicas']);
  }

  protected readonly maxNombre = TIPMOVCAJA_MAX_NOMBRE;
  protected readonly maxAbreviatura = TIPMOVCAJA_MAX_ABREVIATURA;
  protected readonly maxRequiere = TIPMOVCAJA_MAX_REQUIERE;

  /** Opciones del desplegable de tipo, en el filtro y en el formulario. */
  protected readonly tiposMovimiento = TIPOS_MOVIMIENTO_CAJA;
  protected readonly etiquetaTipo = etiquetaTipoMovimientoCaja;

  // ── Filtros (en SERVIDOR) ───────────────────────────────────────────
  protected readonly filters = this.fb.nonNullable.group({
    nombre: '',
    tipo: '', // '' | 'I' | 'S' | 'A'
    estado: '', // '' | 'Y' | 'N'
  });
  private readonly applied = signal(this.filters.getRawValue());

  // ── Datos ───────────────────────────────────────────────────────────
  // El recurso depende de los filtros aplicados: pulsar "Buscar" recarga.
  private readonly catalogo = resource({
    params: () => this.applied(),
    loader: ({ params }) => firstValueFrom(this.api.list(params)),
  });

  /**
   * Lista de trabajo: copia editable del resultado. Permite alternar los dos interruptores de
   * forma optimista sin esperar al backend ni recargar el catálogo entero.
   */
  private readonly items = linkedSignal<TipMovCaja[]>(() => this.catalogo.value() ?? []);
  protected readonly rows = this.items;

  protected readonly loading = this.catalogo.isLoading;
  protected readonly error = computed(() => {
    const e = this.catalogo.error();
    return e instanceof Error
      ? e.message
      : e
        ? 'No se pudo cargar el catálogo de tipos de movimiento de caja.'
        : null;
  });

  protected onApply(): void {
    this.applied.set(this.filters.getRawValue());
    this.page.set(1); // el filtro cambia el universo: la página 3 anterior ya no significa nada
    this.seleccionadas.set([]);
  }

  // ── Paginación (en cliente) ─────────────────────────────────────────
  // El endpoint devuelve el catálogo entero filtrado, sin `meta`: el troceado se hace aquí.
  protected readonly pageSizes = PAGE_SIZES;
  protected readonly page = signal(1);
  protected readonly pageSize = signal(25);

  protected readonly rowsPagina = computed<TipMovCaja[]>(() => {
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
    this.seleccionadas.set([]);
  }

  protected onPageSize(ps: number): void {
    this.pageSize.set(ps);
    this.page.set(1);
    this.seleccionadas.set([]);
  }

  // ── Columnas ────────────────────────────────────────────────────────
  // Sin columna `#`: esta tabla no tiene `orden`. El backend la devuelve por nombre.
  protected readonly columns: GridColumn<TipMovCaja>[] = [
    { key: 'nombre', header: 'Nombre' },
    { key: 'abreviatura', header: 'Abreviatura', width: '130px' },
    { key: 'tipo', header: 'Tipo', width: '110px' },
    { key: 'requiere', header: 'Requiere', width: '150px' },
    { key: 'requerir_mesanio', header: 'Mes/año', width: '110px' },
    { key: 'estado', header: 'Estado', width: '110px' },
  ];

  // ── Los dos interruptores ───────────────────────────────────────────
  /**
   * Alterna el estado de forma optimista y lo revierte si el backend falla.
   *
   * El endpoint es un TOGGLE: no se le manda el valor deseado, pero sí devuelve el resultante.
   */
  protected async onToggleEstado(row: TipMovCaja): Promise<void> {
    this.patchRow(row.tipoid, { estado: !row.estado });
    try {
      const resultado = await firstValueFrom(this.api.alternarEstado(row.tipoid));
      if (typeof resultado?.estado === 'boolean') {
        this.patchRow(row.tipoid, { estado: resultado.estado });
      }
    } catch {
      this.patchRow(row.tipoid, { estado: row.estado });
    }
  }

  /**
   * Alterna `requerir_mesanio`. Mismo patrón que el estado y por el mismo motivo: el legacy le
   * dedica una función aparte y también es un toggle.
   */
  protected async onToggleRequerirMesAnio(row: TipMovCaja): Promise<void> {
    this.patchRow(row.tipoid, { requerir_mesanio: !row.requerir_mesanio });
    try {
      const resultado = await firstValueFrom(this.api.alternarRequerirMesAnio(row.tipoid));
      if (typeof resultado?.requerir_mesanio === 'boolean') {
        this.patchRow(row.tipoid, { requerir_mesanio: resultado.requerir_mesanio });
      }
    } catch {
      this.patchRow(row.tipoid, { requerir_mesanio: row.requerir_mesanio });
    }
  }

  private patchRow(id: number, patch: Partial<TipMovCaja>): void {
    this.items.update((list) => list.map((it) => (it.tipoid === id ? { ...it, ...patch } : it)));
  }

  // ── Selección de filas (borrado en lote) ────────────────────────────
  protected readonly seleccionadas = signal<TipMovCaja[]>([]);

  protected onSeleccion(filas: TipMovCaja[]): void {
    this.seleccionadas.set(filas);
  }

  /** Borrado en lote: UNA petición, no N. El saldo se lee por id. */
  protected async onEliminarSeleccionadas(): Promise<void> {
    const filas = this.seleccionadas();
    if (filas.length === 0) return;

    const ok = await this.confirm.ask({
      title: 'Eliminar tipos de movimiento de caja',
      message: `¿Eliminar ${filas.length} registro(s) seleccionado(s)? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      tone: 'danger',
    });
    if (!ok) return;

    try {
      const resultados = await firstValueFrom(this.api.removeLote(filas.map((f) => f.tipoid)));
      const fallos = resultados.filter((res) => !res.ok);
      const eliminados = resultados.length - fallos.length;

      if (eliminados > 0) {
        const borrados = new Set(resultados.filter((res) => res.ok).map((res) => res.tipoid));
        this.items.update((list) => list.filter((it) => !borrados.has(it.tipoid)));
        this.notify.success(`Se eliminaron ${eliminados} registro(s).`);
      }
      if (fallos.length > 0) {
        const motivos = [...new Set(fallos.map((f) => f.mensaje).filter(Boolean))];
        this.notify.error(
          `${fallos.length} de ${resultados.length} no se pudieron eliminar. ${motivos.join(' ')}`.trim(),
        );
      }
    } catch {
      // Fallo de la petición entera: el `error-interceptor` ya lo notificó.
    }
    this.seleccionadas.set([]);
  }

  // ── Alta y edición ──────────────────────────────────────────────────
  protected readonly modalAbierto = signal(false);
  /** `null` = alta; con valor = edición de ese registro. */
  protected readonly editando = signal<TipMovCaja | null>(null);
  protected readonly guardando = signal(false);

  /**
   * Los cuatro campos que acepta el backend.
   *
   * Ni `estado` ni `requerir_mesanio` —cada uno se alterna desde la grilla— ni `estructura`,
   * `pcgr_general` o `pcgr_empresarial`, que el backend conserva solas: el formulario del
   * legacy las tiene comentadas desde hace tiempo y su ajax las borraba en cada guardado.
   */
  protected readonly form = this.fb.nonNullable.group({
    tipo: ['I' as TipoMovimientoCaja, [Validators.required]],
    nombre: ['', [Validators.required, Validators.maxLength(TIPMOVCAJA_MAX_NOMBRE)]],
    abreviatura: ['', [Validators.maxLength(TIPMOVCAJA_MAX_ABREVIATURA)]],
    requiere: ['', [Validators.maxLength(TIPMOVCAJA_MAX_REQUIERE)]],
  });

  protected readonly tituloModal = computed(() =>
    this.editando() ? 'Editar tipo de movimiento' : 'Nuevo tipo de movimiento',
  );

  protected onNuevo(): void {
    this.editando.set(null);
    this.form.reset({ tipo: 'I', nombre: '', abreviatura: '', requiere: '' });
    this.modalAbierto.set(true);
  }

  protected onEditar(row: TipMovCaja): void {
    this.editando.set(row);
    this.form.reset({
      tipo: row.tipo as TipoMovimientoCaja,
      nombre: row.nombre,
      abreviatura: row.abreviatura,
      requiere: row.requiere,
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

    const input: TipMovCajaInput = this.form.getRawValue();
    const enEdicion = this.editando();
    this.guardando.set(true);

    try {
      if (enEdicion) {
        const actualizado = await firstValueFrom(this.api.update(enEdicion.tipoid, input));
        this.patchRow(enEdicion.tipoid, actualizado);
        this.notify.success(`Se actualizó "${actualizado.nombre}".`);
      } else {
        const creado = await firstValueFrom(this.api.create(input));
        this.items.update((list) => [...list, creado]);
        this.notify.success(`Se creó "${creado.nombre}".`);
      }
      this.modalAbierto.set(false);
    } catch {
      // 409 (nombre duplicado) y 422 (validación): el `error-interceptor` ya lo mostró. El
      // modal se queda abierto con lo escrito para poder corregirlo.
    } finally {
      this.guardando.set(false);
    }
  }

  // ── Eliminación ─────────────────────────────────────────────────────
  protected async onEliminar(row: TipMovCaja): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Eliminar tipo de movimiento',
      message: `¿Eliminar "${row.nombre}"? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      tone: 'danger',
    });
    if (!ok) return;

    try {
      await firstValueFrom(this.api.remove(row.tipoid));
      this.items.update((list) => list.filter((it) => it.tipoid !== row.tipoid));
      this.seleccionadas.update((sel) => sel.filter((s) => s.tipoid !== row.tipoid));
      this.notify.success(`Se eliminó "${row.nombre}".`);
    } catch {
      // 409 si tiene movimientos de caja: ya lo notificó el interceptor. Se recarga por si el
      // catálogo cambió por otro lado.
      this.catalogo.reload();
    }
  }

  // ── Exportación ─────────────────────────────────────────────────────
  /** Exporta a Excel o CSV lo que se está viendo, filtro incluido. */
  protected onExportar(e: ExportChoice): void {
    const cabeceras = [
      'ID',
      'Nombre',
      'Abreviatura',
      'Tipo',
      'Requiere',
      'Mes/año',
      'Estado',
    ];
    const matriz = [
      cabeceras,
      ...this.rows().map((t) => [
        t.tipoid,
        t.nombre,
        t.abreviatura,
        this.etiquetaTipo(t.tipo),
        t.requiere,
        t.requerir_mesanio ? 'Sí' : 'No',
        t.estado ? 'Activo' : 'Inactivo',
      ]),
    ];

    if (e.formato === 'csv') {
      exportCsv('tipos-movimiento-caja.csv', matriz);
    } else {
      exportXls('tipos-movimiento-caja.xls', matriz);
    }
  }
}
