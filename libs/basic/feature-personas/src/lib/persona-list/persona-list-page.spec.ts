import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { PersonaApi, RolApi } from '@phoenix/basic/data-access';
import type { PersonaListQuery, PersonaListRow, ResultadoLote, Rol } from '@phoenix/basic/domain';
import { ConfirmService, NotificationService } from '@phoenix/shared/ui';
import { PersonaListPage } from './persona-list-page';

function fila(over: Partial<PersonaListRow> = {}): PersonaListRow {
  return {
    personaid: 1,
    tipo: 'N',
    dni_ruc: '40404040',
    nombre_persona: 'PEREZ LOPEZ, JUAN',
    direccion: 'Av. Siempre Viva 742',
    telefono: '999888777',
    email: 'juan@ejemplo.pe',
    rol: 'CLIENTE',
    sexo: 'M',
    foto: '',
    nacimiento: '1980-01-01',
    paisid: 51,
    pais_nombre: 'Perú',
    pais_bandera: 'pe.svg',
    estado: true,
    ...over,
  };
}

/** Doble del API: registra lo que se le pide y devuelve lo que se le configure. */
class PersonaApiMock {
  readonly listCalls: PersonaListQuery[] = [];
  readonly alternados: number[] = [];
  readonly eliminados: number[] = [];
  readonly lotes: readonly number[][] = [];
  rows: PersonaListRow[] = [fila(), fila({ personaid: 2, nombre_persona: 'ACME S.A.C.' })];
  /** Estado que devuelve `alternarEstado` (el contrato manda el resultante, no se supone). */
  estadoResultante = false;
  /** Resultado por id del lote; por defecto todo OK. */
  loteResultado: ResultadoLote[] | null = null;
  /** Base de fotos configurada; vacía = no se sabe dónde se sirven. */
  fotoBase = '';

  list(query: PersonaListQuery) {
    this.listCalls.push(query);
    return of({
      data: this.rows,
      meta: { page: query.page, pageSize: query.page_size, total: this.rows.length, totalPages: 1 },
    });
  }

  fotoUrl(foto: string): string | null {
    if (!foto || !this.fotoBase) return null;
    return `${this.fotoBase}${foto}`;
  }

  alternarEstado(personaid: number) {
    this.alternados.push(personaid);
    return of({ personaid, estado: this.estadoResultante });
  }

  remove(personaid: number) {
    this.eliminados.push(personaid);
    return of(undefined as unknown as void);
  }

  removeLote(ids: readonly number[]) {
    (this.lotes as number[][]).push([...ids]);
    return of(this.loteResultado ?? ids.map((personaid) => ({ personaid, ok: true })));
  }
}

class RolApiMock {
  list() {
    return of<Rol[]>([{ rolid: 7, nombre: 'CLIENTE', tipopersona: 'N' }]);
  }
}

async function setup(api = new PersonaApiMock()) {
  TestBed.configureTestingModule({
    imports: [PersonaListPage],
    providers: [
      // `erp-page-header` monta los breadcrumbs, que leen la ruta activa.
      provideRouter([]),
      { provide: PersonaApi, useValue: api },
      { provide: RolApi, useClass: RolApiMock },
    ],
  });
  const fixture = TestBed.createComponent(PersonaListPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, api, el: fixture.nativeElement as HTMLElement };
}

/**
 * Deja correr las promesas pendientes y repinta. Las acciones de la pantalla encadenan varios
 * `await` (confirmación → petición → notificación), así que un solo `whenStable` se queda corto.
 */
async function asentar(fixture: { whenStable(): Promise<unknown>; detectChanges(): void }) {
  for (let i = 0; i < 3; i++) {
    await fixture.whenStable();
    fixture.detectChanges();
  }
}

/** Última query enviada al backend. */
function ultimaQuery(api: PersonaApiMock): PersonaListQuery {
  return api.listCalls[api.listCalls.length - 1];
}

function celdas(el: HTMLElement, colIndex: number): string[] {
  // +1: la primera celda es el checkbox de selección.
  return Array.from(el.querySelectorAll('tbody tr')).map(
    (tr) => tr.querySelectorAll('td')[colIndex + 1]?.textContent?.trim() ?? '',
  );
}

