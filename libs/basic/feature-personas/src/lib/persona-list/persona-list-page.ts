import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  resource,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { PersonaApi, RolApi } from '@phoenix/basic/data-access';
import type {
  Flag,
  PersonaListQuery,
  PersonaListRow,
  PersonaOrderBy,
  TipoPersona,
} from '@phoenix/basic/domain';
import type { PageMeta } from '@phoenix/shared/api';
import { TIPOPERSONA, TIPOSEXO } from '@phoenix/shared/domain';
import {
  CellTemplate,
  ConfirmService,
  DataGrid,
  FilterPanel,
  GridFooter,
  type GridColumn,
  Icon,
  NotificationService,
  PageHeader,
} from '@phoenix/shared/ui';

/** Tamaños de página del pie de grilla. */
const PAGE_SIZES = [10, 25, 50, 100];

/**
 * Listado de Personas. Paginación y filtros se resuelven SERVER-SIDE contra `GET /personas`;
 * la grilla solo pinta la página en curso.
 *
 * Lo que esta pantalla puede hacer es exactamente lo que expone el contrato: listar, alternar
 * el estado y eliminar (una fila o la selección). El alta/edición sigue en el legacy PHP, así
 * que aquí no hay botón "Agregar" ni acción de editar: prometerlos abriría una pantalla que
 * no existe.
 */
@Component({
  selector: 'erp-persona-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    PageHeader,
    FilterPanel,
    DataGrid,
    GridFooter,
    CellTemplate,
    Icon,
  ],
  templateUrl: './persona-list-page.html',
  styleUrl: './persona-list-page.scss',
})
export class PersonaListPage {
  private readonly api = inject(PersonaApi);
  private readonly rolApi = inject(RolApi);
  private readonly fb = inject(FormBuilder);
  private readonly notify = inject(NotificationService);
  private readonly confirm = inject(ConfirmService);

  /** Catálogos estáticos de los combos (viven en `shared/domain`: no cambian nunca). */
  protected readonly tipos = TIPOPERSONA;
  protected readonly sexos = TIPOSEXO;

  /** Catálogo dinámico de roles para el combo de filtro. */
  private readonly roles = resource({
    loader: () => firstValueFrom(this.rolApi.list()),
  });
  protected readonly roleOptions = computed(() => this.roles.value() ?? []);

  // ── Filtros ─────────────────────────────────────────────────────────
  // Cadena vacía = "sin filtro"; el data-access la omite de la query.
  protected readonly filters = this.fb.nonNullable.group({
    q: '',
    nombre: '',
    apemat: '',
    tipo: '', // '' | 'N' | 'J'
    rolid: '', // '' | rolid
    sexo: '', // '' | 'M' | 'F'
    estado: '', // '' | 'Y' | 'N'
    con_foto: '', // '' | 'Y' | 'N'
    orderby: '', // '' | 'codigo' | 'nombre'
  });

  /**
   * Filtros ya confirmados. Solo cambia al pulsar "Buscar": si el `resource` leyera el
   * formulario directamente, cada tecleo en la caja de búsqueda dispararía una consulta.
   */
  private readonly applied = signal(this.filters.getRawValue());

  // ── Paginación (server-side) ────────────────────────────────────────
  protected readonly pageSizes = PAGE_SIZES;
  protected readonly page = signal(1);
  protected readonly pageSize = signal(25);

  /** Parámetros que se mandan al endpoint. Cambiar cualquiera re-dispara el `resource`. */
  private readonly query = computed<PersonaListQuery>(() => {
    const f = this.applied();
    const rolid = Number(f.rolid);
    return {
      page: this.page(),
      page_size: this.pageSize(),
      q: f.q.trim(),
      nombre: f.nombre.trim(),
      apemat: f.apemat.trim(),
      // Los `<select>` devuelven `string`; los `as` los estrechan a los enums del contrato.
      // Es seguro porque las únicas opciones que pinta la plantilla son esas (más `''`).
      tipo: f.tipo as TipoPersona | '',
      // El `<select>` devuelve texto; el contrato pide un entero. `''` → `undefined` (sin filtro).
      rolid: Number.isFinite(rolid) && rolid > 0 ? rolid : undefined,
      sexo: f.sexo as 'M' | 'F' | '',
      estado: f.estado as Flag | '',
      con_foto: f.con_foto as Flag | '',
      orderby: f.orderby as PersonaOrderBy | '',
    };
  });

