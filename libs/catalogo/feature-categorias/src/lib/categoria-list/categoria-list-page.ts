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
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CategoriaApi } from '@phoenix/catalogo/data-access';
import type { PageMeta } from '@phoenix/shared/api';
import {
  CATEGORIA_MAX_ABREVIATURA,
  CATEGORIA_MAX_NOMBRE,
  type Categoria,
  type CategoriaInput,
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
 * Mantenimiento de Categorías de producto (`catalogo.categoria`).
 *
 * Es el primer nivel de la clasificación del maestro: cada categoría agrupa subcategorías, y
 * son las subcategorías las que cuelgan del master.
 *
 * Conviene tener presentes cuatro cosas antes de tocarla:
 *
 * - **No cuelga del hub de Tablas Básicas.** Es una opción de menú PROPIA (`basic.menuweb` 72,
 *   «Categorías», bajo el padre 70 «Catalogo») con su propio proceso de permiso,
 *   `CAT-CATEGORIA` (de `Categoria.php:9`). Ni aparece en `TablasBasicas.php` ni en
 *   `tablas.ts`, así que migrarla fue poner su `ruta_phoenix` en su fila del menú. Por lo
 *   mismo, `onCerrar()` vuelve a `/inicio` y no al índice de tablas básicas: esa pantalla no
 *   es su padre.
 * - **Tres columnas y nada más.** La tabla no tiene `estado` ni `orden`, así que no hay
 *   interruptor por fila, ni columna `#`, ni arrastre, ni sus endpoints. (El
 *   `case "change_status"` de `ajCategoria.php` llama a `pacategoria_cambiar_estado`, que NO
 *   EXISTE en la base; es código muerto que la UI del legacy tampoco engancha.)
 * - **El filtro por nombre va al SERVIDOR** (`GET /categorias?q=`), que se lo pasa tal cual al
 *   stored procedure. La PAGINACIÓN, en cambio, sigue en cliente: el endpoint devuelve el
 *   catálogo entero y sin `meta` porque no existe `pacategoria_count`.
 * - ⚠ **El control de duplicados de este recurso NO normaliza acentos, y es el único del
 *   módulo.** `pacategoria_actualizar` compara `trim(upper(nombre))` a secas, mientras que
 *   marca, subcategoría y las dos de unidades pasan por `public.buscar()`. O sea que «CAFÉ» y
 *   «CAFE» pueden coexistir AQUÍ y no en las otras cuatro pantallas. Comprobado contra la base
 *   real; si un usuario reporta que «le deja duplicar», no es un fallo de esta pantalla.
 *
 * Borrar una categoría que tenga subcategorías responde 409 (`categoria_has_relations`) y el
 * mensaje lo redacta el backend: el `error-interceptor` ya lo muestra y la fila se queda.
 *
 * Sin reporte PDF ni menú Imprimir: el PDF no es estándar en una pantalla de mantenimiento
 * —cuesta un endpoint y una definición de columnas en el backend— y el legacy no imprime este
 * catálogo.
 */
@Component({
  selector: 'erp-categoria-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    PageHeader,
    FilterPanel,
    DataGrid,
    CellTemplate,
    Icon,
    Modal,
    ExportMenu,
    GridFooter,
  ],
  templateUrl: './categoria-list-page.html',
  styleUrl: './categoria-list-page.scss',
})
export class CategoriaListPage {
  private readonly api = inject(CategoriaApi);
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
   * sacaría al usuario FUERA del ERP, así que en ese caso se sube a `/inicio`: esta pantalla
   * es una opción de menú propia y NO cuelga del índice de tablas básicas.
   */
  protected onCerrar(): void {
    if (this.hayHistoria) {
      this.location.back();
      return;
    }
    void this.router.navigate(['/inicio']);
  }

  protected readonly maxNombre = CATEGORIA_MAX_NOMBRE;
  protected readonly maxAbreviatura = CATEGORIA_MAX_ABREVIATURA;