describe('PersonaListPage', () => {
  it('pide la primera página con el tamaño por defecto y sin filtros', async () => {
    const { api } = await setup();
    expect(ultimaQuery(api)).toMatchObject({ page: 1, page_size: 25 });
  });

  it('pinta las filas del backend', async () => {
    const { el } = await setup();
    expect(celdas(el, 0)).toEqual(['1', '2']);
    expect(celdas(el, 3)).toEqual(['PEREZ LOPEZ, JUAN', 'ACME S.A.C.']);
  });

  it('sin foto usa el avatar por defecto, sin <img> que rompa el alto de la fila', async () => {
    const { el } = await setup();
    expect(el.querySelectorAll('tbody .avatar--vacio').length).toBe(2);
    expect(el.querySelectorAll('tbody img').length).toBe(0);
  });

  it('con nombre de foto pero sin base configurada tampoco pinta <img>', async () => {
    // `foto` es un nombre de archivo: sin saber dónde se sirve, una <img> daría 404.
    const api = new PersonaApiMock();
    api.rows = [fila({ foto: 'perfil-1.webp' })];
    const { el } = await setup(api);
    expect(el.querySelectorAll('tbody img').length).toBe(0);
    expect(el.querySelectorAll('tbody .avatar--vacio').length).toBe(1);
  });

  it('con base configurada resuelve el nombre de archivo a una URL', async () => {
    const api = new PersonaApiMock();
    api.fotoBase = '/media/personas/';
    api.rows = [fila({ foto: 'perfil-1.webp' })];
    const { el } = await setup(api);
    const img = el.querySelector('tbody img') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('/media/personas/perfil-1.webp');
    expect(el.querySelectorAll('tbody .avatar--vacio').length).toBe(0);
  });

  it('"Buscar" manda los filtros con valor y omite los que quedaron en "Todos"', async () => {
    const { fixture, api, el } = await setup();
    const componente = fixture.componentInstance as unknown as {
      filters: { patchValue(v: Record<string, string>): void };
    };
    componente.filters.patchValue({ q: '  perez  ', estado: 'Y', tipo: 'J' });
    (el.querySelector('.field--action .btn') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();

    const query = ultimaQuery(api);
    expect(query.q).toBe('perez'); // recortado
    expect(query.estado).toBe('Y');
    expect(query.tipo).toBe('J');
    expect(query.sexo).toBe(''); // "Todos" → el data-access lo omite de la URL
    expect(query.page).toBe(1);
  });

  it('el toggle de estado llama al endpoint sin mandarle el valor', async () => {
    const { fixture, api, el } = await setup();
    const badge = el.querySelector('tbody .badge') as HTMLButtonElement;
    expect(badge.textContent?.trim()).toBe('Activo');

    badge.click();
    fixture.detectChanges();

    // El endpoint es un TOGGLE: solo recibe el id.
    expect(api.alternados).toEqual([1]);
    expect((el.querySelector('tbody .badge') as HTMLElement).textContent?.trim()).toBe('Inactivo');
  });

  it('se queda con el estado que devuelve el backend, no con el que supuso', async () => {
    const api = new PersonaApiMock();
    // Otro usuario ya lo había desactivado: el toggle lo deja ACTIVO, no inactivo.
    api.estadoResultante = true;
    const { fixture, el } = await setup(api);

    (el.querySelector('tbody .badge') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect((el.querySelector('tbody .badge') as HTMLElement).textContent?.trim()).toBe('Activo');
  });

  it('no elimina si el usuario cancela la confirmación', async () => {
    const { fixture, api, el } = await setup();
    vi.spyOn(TestBed.inject(ConfirmService), 'ask').mockResolvedValue(false);

    (el.querySelector('.col-actions .grid-action') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(api.eliminados).toEqual([]);
  });

  it('elimina la fila tras confirmar', async () => {
    const { fixture, api, el } = await setup();
    vi.spyOn(TestBed.inject(ConfirmService), 'ask').mockResolvedValue(true);

    (el.querySelector('.col-actions .grid-action') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(api.eliminados).toEqual([1]);
  });

  it('el borrado en lote va en UNA petición con todos los ids, no N deletes', async () => {
    const { fixture, api, el } = await setup();
    vi.spyOn(TestBed.inject(ConfirmService), 'ask').mockResolvedValue(true);

    // Checkbox de cabecera: selecciona las dos filas visibles.
    (el.querySelector('thead .col-select input') as HTMLInputElement).click();
    fixture.detectChanges();

    const lote = el.querySelector('[filterActions] .btn--danger') as HTMLButtonElement;
    expect(lote.textContent).toContain('(2)');

    lote.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(api.lotes).toEqual([[1, 2]]);
    expect(api.eliminados).toEqual([]); // no cae al endpoint de uno en uno
  });

  it('un lote parcial avisa de las que no se pudieron eliminar con el motivo del backend', async () => {
    const api = new PersonaApiMock();
    api.loteResultado = [
      { personaid: 1, ok: true },
      { personaid: 2, ok: false, codigo: 'persona_has_relations', mensaje: 'Tiene ventas.' },
    ];
    const { fixture, el } = await setup(api);
    vi.spyOn(TestBed.inject(ConfirmService), 'ask').mockResolvedValue(true);
    const notify = TestBed.inject(NotificationService);
    const error = vi.spyOn(notify, 'error');
    const success = vi.spyOn(notify, 'success');

    (el.querySelector('thead .col-select input') as HTMLInputElement).click();
    fixture.detectChanges();
    (el.querySelector('[filterActions] .btn--danger') as HTMLButtonElement).click();
    await asentar(fixture);

    expect(success).toHaveBeenCalledWith('Se eliminaron 1 registro(s).');
    expect(error).toHaveBeenCalledWith(expect.stringContaining('Tiene ventas.'));
  });
});