  private readonly personas = resource({
    params: () => this.query(),
    loader: ({ params }) => firstValueFrom(this.api.list(params)),
  });

  /**
   * Lista de trabajo: copia editable del resultado. Existe para poder alternar el estado de
   * forma optimista sin esperar a que el backend confirme ni recargar toda la página.
   */
  private readonly items = linkedSignal<PersonaListRow[]>(() => this.personas.value()?.data ?? []);
  protected readonly rows = this.items;

  protected readonly loading = this.personas.isLoading;
  protected readonly error = computed(() => {
    const e = this.personas.error();
    return e instanceof Error ? e.message : e ? 'No se pudo cargar el listado de personas.' : null;
  });

  /**
   * Meta del pie de grilla. `page`/`pageSize` salen de nuestras señales (es lo que acabamos de
   * pedir: evita el parpadeo mientras llega la respuesta); `total` viene del backend y de ahí
   * se deriva el número de páginas.
   */
  protected readonly meta = computed<PageMeta>(() => {
    const page = this.page();
    const pageSize = this.pageSize();
    const total = this.personas.value()?.meta.total ?? 0;
    const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1;
    return { page, pageSize, total, totalPages };
  });

  protected onApply(): void {
    this.applied.set(this.filters.getRawValue());
    this.page.set(1);
    this.selected.set([]); // otras filas: la selección previa ya no significa nada
    this.personas.reload(); // re-consulta aunque los filtros no hayan cambiado
  }

  protected onClear(): void {
    this.filters.reset();
    this.onApply();
  }

  protected onPage(p: number): void {
    this.page.set(p);
    this.selected.set([]);
  }

  protected onPageSize(ps: number): void {
    this.pageSize.set(ps);
    this.page.set(1);
    this.selected.set([]);
  }

  // ── Selección de filas (borrado en lote) ────────────────────────────
  protected readonly selected = signal<PersonaListRow[]>([]);

  protected onSelectionChange(rows: PersonaListRow[]): void {
    this.selected.set(rows);
  }

  // ── Columnas ────────────────────────────────────────────────────────
  // Sin `sortable`: el ordenamiento del `erp-data-grid` es de CLIENTE y aquí solo ordenaría
  // la página en curso, que con paginación de servidor engaña. El orden lo decide el backend
  // por el filtro `orderby`.
  protected readonly columns: GridColumn<PersonaListRow>[] = [
    { key: 'personaid', header: 'ID', width: '70px', align: 'right', mono: true },
    { key: 'foto', header: '', width: '56px' },
    { key: 'dni_ruc', header: 'DNI / RUC', width: '130px', mono: true },
    { key: 'nombre_persona', header: 'Nombre' },
    { key: 'rol', header: 'Rol', width: '150px' },
    { key: 'email', header: 'Email' },
    { key: 'telefono', header: 'Teléfono', width: '130px' },
    { key: 'estado', header: 'Estado', width: '110px' },
  ];

  // ── Avatar de la fila ───────────────────────────────────────────────
  /**
   * IDs cuya foto no cargó (archivo borrado, ruta mal configurada, red caída…). Sin esto el
   * navegador pinta el icono de imagen rota y la fila cambia de alto; con esto cae a la silueta,
   * que ocupa exactamente la misma caja.
   */
  private readonly fotoRota = signal<ReadonlySet<number>>(new Set<number>());

