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
import { TipoCanalApi } from '@phoenix/inventarios/data-access';
import type { PageMeta } from '@phoenix/shared/api';
import {
  TIPO_CANAL_MAX_ABREVIATURA,
  TIPO_CANAL_MAX_NOMBRE,
  type TipoCanal,
  type TipoCanalInput,
} from '@phoenix/inventarios/domain';
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
 * Mantenimiento de Canales de atención.
 *
 * CRUD completo en un modal contra `POST`/`PUT`: el stored procedure del legacy resuelve el
 * alta y la edición enteras en una llamada.
 *
 * El catálogo llega COMPLETO en una sola petición (el backend no pagina: la función del
 * legacy devuelve la tabla entera y son unas pocas filas). Por eso el filtro de texto y el
 * de estado se resuelven en CLIENTE: no hay endpoint al que mandarlos, y filtrar aquí es
 * instantáneo sobre datos que ya están en memoria.
 *
 * Sin reporte PDF ni menú Imprimir: el PDF no es estándar en una pantalla de mantenimiento
 * —cuesta un endpoint y una definición de columnas en el backend— y este recurso no lo
 * tiene.
 * La tabla se llama `tipocanal`, pero en el hub de Tablas Básicas del legacy la opción es
 * "Canales de atención": manda el nombre que el usuario lleva años viendo.
 */
@Component({
  selector: 'erp-tipo-canal-list-page',
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
  templateUrl: './tipo-canal-list-page.html',
  styleUrl: './tipo-canal-list-page.scss',
})
export class TipoCanalListPage {
  private readonly api = inject(TipoCanalApi);
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
   * sacaría al usuario FUERA del ERP, así que en ese caso se sube al índice de tablas
   * básicas, que es de donde cuelga esta pantalla.
   */
  protected onCerrar(): void {
    if (this.hayHistoria) {
      this.location.back();
      return;
    }
    void this.router.navigate(['/mantenimiento/tablas-basicas']);
  }

  protected readonly maxAbreviatura = TIPO_CANAL_MAX_ABREVIATURA;
  protected readonly maxNombre = TIPO_CANAL_MAX_NOMBRE;

  // ── Datos ───────────────────────────────────────────────────────────
  private readonly catalogo = resource({
    loader: () => firstValueFrom(this.api.list()),
  });

  /**
   * Lista de trabajo: copia editable del resultado. Permite alternar el estado y reordenar
   * de forma optimista sin esperar al backend ni recargar el catálogo entero.
   */
  private readonly items = linkedSignal<TipoCanal[]>(() => this.catalogo.value() ?? []);

  protected readonly loading = this.catalogo.isLoading;
  protected readonly error = computed(() => {
    const e = this.catalogo.error();
    return e instanceof Error
      ? e.message
      : e
        ? 'No se pudo cargar el catálogo de canales de atención.'
        : null;
  });

  // ── Filtros (en cliente) ────────────────────────────────────────────
  protected readonly filters = this.fb.nonNullable.group({
    q: '',
    estado: '', // '' | 'Y' | 'N'
  });
  private readonly applied = signal(this.filters.getRawValue());

  /**
   * Filas visibles. El orden NUNCA se toca aquí: es el `orden` que manda el backend y el
   * que el usuario reordena arrastrando, así que filtrar no debe reordenar.
   */
  protected readonly rows = computed<TipoCanal[]>(() => {
    const { q, estado } = this.applied();
    const texto = q.trim().toLocaleLowerCase('es');

    return this.items().filter((t) => {
      if (estado === 'Y' && !t.estado) return false;
      if (estado === 'N' && t.estado) return false;
      if (!texto) return true;
      return t.nombre.toLocaleLowerCase('es').includes(texto) || t.abreviatura.toLocaleLowerCase('es').includes(texto);
    });
  });

  // ── Paginación (en cliente) ─────────────────────────────────────────
  // El endpoint devuelve el catálogo entero —la función del legacy no pagina—, así que el
  // troceado se hace aquí. Es real: la grilla pinta solo la página, y el pie dice cuántas hay.
  protected readonly pageSizes = PAGE_SIZES;
  protected readonly page = signal(1);
  protected readonly pageSize = signal(25);

