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
import { MotivoNotasApi } from '@phoenix/inventarios/data-access';
import type { PageMeta } from '@phoenix/shared/api';
import {
  MOTIVO_NOTAS_MAX_ABREVIATURA,
  MOTIVO_NOTAS_MAX_CODIGO_CONTABLE,
  MOTIVO_NOTAS_MAX_NOMBRE,
  TIPOS_NOTA,
  etiquetaTipoNota,
  type TipoNota,
  type MotivoNotas,
  type MotivoNotasInput,
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
 * Mantenimiento de Motivos de notas.
 *
 * CRUD completo en un modal contra `POST`/`PUT`: el stored procedure del legacy resuelve el
 * alta y la edición enteras en una llamada.
 *
 * El catálogo llega COMPLETO en una sola petición (el backend no pagina: la función del
 * legacy devuelve la tabla entera y son unas pocas filas). Por eso los filtros se resuelven
 * en CLIENTE: no hay endpoint al que mandarlos, y filtrar aquí es instantáneo sobre datos que
 * ya están en memoria.
 *
 * Sin reporte PDF ni menú Imprimir: el PDF no es estándar en una pantalla de mantenimiento
 * —cuesta un endpoint y una definición de columnas en el backend— y este recurso no lo
 * tiene.
 * ⚠ Este catálogo está partido en dos por la columna `tipo` —crédito y débito— y el endpoint
 * devuelve las dos mitades juntas, ordenadas por tipo. La pantalla añade por eso un filtro de
 * tipo, y arrastrar para reordenar se apaga en cuanto se usa: la grilla emitiría solo las
 * filas visibles y renumerarlas machacaría el orden de la otra mitad.
 */
@Component({
  selector: 'erp-motivo-notas-list-page',
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
  templateUrl: './motivo-notas-list-page.html',
  styleUrl: './motivo-notas-list-page.scss',
})
export class MotivoNotasListPage {
  private readonly api = inject(MotivoNotasApi);
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

  protected readonly maxAbreviatura = MOTIVO_NOTAS_MAX_ABREVIATURA;
  protected readonly maxCodigoContable = MOTIVO_NOTAS_MAX_CODIGO_CONTABLE;
  protected readonly maxNombre = MOTIVO_NOTAS_MAX_NOMBRE;

  /** Opciones del desplegable de tipo, en el filtro y en el formulario. */
  protected readonly tiposNota = TIPOS_NOTA;
  protected readonly etiquetaTipo = etiquetaTipoNota;

  // ── Datos ───────────────────────────────────────────────────────────
  private readonly catalogo = resource({
    loader: () => firstValueFrom(this.api.list()),
  });

  /**
   * Lista de trabajo: copia editable del resultado. Permite alternar el estado y reordenar
   * de forma optimista sin esperar al backend ni recargar el catálogo entero.
   */
  private readonly items = linkedSignal<MotivoNotas[]>(() => this.catalogo.value() ?? []);

  protected readonly loading = this.catalogo.isLoading;
  protected readonly error = computed(() => {
    const e = this.catalogo.error();
    return e instanceof Error
      ? e.message
      : e
        ? 'No se pudo cargar el catálogo de motivos de notas.'
        : null;
  });

  // ── Filtros (en cliente) ────────────────────────────────────────────
  protected readonly filters = this.fb.nonNullable.group({
    q: '',
    estado: '', // '' | 'Y' | 'N'
    tipo: '', // '' | 'C' | 'D'
  });
  private readonly applied = signal(this.filters.getRawValue());

  /**
   * Filas visibles. El orden NUNCA se toca aquí: es el `orden` que manda el backend y el
   * que el usuario reordena arrastrando, así que filtrar no debe reordenar.
   */
  protected readonly rows = computed<MotivoNotas[]>(() => {
    const { q, estado, tipo } = this.applied();
    const texto = q.trim().toLocaleLowerCase('es');

    return this.items().filter((t) => {
      if (estado === 'Y' && !t.estado) return false;
      if (estado === 'N' && t.estado) return false;
      if (tipo && t.tipo !== tipo) return false;
      if (!texto) return true;
      return t.nombre.toLocaleLowerCase('es').includes(texto) || t.abreviatura.toLocaleLowerCase('es').includes(texto) || t.codigo_contable.toLocaleLowerCase('es').includes(texto);
    });
  });

  // ── Paginación (en cliente) ─────────────────────────────────────────
  // El endpoint devuelve el catálogo entero —la función del legacy no pagina—, así que el
  // troceado se hace aquí. Es real: la grilla pinta solo la página, y el pie dice cuántas hay.
  protected readonly pageSizes = PAGE_SIZES;
  protected readonly page = signal(1);
  protected readonly pageSize = signal(25);

  /** Filas de la página en curso: es lo que se pinta. */
  protected readonly rowsPagina = computed<MotivoNotas[]>(() => {
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
    const { q, estado, tipo } = this.applied();
    return q.trim() !== '' || estado !== '' || tipo !== '' || this.meta().totalPages > 1;
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
  protected readonly columns: GridColumn<MotivoNotas>[] = [
    { key: 'orden', header: '#', width: '60px', align: 'right', mono: true },
    { key: 'tipo', header: 'Tipo', width: '150px' },
    { key: 'nombre', header: 'Nombre' },
    { key: 'abreviatura', header: 'Abreviatura', width: '150px' },
    { key: 'codigo_contable', header: 'Código', width: '110px' },
    { key: 'afectastock', header: 'Afecta stock', width: '130px' },
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
  protected async onToggleEstado(row: MotivoNotas): Promise<void> {
    this.patchRow(row.motivoid, { estado: !row.estado });
    try {
      const resultado = await firstValueFrom(this.api.alternarEstado(row.motivoid));
      if (typeof resultado?.estado === 'boolean') {
        this.patchRow(row.motivoid, { estado: resultado.estado });
      }
    } catch {
      this.patchRow(row.motivoid, { estado: row.estado });
    }
  }

  private patchRow(id: number, patch: Partial<MotivoNotas>): void {
    this.items.update((list) => list.map((it) => (it.motivoid === id ? { ...it, ...patch } : it)));
  }

  // ── Selección de filas (borrado en lote) ────────────────────────────
  protected readonly seleccionadas = signal<MotivoNotas[]>([]);

  protected onSeleccion(filas: MotivoNotas[]): void {
    this.seleccionadas.set(filas);
  }

  /**
   * Borrado en lote: UNA petición, no N. El endpoint responde 200 con el resultado por id
   * porque el lote es parcial por diseño —uno puede fallar mientras el resto sí se borra—,
   * así que el saldo se lee de las filas.
   */
  protected async onEliminarSeleccionadas(): Promise<void> {
    const filas = this.seleccionadas();
    if (filas.length === 0) return;

    const ok = await this.confirm.ask({
      title: 'Eliminar motivos de notas',
      message: `¿Eliminar ${filas.length} registro(s) seleccionado(s)? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      tone: 'danger',
    });
    if (!ok) return;

    try {
      const resultados = await firstValueFrom(this.api.removeLote(filas.map((f) => f.motivoid)));
      const fallos = resultados.filter((res) => !res.ok);
      const eliminados = resultados.length - fallos.length;

      if (eliminados > 0) {
        const borrados = new Set(resultados.filter((res) => res.ok).map((res) => res.motivoid));
        this.items.update((list) => list.filter((it) => !borrados.has(it.motivoid)));
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
  protected async onReorder(filas: MotivoNotas[]): Promise<void> {
    const previo = this.items();
    // Optimista: se renumera en local para que el `#` cuadre al instante con la posición.
    this.items.set(filas.map((f, i) => ({ ...f, orden: i + 1 })));

    try {
      await firstValueFrom(this.api.reordenar(filas.map((f) => f.motivoid), 1));
    } catch {
      this.items.set(previo);
    }
  }

  // ── Alta y edición ──────────────────────────────────────────────────
  protected readonly modalAbierto = signal(false);
  /** `null` = alta; con valor = edición de ese registro. */
  protected readonly editando = signal<MotivoNotas | null>(null);
  protected readonly guardando = signal(false);

  /**
   * Los campos que acepta el backend. Ni `orden` ni `estado`: cada uno tiene su propia
   * acción en la grilla —arrastrar la fila y pulsar su etiqueta de estado— y ésa es su única
   * fuente de verdad.
   */
  protected readonly form = this.fb.nonNullable.group({
    tipo: ['C' as TipoNota, [Validators.required]],
    nombre: ['', [Validators.required, Validators.maxLength(MOTIVO_NOTAS_MAX_NOMBRE)]],
    abreviatura: ['', [Validators.maxLength(MOTIVO_NOTAS_MAX_ABREVIATURA)]],
    codigo_contable: ['', [Validators.maxLength(MOTIVO_NOTAS_MAX_CODIGO_CONTABLE)]],
    afectastock: [false],
  });

  protected readonly tituloModal = computed(() =>
    this.editando() ? 'Editar motivo de notas' : 'Nuevo motivo de notas',
  );

  protected onNuevo(): void {
    this.editando.set(null);
    this.form.reset({ tipo: 'C' as TipoNota, nombre: '', abreviatura: '', codigo_contable: '', afectastock: false });
    this.modalAbierto.set(true);
  }

  protected onEditar(row: MotivoNotas): void {
    this.editando.set(row);
    this.form.reset({
      tipo: row.tipo as TipoNota,
      nombre: row.nombre,
      abreviatura: row.abreviatura,
      codigo_contable: row.codigo_contable,
      afectastock: row.afectastock,
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

    const input: MotivoNotasInput = this.form.getRawValue();
    const enEdicion = this.editando();
    this.guardando.set(true);

    try {
      if (enEdicion) {
        const actualizado = await firstValueFrom(this.api.update(enEdicion.motivoid, input));
        this.patchRow(enEdicion.motivoid, actualizado);
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
  protected async onEliminar(row: MotivoNotas): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Eliminar motivo de notas',
      message: `¿Eliminar "${row.nombre}"? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      tone: 'danger',
    });
    if (!ok) return;

    try {
      await firstValueFrom(this.api.remove(row.motivoid));
      this.items.update((list) => list.filter((it) => it.motivoid !== row.motivoid));
      this.seleccionadas.update((sel) => sel.filter((s) => s.motivoid !== row.motivoid));
      this.notify.success(`Se eliminó "${row.nombre}".`);
    } catch {
      // 409 si hay ventas relacionadas: ya lo notificó el interceptor. Se recarga por si el
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
    const cabeceras = ['Orden', 'ID', 'Tipo', 'Nombre', 'Abreviatura', 'Código', 'Afecta stock', 'Estado'];
    const matriz = [
      cabeceras,
      ...this.rows().map((t) => [
        t.orden,
        t.motivoid,
        etiquetaTipoNota(t.tipo),
        t.nombre,
        t.abreviatura,
        t.codigo_contable,
        t.afectastock ? 'Sí' : 'No',
        t.estado ? 'Activo' : 'Inactivo',
      ]),
    ];

    if (e.formato === 'csv') {
      exportCsv('motivos-notas.csv', matriz);
    } else {
      exportXls('motivos-notas.xls', matriz);
    }
  }
}