  /**
   * URL de la foto, o `null` si la persona no tiene, si aún no se sabe dónde se sirven las
   * fotos (`PERSONA_FOTO_BASE_URL` sin proveer) o si esta en concreto ya falló al cargar.
   * En los tres casos la celda pinta la silueta.
   */
  protected fotoUrl(row: PersonaListRow): string | null {
    if (this.fotoRota().has(row.personaid)) return null;
    return this.api.fotoUrl(row.foto);
  }

  protected onFotoError(row: PersonaListRow): void {
    this.fotoRota.update((s) => new Set(s).add(row.personaid));
  }

  /** Silueta que sustituye a la foto: edificio si es jurídica, persona según sexo si es natural. */
  protected avatarIcon(row: PersonaListRow): string {
    // El backend manda `sexo: 'PJ'` en las jurídicas, pero `tipo` ya lo dice y es obligatorio.
    if (row.tipo === 'J') return 'building';
    if (row.sexo === 'M') return 'user-male';
    if (row.sexo === 'F') return 'user-female';
    return 'user';
  }

  // ── Estado ──────────────────────────────────────────────────────────
  /**
   * Alterna el estado de la fila de forma optimista: refleja el cambio al instante y lo revierte
   * si el backend falla (el `error-interceptor` ya notificó el motivo).
   *
   * El endpoint es un TOGGLE, no un setter: no se le manda el valor deseado. Pero SÍ devuelve el
   * estado resultante, así que al confirmar se pinta lo que dice el backend en vez de mantener la
   * suposición — si otro usuario lo cambió entre medias, la fila queda correcta.
   */
  protected async onToggleEstado(row: PersonaListRow): Promise<void> {
    this.patchRow(row.personaid, { estado: !row.estado });
    try {
      const resultado = await firstValueFrom(this.api.alternarEstado(row.personaid));
      if (typeof resultado?.estado === 'boolean') {
        this.patchRow(row.personaid, { estado: resultado.estado });
      }
    } catch {
      this.patchRow(row.personaid, { estado: row.estado });
    }
  }

  private patchRow(personaid: number, patch: Partial<PersonaListRow>): void {
    this.items.update((list) =>
      list.map((it) => (it.personaid === personaid ? { ...it, ...patch } : it)),
    );
  }

  // ── Eliminación ─────────────────────────────────────────────────────
  protected async onDelete(row: PersonaListRow): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Eliminar persona',
      message: `¿Eliminar a "${row.nombre_persona}"? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await firstValueFrom(this.api.remove(row.personaid));
      this.notify.success(`Se eliminó "${row.nombre_persona}".`);
      this.personas.reload();
    } catch {
      // 409 (tiene ventas o salidas relacionadas) y demás fallos: el `error-interceptor` ya
      // mostró el `message` del backend, que en 4xx es seguro. Repetirlo aquí duplicaría el toast.
      this.personas.reload();
    }
  }

  /**
   * Borrado en lote contra `POST /personas/lote/eliminar`: UNA petición, no N. El endpoint
   * responde 200 con el resultado por id porque el lote es parcial por diseño — una persona
   * puede fallar por tener ventas relacionadas mientras el resto sí se borra —, así que el
   * saldo se lee de las filas y no del código HTTP.
   */
  protected async onDeleteSelected(): Promise<void> {
    const rows = this.selected();
    if (rows.length === 0) return;
    const ok = await this.confirm.ask({
      title: 'Eliminar personas',
      message: `¿Eliminar ${rows.length} persona(s) seleccionada(s)? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      tone: 'danger',
    });
    if (!ok) return;

    try {
      const resultados = await firstValueFrom(
        this.api.removeLote(rows.map((r) => r.personaid)),
      );
      const fallos = resultados.filter((r) => !r.ok);
      const eliminadas = resultados.length - fallos.length;

      if (eliminadas > 0) this.notify.success(`Se eliminaron ${eliminadas} registro(s).`);
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
    this.selected.set([]);
    this.personas.reload();
  }
}