  // ── Filtros (en SERVIDOR) ───────────────────────────────────────────
  protected readonly filters = this.fb.nonNullable.group({
    q: '',
  });
  private readonly applied = signal(this.filters.getRawValue());

  // ── Datos ───────────────────────────────────────────────────────────
  // El recurso depende del filtro aplicado: pulsar "Buscar" recarga contra el backend.
  private readonly catalogo = resource({
    params: () => this.applied(),
    loader: ({ params }) => firstValueFrom(this.api.list(params)),
  });

  /**
   * Lista de trabajo: copia editable del resultado. Permite reflejar altas, ediciones y
   * borrados sin recargar el catálogo entero.
   */
  private readonly items = linkedSignal<Categoria[]>(() => this.catalogo.value() ?? []);
  protected readonly rows = this.items;

  protected readonly loading = this.catalogo.isLoading;
  protected readonly error = computed(() => {
    const e = this.catalogo.error();
    return e instanceof Error
      ? e.message
      : e
        ? 'No se pudo cargar el catálogo de categorías.'
        : null;
  });

  protected onApply(): void {
    this.applied.set(this.filters.getRawValue());
    this.page.set(1); // el filtro cambia el universo: la página 3 anterior ya no significa nada
    this.seleccionadas.set([]);
  }

  // ── Paginación (en cliente) ─────────────────────────────────────────
  // El endpoint devuelve el catálogo entero ya filtrado, sin `meta` —no existe
  // `pacategoria_count`—, así que el troceado se hace aquí.
  protected readonly pageSizes = PAGE_SIZES;
  protected readonly page = signal(1);
  protected readonly pageSize = signal(25);