  /** Filas de la página en curso: es lo que se pinta. */
  protected readonly rowsPagina = computed<TipoCanal[]>(() => {
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
   * El arrastre se desactiva con un filtro activo o con la lista paginada: en ambos casos la
   * grilla emitiría solo las filas visibles, y renumerarlas desde 1 machacaría el orden de las
   * que no se ven. Ver `onReorder`.
   */
  protected readonly filtrando = computed(() => {
    const { q, estado } = this.applied();
    return q.trim() !== '' || estado !== '' || this.meta().totalPages > 1;
  });

  protected onApply(): void {
    this.applied.set(this.filters.getRawValue());
    this.page.set(1); // el filtro cambia el universo: la página 3 anterior ya no significa nada
    this.seleccionadas.set([]);
  }

  // ── Columnas ────────────────────────────────────────────────────────
  // Sin `sortable`: el orden de este catálogo es un dato editable (`orden`), no una vista.
  // Dejar ordenar por columna haría que el arrastre guardase un orden que no es el que se
  // está viendo.
  protected readonly columns: GridColumn<TipoCanal>[] = [
    { key: 'orden', header: '#', width: '60px', align: 'right', mono: true },
    { key: 'nombre', header: 'Nombre' },
    { key: 'abreviatura', header: 'Abreviatura', width: '160px' },
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
  protected async onToggleEstado(row: TipoCanal): Promise<void> {
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

  private patchRow(id: number, patch: Partial<TipoCanal>): void {
    this.items.update((list) => list.map((it) => (it.tipoid === id ? { ...it, ...patch } : it)));
  }

  // ── Selección de filas (borrado en lote) ────────────────────────────
  protected readonly seleccionadas = signal<TipoCanal[]>([]);

  protected onSeleccion(filas: TipoCanal[]): void {
    this.seleccionadas.set(filas);
  }

  /**
   * Borrado en lote: UNA petición, no N. El endpoint responde 200 con el resultado por id
   * porque el lote es parcial por diseño —uno puede estar en uso mientras el resto sí se
   * borra—, así que el saldo se lee de las filas.
   */
  protected async onEliminarSeleccionadas(): Promise<void> {
    const filas = this.seleccionadas();
    if (filas.length === 0) return;

    const ok = await this.confirm.ask({
      title: 'Eliminar canales de atención',
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
        // Los motivos se repiten ("tiene registros relacionados"), así que se deduplican en
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
  }

  // ── Reordenamiento ──────────────────────────────────────────────────
  /**
   * Guarda el nuevo orden tras arrastrar una fila.
   *
   * `desde` es la posición 1-based de la primera fila enviada, y el backend calcula
   * `orden = posición + (desde-1)`. Como aquí siempre se manda la lista COMPLETA, `desde`
   * es 1 y la numeración queda 1..n.
   *
   * Por eso el arrastre se desactiva mientras haya un filtro activo: la grilla emitiría
   * solo las filas visibles y renumerarlas desde 1 machacaría el orden de las ocultas.
   */
  protected async onReorder(filas: TipoCanal[]): Promise<void> {
    const previo = this.items();
    // Optimista: se renumera en local para que el `#` cuadre al instante con la posición.
    this.items.set(filas.map((f, i) => ({ ...f, orden: i + 1 })));

    try {
      await firstValueFrom(this.api.reordenar(filas.map((f) => f.tipoid), 1));
    } catch {
      this.items.set(previo);
    }
  }

  // ── Alta y edición ──────────────────────────────────────────────────
  protected readonly modalAbierto = signal(false);
  /** `null` = alta; con valor = edición de ese registro. */
  protected readonly editando = signal<TipoCanal | null>(null);
  protected readonly guardando = signal(false);

  /**
   * Los campos que acepta el backend. Ni `orden` ni `estado`: cada uno tiene su propia
   * acción en la grilla —arrastrar la fila y pulsar su etiqueta de estado— y ésa es su única
   * fuente de verdad.
   */
  protected readonly form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(TIPO_CANAL_MAX_NOMBRE)]],
    abreviatura: ['', [Validators.maxLength(TIPO_CANAL_MAX_ABREVIATURA)]],
  });

  protected readonly tituloModal = computed(() =>
    this.editando() ? 'Editar canal de atención' : 'Nuevo canal de atención',
  );

  protected onNuevo(): void {
    this.editando.set(null);
    this.form.reset({ nombre: '', abreviatura: '' });
    this.modalAbierto.set(true);
  }

  protected onEditar(row: TipoCanal): void {
    this.editando.set(row);
    this.form.reset({
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

    const input: TipoCanalInput = this.form.getRawValue();
    const enEdicion = this.editando();
    this.guardando.set(true);

    try {
      if (enEdicion) {
        const actualizado = await firstValueFrom(this.api.update(enEdicion.tipoid, input));
        this.patchRow(enEdicion.tipoid, actualizado);
        this.notify.success(`Se actualizó "${actualizado.nombre}".`);
      } else {
        const creado = await firstValueFrom(this.api.create(input));
        // Se añade al final de la lista, que es donde el backend lo coloca (orden = último+1).
        this.items.update((list) => [...list, creado]);
        this.notify.success(`Se creó "${creado.nombre}".`);
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
  protected async onEliminar(row: TipoCanal): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Eliminar canal de atención',
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
      // 409 si alguna venta lo usa: ya lo notificó el interceptor. Se recarga por si el
      // catálogo cambió por otro lado.
      this.catalogo.reload();
    }
  }

  // ── Exportación ─────────────────────────────────────────────────────
  /**
   * Exporta a Excel o CSV **lo que se está viendo**, filtro incluido: se genera en el
   * navegador a partir de las filas ya cargadas, sin pedir nada al backend.
   */
  protected onExportar(e: ExportChoice): void {
    const cabeceras = ['Orden', 'ID', 'Nombre', 'Abreviatura', 'Estado'];
    const matriz = [
      cabeceras,
      ...this.rows().map((t) => [
        t.orden,
        t.tipoid,
        t.nombre,
        t.abreviatura,
        t.estado ? 'Activo' : 'Inactivo',
      ]),
    ];

    if (e.formato === 'csv') {
      exportCsv('canales-atencion.csv', matriz);
    } else {
      exportXls('canales-atencion.xls', matriz);
    }
  }
}
