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
import { TallaApi } from '@phoenix/catalogo/data-access';
import type { PageMeta } from '@phoenix/shared/api';
import {
  TALLA_MAX_ABREVIATURA,
  TALLA_MAX_NOMBRE,
  type Talla,
  type TallaInput,
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
 * Mantenimiento de Tallas de producto (`catalogo.talla`, proceso `CAT-TALLA`).
 *
 * Es la gemela de Colores sin la columna muerta: mismas funciones, misma forma, un campo menos.
 *
 * ⚠ ESTA PANTALLA NO TENÍA OPCIÓN DE MENÚ EN EL LEGACY. `Talla.php` existe y declara
 * `$segProcesoMenu="CAT-TALLA"`, pero no hay fila en `basic.menuweb` con ese proceso: al PHP
 * solo se llega por URL directa o desde el formulario de producto. La fila la crea Phoenix, con
 * el proceso que el `.php` ya declaraba.
 *
 * ⚠ En producción esta tabla tiene UNA sola fila, la centinela «NO DEFINIDO» (id 0), que el
 * listado oculta: hasta que alguien dé de alta la primera talla, la pantalla sale vacía. No es
 * un fallo de carga.
 *
 * El reordenamiento es del LEGACY: `catalogo.patalla_cambiar_orden` ya recibe `vstart` y ya
 * numera `orden = posición + (vstart-1)`, al contrario que las de líneas y grupos, que
 * necesitaron la migración 0009.
 *
 * Repartos de trabajo entre servidor y cliente, que aquí no coinciden:
 *
 * - **El filtro por nombre va al SERVIDOR** (`catalogo.patalla_leer` lo recibe). Filtrar aquí
 *   sería reimplementar `public.buscar()`, que normaliza tildes con dos erratas conocidas.
 * - **El filtro de estado va al CLIENTE**: el stored procedure devuelve activas e inactivas sin
 *   parámetro que lo module, así que no hay nada que delegarle.
 * - **La paginación va al CLIENTE**: el endpoint devuelve el catálogo entero y sin `meta`. Este
 *   recurso ni siquiera tiene un `patalla_count`.
 *
 * ⚠ Detalle del legacy que no se copia: `Talla.php:35` pinta una cabecera de columna que dice
 * «COLOR», copiada de `Color.php`, y `talla.js` la rellena con una celda vacía.
 *
 * Y esta pantalla NO cuelga del hub de Tablas Básicas, así que cerrar vuelve a `/inicio`.
 */
@Component({
  selector: 'erp-talla-list-page',
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
  templateUrl: './talla-list-page.html',
  styleUrl: './talla-list-page.scss',
})
export class TallaListPage {
  private readonly api = inject(TallaApi);
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

  /**
   * Cierra la pantalla y vuelve por donde se vino. Sin historia previa, `location.back()`
   * sacaría al usuario FUERA del ERP.
   *
   * ⚠ El destino de reserva es `/inicio`, NO el índice de tablas básicas: esta pantalla es una
   * opción de menú propia bajo «Catalogo».
   */
  protected onCerrar(): void {
    if (this.hayHistoria) {
      this.location.back();
      return;
    }
    void this.router.navigate(['/inicio']);
  }

  protected readonly maxNombre = TALLA_MAX_NOMBRE;
  protected readonly maxAbreviatura = TALLA_MAX_ABREVIATURA;

  // ── Filtros ─────────────────────────────────────────────────────────
  /**
   * `q` viaja al servidor; `estado` NO: el stored procedure devuelve activas e inactivas sin
   * parámetro que lo module, así que ese filtro se resuelve aquí sobre lo que ya está cargado.
   */
  protected readonly filters = this.fb.nonNullable.group({
    q: '',
    estado: 'todas', // 'todas' | 'activas' | 'inactivas'
  });
  /**
   * ⚠ DOS señales, no una con el `getRawValue()` entero, y el motivo es concreto: el `resource`
   * de abajo depende de `appliedQ`, y `signal<string>` deduplica —fijarla al mismo texto no
   * notifica a nadie—. Con una sola señal de objeto, cada `onApply()` produciría un objeto
   * NUEVO y el `resource` se recargaría aunque solo se hubiera tocado el selector de estado,
   * que ni siquiera viaja al backend. Una petición idéntica a la anterior por cada cambio de
   * selector.
   */
  private readonly appliedQ = signal(this.filters.getRawValue().q.trim());
  private readonly appliedEstado = signal(this.filters.getRawValue().estado);

  // ── Datos ───────────────────────────────────────────────────────────
  /**
   * ⚠ `params` es el TEXTO buscado, no un objeto `{q}`. Angular compara los `params` por
   * igualdad, y un objeto literal es nuevo en cada evaluación: con `{q: ...}`, cambiar el
   * selector de estado —que no viaja al backend— dispararía una petición idéntica a la
   * anterior. Con un string, el `resource` solo recarga cuando el texto cambia de verdad.
   */
  private readonly catalogo = resource({
    params: () => this.appliedQ(),
    loader: ({ params }) => firstValueFrom(this.api.list({ q: params })),
  });

  /**
   * Lista de trabajo: copia editable del resultado. Permite alternar el estado, reordenar, dar
   * de alta y borrar de forma optimista sin recargar el catálogo entero ni hacer parpadear la
   * lista.
   */
  private readonly items = linkedSignal<Talla[]>(() => this.catalogo.value() ?? []);

  /** Filas visibles: lo que trajo el servidor, con el filtro de estado aplicado en cliente. */
  protected readonly rows = computed<Talla[]>(() => {
    const estado = this.appliedEstado();
    const lista = this.items();
    if (estado === 'activas') return lista.filter((g) => g.estado);
    if (estado === 'inactivas') return lista.filter((g) => !g.estado);
    return lista;
  });

  protected readonly loading = this.catalogo.isLoading;
  protected readonly error = computed(() => {
    const e = this.catalogo.error();
    return e instanceof Error ? e.message : e ? 'No se pudo cargar el catálogo de tallas.' : null;
  });

  protected onApply(): void {
    const { q, estado } = this.filters.getRawValue();
    this.appliedQ.set(q.trim()); // si el texto no cambió, esto NO dispara ninguna petición
    this.appliedEstado.set(estado);
    this.page.set(1); // el filtro cambia el universo: la página 3 anterior ya no significa nada
    this.seleccionadas.set([]);
  }

  // ── Paginación (en cliente) ─────────────────────────────────────────
  // El endpoint FILTRA por nombre pero no PAGINA: devuelve el catálogo entero, sin `meta`.
  protected readonly pageSizes = PAGE_SIZES;
  protected readonly page = signal(1);
  protected readonly pageSize = signal(25);

  /** Filas de la página en curso: es lo que se pinta. */
  protected readonly rowsPagina = computed<Talla[]>(() => {
    const filas = this.rows();
    const size = this.pageSize();
    if (size <= 0) return filas; // "Todas"
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
   */
  protected readonly filtrando = computed(() => {
    return (
      this.appliedQ() !== '' || this.appliedEstado() !== 'todas' || this.meta().totalPages > 1
    );
  });

  // ── Columnas ────────────────────────────────────────────────────────
  // Sin `sortable`: el orden de este catálogo es un dato editable (`orden`), no una vista. Dejar
  // ordenar por columna haría que el arrastre guardase un orden que no es el que se está viendo.
  protected readonly columns: GridColumn<Talla>[] = [
    { key: 'orden', header: '#', width: '60px', align: 'right', mono: true },
    { key: 'nombre', header: 'Nombre' },
    { key: 'abreviatura', header: 'Abreviatura', width: '150px' },
    { key: 'cantidad_productos', header: 'Productos', width: '180px' },
    { key: 'estado', header: 'Estado', width: '110px' },
  ];

  // ── Estado ──────────────────────────────────────────────────────────
  /**
   * Alterna el estado de forma optimista y lo revierte si el backend falla (el
   * `error-interceptor` ya notificó el motivo).
   *
   * El endpoint es un TOGGLE: no se le manda el valor deseado. Pero sí devuelve el estado
   * resultante, así que al confirmar se pinta lo que dice el backend.
   *
   * ⚠ Aquí el filtro de estado es de CLIENTE, así que la fila SÍ desaparece al instante si deja
   * de cumplirlo. Es lo correcto: la lista se mantiene coherente con lo que dice el selector.
   */
  protected async onToggleEstado(row: Talla): Promise<void> {
    this.patchRow(row.tallaid, { estado: !row.estado });
    try {
      const resultado = await firstValueFrom(this.api.alternarEstado(row.tallaid));
      if (typeof resultado?.estado === 'boolean') {
        this.patchRow(row.tallaid, { estado: resultado.estado });
      }
    } catch {
      this.patchRow(row.tallaid, { estado: row.estado });
    }
  }

  private patchRow(id: number, patch: Partial<Talla>): void {
    this.items.update((list) => list.map((it) => (it.tallaid === id ? { ...it, ...patch } : it)));
  }

  // ── Selección de filas (borrado en lote) ────────────────────────────
  protected readonly seleccionadas = signal<Talla[]>([]);

  protected onSeleccion(filas: Talla[]): void {
    this.seleccionadas.set(filas);
  }

  /**
   * Borrado en lote: UNA petición, no N. El endpoint responde 200 con el resultado por id
   * porque el lote es parcial por diseño —una talla con productos asignados falla mientras el
   * resto sí se borra—, así que el saldo se lee de las filas.
   */
  protected async onEliminarSeleccionadas(): Promise<void> {
    const filas = this.seleccionadas();
    if (filas.length === 0) return;

    const ok = await this.confirm.ask({
      title: 'Eliminar tallas',
      message: `¿Eliminar ${filas.length} registro(s) seleccionado(s)? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      tone: 'danger',
    });
    if (!ok) return;

    try {
      const resultados = await firstValueFrom(this.api.removeLote(filas.map((f) => f.tallaid)));
      const fallos = resultados.filter((res) => !res.ok);
      const eliminados = resultados.length - fallos.length;

      if (eliminados > 0) {
        const borrados = new Set(resultados.filter((res) => res.ok).map((res) => res.tallaid));
        this.items.update((list) => list.filter((it) => !borrados.has(it.tallaid)));
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

  // ── Reordenamiento ──────────────────────────────────────────────────
  /**
   * Guarda el nuevo orden tras arrastrar una fila.
   *
   * Se manda la lista COMPLETA con `desde = 1`, así que la numeración queda 1..n. Por eso el
   * arrastre se apaga con cualquier filtro puesto y con la lista repartida en varias páginas:
   * la grilla emitiría solo las filas visibles. Ver `filtrando`.
   */
  protected async onReorder(filas: Talla[]): Promise<void> {
    const previa = this.items();
    // Optimista: se renumera en local para que el `#` cuadre al instante con la posición.
    this.items.set(filas.map((f, i) => ({ ...f, orden: i + 1 })));

    try {
      await firstValueFrom(
        this.api.reordenar(
          filas.map((f) => f.tallaid),
          1,
        ),
      );
    } catch {
      this.items.set(previa);
    }
  }

  // ── Alta y edición ──────────────────────────────────────────────────
  protected readonly modalAbierto = signal(false);
  /** `null` = alta; con valor = edición de ese registro. */
  protected readonly editando = signal<Talla | null>(null);
  protected readonly guardando = signal(false);

  /**
   * Los dos campos que acepta el backend. Ni `estado` ni `orden` —cada uno tiene su propia
   * acción en la grilla— ni `cantidad_productos`, que es derivado y de solo lectura.
   */
  protected readonly form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(TALLA_MAX_NOMBRE)]],
    abreviatura: ['', [Validators.maxLength(TALLA_MAX_ABREVIATURA)]],
  });

  protected readonly tituloModal = computed(() =>
    this.editando() ? 'Editar talla' : 'Nueva talla',
  );

  protected onNuevo(): void {
    this.editando.set(null);
    this.form.reset({ nombre: '', abreviatura: '' });
    this.modalAbierto.set(true);
  }

  protected onEditar(row: Talla): void {
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

    const input: TallaInput = this.form.getRawValue();
    const enEdicion = this.editando();
    this.guardando.set(true);

    try {
      if (enEdicion) {
        const actualizada = await firstValueFrom(this.api.update(enEdicion.tallaid, input));
        this.patchRow(enEdicion.tallaid, actualizada);
        this.notify.success(`Se actualizó "${actualizada.nombre}".`);
      } else {
        const creada = await firstValueFrom(this.api.create(input));
        // Se añade al final, que es donde el backend lo coloca (orden = último+1). Sin recargar:
        // el alta nace activa, así que solo desentonaría con el filtro «Solo inactivas», y aun
        // ahí es mejor que el usuario vea lo que acaba de crear.
        this.items.update((list) => [...list, creada]);
        this.notify.success(`Se creó "${creada.nombre}".`);
      }
      this.modalAbierto.set(false);
    } catch {
      // 409 (nombre duplicado) y 422 (validación): el `error-interceptor` ya mostró el `message`
      // del backend, que en 4xx es seguro. El modal se queda abierto con lo escrito.
    } finally {
      this.guardando.set(false);
    }
  }

  // ── Eliminación ─────────────────────────────────────────────────────
  protected async onEliminar(row: Talla): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Eliminar talla',
      message: `¿Eliminar "${row.nombre}"? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      tone: 'danger',
    });
    if (!ok) return;

    try {
      await firstValueFrom(this.api.remove(row.tallaid));
      this.items.update((list) => list.filter((it) => it.tallaid !== row.tallaid));
      this.seleccionadas.update((sel) => sel.filter((s) => s.tallaid !== row.tallaid));
      this.notify.success(`Se eliminó "${row.nombre}".`);
    } catch {
      // 409 si tiene productos asignados: ya lo notificó el interceptor. Se recarga —con el
      // filtro aplicado, no sin él— por si el catálogo cambió por otro lado.
      this.catalogo.reload();
    }
  }

  // ── Exportación ─────────────────────────────────────────────────────
  /**
   * Exporta a Excel o CSV **lo que se está viendo**, filtros incluidos: se genera en el
   * navegador a partir de las filas ya cargadas, sin pedir nada al backend.
   */
  protected onExportar(e: ExportChoice): void {
    const cabeceras = ['Orden', 'ID', 'Nombre', 'Abreviatura', 'Productos', 'Estado'];
    const matriz = [
      cabeceras,
      ...this.rows().map((g) => [
        g.orden,
        g.tallaid,
        g.nombre,
        g.abreviatura,
        g.cantidad_productos,
        g.estado ? 'Activa' : 'Inactiva',
      ]),
    ];

    if (e.formato === 'csv') {
      exportCsv('tallas.csv', matriz);
    } else {
      exportXls('tallas.xls', matriz);
    }
  }
}
