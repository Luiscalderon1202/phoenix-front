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
import { LineaApi } from '@phoenix/catalogo/data-access';
import type { PageMeta } from '@phoenix/shared/api';
import {
  LINEA_MAX_ABREVIATURA,
  LINEA_MAX_CODIGO_CONTABLE,
  LINEA_MAX_NOMBRE,
  type Linea,
  type LineaInput,
  type LineaListQuery,
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
 * Mantenimiento de Líneas (`catalogo.linea`, menuweb 71, proceso `CAT-LINEA`).
 *
 * ⚠ Es la ÚNICA pantalla del módulo que combina **paginación de servidor** con **arrastre para
 * reordenar**. Las dos cosas conviven gracias a `desde`: el backend calcula
 * `orden = posición + (desde-1)`, así que reordenar la página 2 con `desde = 11` deja esas
 * filas en 11..20 en vez de colarlas delante de la página 1. Ver `onReorder`.
 *
 * ⚠ EL `orden` DE ESTA TABLA LO APORTA LA MIGRACIÓN 0009 DE PHOENIX. La columna existía y no
 * servía para nada:
 *
 * - `catalogo.palinea_cambiar_orden` NO EXISTE (y `ajLinea.php` la invoca en una rama muerta,
 *   contra un método `Cambiar_Orden` que tampoco existe en `Acceso_clsLinea`);
 * - `catalogo.palinea_leer` ordena `by l.nombre` a fuego, así que escribir `orden` no habría
 *   cambiado nada;
 * - y `catalogo.palinea_actualizar` inserta `palinea_lastorder()` **sin el `+1`** que ponen sus
 *   hermanas de grupo, color y talla, con lo que toda alta nacía empatada con la última. Hoy
 *   las tres filas de producción tienen `orden = 0`.
 *
 * `Linea.php` ni siquiera incluye `head_order_table.php`, al revés que `Grupo.php`.
 *
 * ⚠ NO hay filtro de estado, y es deliberado: con paginación de SERVIDOR, descartar filas en el
 * cliente dejaría páginas de 17 registros de 25 y un `total` de pie que no cuadra con lo que se
 * ve. El endpoint devuelve activas e inactivas y la columna de estado lo dice por fila. El
 * único filtro es el nombre, y ése sí va al servidor.
 *
 * Y esta pantalla NO cuelga del hub de Tablas Básicas —es una opción de menú propia con su
 * propio proceso—, así que cerrar vuelve a `/inicio`.
 */
@Component({
  selector: 'erp-linea-list-page',
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
  templateUrl: './linea-list-page.html',
  styleUrl: './linea-list-page.scss',
})
export class LineaListPage {
  private readonly api = inject(LineaApi);
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
   * ⚠ El destino de reserva es `/inicio`, NO el índice de tablas básicas: Líneas no cuelga de
   * ese hub y mandar ahí al usuario lo dejaría en una pantalla que puede no tener concedida.
   */
  protected onCerrar(): void {
    if (this.hayHistoria) {
      this.location.back();
      return;
    }
    void this.router.navigate(['/inicio']);
  }

  protected readonly maxNombre = LINEA_MAX_NOMBRE;
  protected readonly maxAbreviatura = LINEA_MAX_ABREVIATURA;
  protected readonly maxCodigoContable = LINEA_MAX_CODIGO_CONTABLE;

  // ── Filtros (en SERVIDOR) ───────────────────────────────────────────
  /**
   * Un solo filtro. No hay selector de estado: ver el aviso del componente — con paginación de
   * servidor, filtrar en cliente descuadraría el pie.
   */
  protected readonly filters = this.fb.nonNullable.group({
    q: '',
  });

  /**
   * Filtros ya confirmados. Solo cambia al pulsar "Buscar": si el `resource` leyera el
   * formulario directamente, cada tecleo dispararía una consulta.
   */
  private readonly applied = signal(this.filters.getRawValue());

  // ── Paginación (en SERVIDOR) ────────────────────────────────────────
  protected readonly pageSizes = PAGE_SIZES;
  protected readonly page = signal(1);
  protected readonly pageSize = signal(25);

  /**
   * Parámetros que se mandan al endpoint. `page` y `pageSize` entran AQUÍ, no en un troceado de
   * cliente: cambiar cualquiera re-dispara el `resource` y el backend devuelve otra página.
   */
  private readonly query = computed<LineaListQuery>(() => ({
    page: this.page(),
    page_size: this.pageSize(),
    q: this.applied().q.trim(),
  }));

  private readonly lineas = resource({
    params: () => this.query(),
    loader: ({ params }) => firstValueFrom(this.api.list(params)),
  });

  /**
   * Lista de trabajo: copia editable de la página en curso. Permite reflejar una edición, un
   * cambio de estado o un arrastre sin recargar.
   *
   * `rows` es la página TAL CUAL la manda el backend: no hay `rowsPagina` que la vuelva a
   * trocear, porque ya viene troceada.
   */
  private readonly items = linkedSignal<Linea[]>(() => this.lineas.value()?.data ?? []);
  protected readonly rows = this.items;

  protected readonly loading = this.lineas.isLoading;
  protected readonly error = computed(() => {
    const e = this.lineas.error();
    return e instanceof Error ? e.message : e ? 'No se pudo cargar el catálogo de líneas.' : null;
  });

  /**
   * Meta del pie de grilla. `page`/`pageSize` salen de NUESTRAS señales (evita el parpadeo
   * mientras llega la respuesta); solo `total` viene del backend, de `palinea_count(q)`.
   */
  protected readonly meta = computed<PageMeta>(() => {
    const page = this.page();
    const pageSize = this.pageSize();
    const total = this.lineas.value()?.meta.total ?? 0;
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
    this.lineas.reload();
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

  // ── Reordenamiento ──────────────────────────────────────────────────
  /**
   * Posición 1-based de la primera fila de la página dentro del catálogo entero. Es lo que el
   * backend necesita para calcular `orden = posición + (desde-1)`.
   *
   * Con `pageSize` 0 ("Todos") la página empieza en 1.
   */
  private readonly desde = computed(() => {
    const size = this.pageSize();
    return size > 0 ? (this.page() - 1) * size + 1 : 1;
  });

  /**
   * El arrastre solo se apaga cuando hay TEXTO BUSCADO, no cuando hay varias páginas.
   *
   * ⚠ Es la diferencia con las pantallas de catálogo completo (unidades de medida, grupos,
   * colores, tallas), que apagan el arrastre en cuanto la lista se reparte en varias páginas.
   * Aquí no hace falta: la página que se ve es un TRAMO CONTIGUO del orden del servidor, y
   * `desde` le dice al backend en qué posición empieza. Con un filtro por nombre, en cambio,
   * las filas visibles NO son contiguas —entre la 3ª y la 4ª puede haber diez que no casan— y
   * renumerarlas machacaría el orden de las ocultas.
   */
  protected readonly filtrando = computed(() => this.applied().q.trim() !== '');

  /**
   * Guarda el nuevo orden tras arrastrar una fila dentro de la página.
   *
   * Se manda la página y su `desde`, no la lista entera: con paginación de servidor la lista
   * entera no está en memoria. Optimista, con vuelta atrás si el backend falla.
   */
  protected async onReorder(filas: Linea[]): Promise<void> {
    const previo = this.items();
    const desde = this.desde();
    // Optimista: se renumera en local para que el `#` cuadre al instante con la posición.
    this.items.set(filas.map((f, i) => ({ ...f, orden: desde + i })));

    try {
      await firstValueFrom(
        this.api.reordenar(
          filas.map((f) => f.lineaid),
          desde,
        ),
      );
    } catch {
      this.items.set(previo);
    }
  }

  // ── Columnas ────────────────────────────────────────────────────────
  // NINGUNA lleva `sortable`: con paginación de servidor solo ordenaría la página en curso, lo
  // que engaña —parece que ordena las 400 filas y ordena 25—. Y el orden de este catálogo es un
  // dato editable (`orden`), no una vista.
  protected readonly columns: GridColumn<Linea>[] = [
    { key: 'orden', header: '#', width: '60px', align: 'right', mono: true },
    { key: 'nombre', header: 'Nombre' },
    { key: 'abreviatura', header: 'Abreviatura', width: '140px' },
    { key: 'codigo_contable', header: 'ID contable', width: '130px', mono: true },
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
  protected async onToggleEstado(row: Linea): Promise<void> {
    this.patchRow(row.lineaid, { estado: !row.estado });
    try {
      const resultado = await firstValueFrom(this.api.alternarEstado(row.lineaid));
      if (typeof resultado?.estado === 'boolean') {
        this.patchRow(row.lineaid, { estado: resultado.estado });
      }
    } catch {
      this.patchRow(row.lineaid, { estado: row.estado });
    }
  }

  /**
   * Aplica una edición sobre la fila que ya está en pantalla. Sirve para el `PUT` y para el
   * cambio de estado, que no cambian ni el total ni la página.
   *
   * El alta y el borrado NO usan esto: ver `onGuardar` y `onEliminar`.
   */
  private patchRow(lineaid: number, patch: Partial<Linea>): void {
    this.items.update((list) => list.map((it) => (it.lineaid === lineaid ? { ...it, ...patch } : it)));
  }

  // ── Selección de filas (borrado en lote) ────────────────────────────
  protected readonly seleccionadas = signal<Linea[]>([]);

  protected onSeleccion(filas: Linea[]): void {
    this.seleccionadas.set(filas);
  }

  /**
   * Borrado en lote: UNA petición, no N. El endpoint responde 200 con el resultado por id
   * porque el lote es parcial por diseño —una línea puede fallar por tener masters mientras el
   * resto sí se borra—, así que el saldo se lee de las filas y no del código HTTP.
   *
   * Al terminar se RECARGA del servidor en vez de quitar las filas en local: con paginación de
   * servidor, borrar 3 de 25 dejaría una página de 22 con un `total` de pie que ya no es cierto.
   */
  protected async onEliminarSeleccionadas(): Promise<void> {
    const filas = this.seleccionadas();
    if (filas.length === 0) return;

    const ok = await this.confirm.ask({
      title: 'Eliminar líneas',
      message: `¿Eliminar ${filas.length} registro(s) seleccionado(s)? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      tone: 'danger',
    });
    if (!ok) return;

    try {
      const resultados = await firstValueFrom(this.api.removeLote(filas.map((f) => f.lineaid)));
      const fallos = resultados.filter((res) => !res.ok);
      const eliminadas = resultados.length - fallos.length;

      if (eliminadas > 0) this.notify.success(`Se eliminaron ${eliminadas} registro(s).`);
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
    this.lineas.reload();
  }

  // ── Alta y edición ──────────────────────────────────────────────────
  protected readonly modalAbierto = signal(false);
  /** `null` = alta; con valor = edición de ese registro. */
  protected readonly editando = signal<Linea | null>(null);
  protected readonly guardando = signal(false);

  /**
   * Los tres campos que acepta el backend. Ni `estado` ni `orden`: cada uno tiene su propia
   * acción en la grilla —pulsar su etiqueta de estado y arrastrar la fila— y ésa es su única
   * fuente de verdad.
   *
   * ⚠ El `maxlength` del ID contable son 20, los de la COLUMNA. `LineaEdit.php` declara 5, o
   * sea que deja escribir la cuarta parte de lo que cabe: es el error habitual del legacy pero
   * en la dirección contraria.
   */
  protected readonly form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(LINEA_MAX_NOMBRE)]],
    abreviatura: ['', [Validators.maxLength(LINEA_MAX_ABREVIATURA)]],
    codigo_contable: ['', [Validators.maxLength(LINEA_MAX_CODIGO_CONTABLE)]],
  });

  protected readonly tituloModal = computed(() =>
    this.editando() ? 'Editar línea' : 'Nueva línea',
  );

  protected onNuevo(): void {
    this.editando.set(null);
    this.form.reset({ nombre: '', abreviatura: '', codigo_contable: '' });
    this.modalAbierto.set(true);
  }

  protected onEditar(row: Linea): void {
    this.editando.set(row);
    this.form.reset({
      nombre: row.nombre,
      abreviatura: row.abreviatura,
      codigo_contable: row.codigo_contable,
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

    const input: LineaInput = this.form.getRawValue();
    const enEdicion = this.editando();
    this.guardando.set(true);

    try {
      if (enEdicion) {
        // La edición no cambia ni el total ni el sitio de la fila: se parchea en local.
        const actualizada = await firstValueFrom(this.api.update(enEdicion.lineaid, input));
        this.patchRow(enEdicion.lineaid, actualizada);
        this.notify.success(`Se actualizó "${actualizada.nombre}".`);
      } else {
        const creada = await firstValueFrom(this.api.create(input));
        this.notify.success(`Se creó "${creada.nombre}".`);
        // ⚠ Aquí NO se añade la fila en local, al contrario que en las pantallas de catálogo
        // completo: con paginación de servidor eso descuadra el `total` del pie —que viene de
        // `palinea_count`— y la línea nueva pertenece a la ÚLTIMA página por su orden, no a la
        // que se está viendo. Se recarga y punto.
        this.lineas.reload();
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
  /**
   * Borra una fila y RECARGA, en vez de quitarla de `items`: mismo motivo que el lote — el
   * `total` del pie lo cuenta el backend y la fila que asciende desde la página siguiente tiene
   * que aparecer.
   */
  protected async onEliminar(row: Linea): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Eliminar línea',
      message: `¿Eliminar "${row.nombre}"? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      tone: 'danger',
    });
    if (!ok) return;

    try {
      await firstValueFrom(this.api.remove(row.lineaid));
      this.seleccionadas.update((sel) => sel.filter((s) => s.lineaid !== row.lineaid));
      this.notify.success(`Se eliminó "${row.nombre}".`);
    } catch {
      // 409 si algún master la usa: ya lo notificó el interceptor. Se recarga igual, por si el
      // catálogo cambió por otro lado.
    }
    this.lineas.reload();
  }

  // ── Exportación ─────────────────────────────────────────────────────
  /**
   * Exporta a Excel o CSV **la página que se está viendo**.
   *
   * ⚠ Ojo con la diferencia respecto a las pantallas de catálogo completo: allí se exporta todo
   * lo filtrado porque todo está en memoria. Aquí solo hay una página cargada, y pedir el resto
   * significaría N peticiones al backend. Se exporta lo que se ve, que es lo honesto.
   */
  protected onExportar(e: ExportChoice): void {
    const cabeceras = ['Orden', 'ID', 'Nombre', 'Abreviatura', 'ID contable', 'Estado'];
    const matriz = [
      cabeceras,
      ...this.rows().map((l) => [
        l.orden,
        l.lineaid,
        l.nombre,
        l.abreviatura,
        l.codigo_contable,
        l.estado ? 'Activa' : 'Inactiva',
      ]),
    ];

    if (e.formato === 'csv') {
      exportCsv('lineas.csv', matriz);
    } else {
      exportXls('lineas.xls', matriz);
    }
  }
}