  /** Filas de la página en curso: es lo que se pinta. */
  protected readonly rowsPagina = computed<Categoria[]>(() => {
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
  // Sin columna `#` ni columna de estado: la tabla son tres columnas. «Subcategorías» es
  // derivada y de solo lectura, y se pinta como enlace al hijo.
  protected readonly columns: GridColumn<Categoria>[] = [
    { key: 'nombre', header: 'Nombre' },
    { key: 'abreviatura', header: 'Abreviatura', width: '160px' },
    { key: 'cantidad_subcategorias', header: 'Subcategorías', width: '150px', align: 'right' },
  ];

  /** Reemplaza en la lista de trabajo los campos de una fila ya cargada. Lo usa `onGuardar()`. */
  private patchRow(id: number, patch: Partial<Categoria>): void {
    this.items.update((list) => list.map((it) => (it.categoriaid === id ? { ...it, ...patch } : it)));
  }

  // ── Selección de filas (borrado en lote) ────────────────────────────
  protected readonly seleccionadas = signal<Categoria[]>([]);

  protected onSeleccion(filas: Categoria[]): void {
    this.seleccionadas.set(filas);
  }

  /**
   * Borrado en lote: UNA petición, no N. El endpoint responde 200 con el resultado por id
   * porque el lote es parcial por diseño —una categoría con subcategorías falla mientras el
   * resto sí se borra—, así que el saldo se lee de las filas.
   */
  protected async onEliminarSeleccionadas(): Promise<void> {
    const filas = this.seleccionadas();
    if (filas.length === 0) return;

    const ok = await this.confirm.ask({
      title: 'Eliminar categorías',
      message: `¿Eliminar ${filas.length} registro(s) seleccionado(s)? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      tone: 'danger',
    });
    if (!ok) return;

    try {
      const resultados = await firstValueFrom(this.api.removeLote(filas.map((f) => f.categoriaid)));
      const fallos = resultados.filter((res) => !res.ok);
      const eliminados = resultados.length - fallos.length;

      if (eliminados > 0) {
        const borrados = new Set(resultados.filter((res) => res.ok).map((res) => res.categoriaid));
        this.items.update((list) => list.filter((it) => !borrados.has(it.categoriaid)));
        this.notify.success(`Se eliminaron ${eliminados} registro(s).`);
      }
      if (fallos.length > 0) {
        // Los motivos se repiten ("tiene subcategorías registradas"), así que se deduplican en
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

  // ── Alta y edición ──────────────────────────────────────────────────
  protected readonly modalAbierto = signal(false);
  /** `null` = alta; con valor = edición de ese registro. */
  protected readonly editando = signal<Categoria | null>(null);
  protected readonly guardando = signal(false);

  /**
   * Los dos únicos campos que acepta el backend. No hay `estado` ni `orden` que dejar fuera:
   * la tabla no los tiene. Y `cantidad_subcategorias` es derivado, se mira y no se escribe.
   */
  protected readonly form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(CATEGORIA_MAX_NOMBRE)]],
    abreviatura: ['', [Validators.maxLength(CATEGORIA_MAX_ABREVIATURA)]],
  });

  protected readonly tituloModal = computed(() =>
    this.editando() ? 'Editar categoría' : 'Nueva categoría',
  );

  protected onNuevo(): void {
    this.editando.set(null);
    this.form.reset({ nombre: '', abreviatura: '' });
    this.modalAbierto.set(true);
  }

  protected onEditar(row: Categoria): void {
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

    const input: CategoriaInput = this.form.getRawValue();
    const enEdicion = this.editando();
    this.guardando.set(true);

    try {
      if (enEdicion) {
        const actualizado = await firstValueFrom(this.api.update(enEdicion.categoriaid, input));
        this.patchRow(enEdicion.categoriaid, actualizado);
        this.notify.success(`Se actualizó "${actualizado.nombre}".`);
      } else {
        const creado = await firstValueFrom(this.api.create(input));
        // Al final de la lista: la categoría recién creada no tiene subcategorías todavía.
        this.items.update((list) => [...list, creado]);
        this.notify.success(`Se creó "${creado.nombre}".`);
      }
      this.modalAbierto.set(false);
    } catch {
      // 409 (nombre duplicado) y 422 (validación): el `error-interceptor` ya mostró el
      // `message` del backend, que en 4xx es seguro. El modal se queda abierto con lo
      // escrito para poder corregirlo.
      //
      // ⚠ El duplicado de este recurso distingue acentos: «CAFÉ» no choca con «CAFE».
    } finally {
      this.guardando.set(false);
    }
  }

  // ── Eliminación ─────────────────────────────────────────────────────
  protected async onEliminar(row: Categoria): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Eliminar categoría',
      message: `¿Eliminar "${row.nombre}"? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      tone: 'danger',
    });
    if (!ok) return;

    try {
      await firstValueFrom(this.api.remove(row.categoriaid));
      this.items.update((list) => list.filter((it) => it.categoriaid !== row.categoriaid));
      this.seleccionadas.update((sel) => sel.filter((s) => s.categoriaid !== row.categoriaid));
      this.notify.success(`Se eliminó "${row.nombre}".`);
    } catch {
      // 409 `categoria_has_relations` si la categoría tiene subcategorías: el mensaje lo
      // redacta el backend y ya lo notificó el interceptor. Se recarga para que la fila que
      // NO se borró vuelva a la lista tal cual está en la base.
      this.catalogo.reload();
    }
  }

  // ── Exportación ─────────────────────────────────────────────────────
  /**
   * Exporta a Excel o CSV **lo que se está viendo**, filtro incluido: se genera en el
   * navegador a partir de las filas ya cargadas, sin pedir nada al backend.
   *
   * Sin columna Estado: no existe.
   */
  protected onExportar(e: ExportChoice): void {
    const cabeceras = ['ID', 'Nombre', 'Abreviatura', 'Subcategorías'];
    const matriz = [
      cabeceras,
      ...this.rows().map((c) => [c.categoriaid, c.nombre, c.abreviatura, c.cantidad_subcategorias]),
    ];

    if (e.formato === 'csv') {
      exportCsv('categorias.csv', matriz);
    } else {
      exportXls('categorias.xls', matriz);
    }
  }
}
