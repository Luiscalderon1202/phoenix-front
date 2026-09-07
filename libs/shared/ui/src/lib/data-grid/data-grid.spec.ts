import { TestBed } from '@angular/core/testing';
import { DataGrid, type GridColumn } from './data-grid';

interface Fila {
  nombre: string | null;
  monto: number | null;
}

const COLUMNS: GridColumn<Fila>[] = [
  { key: 'nombre', header: 'Nombre', sortable: true },
  { key: 'monto', header: 'Monto', align: 'right', sortable: true },
];

// Incluye vacíos (null y ''), un número que en texto ordenaría mal ("10" < "9")
// y una tilde, que son los tres casos donde un comparador ingenuo falla.
const ROWS: Fila[] = [
  { nombre: 'Ítem 10', monto: 5 },
  { nombre: 'ítem 9', monto: null },
  { nombre: null, monto: 100 },
  { nombre: 'Ábaco', monto: 20 },
];

function setup(rows: Fila[] = ROWS) {
  TestBed.configureTestingModule({ imports: [DataGrid] });
  const fixture = TestBed.createComponent<DataGrid<Fila>>(DataGrid);
  fixture.componentRef.setInput('columns', COLUMNS);
  fixture.componentRef.setInput('rows', rows);
  fixture.detectChanges();
  return fixture;
}

/** Texto de la primera celda de cada fila, en el orden en que se pinta. */
function columnaVisible(fixture: ReturnType<typeof setup>, colIndex = 0): string[] {
  return Array.from(fixture.nativeElement.querySelectorAll('tbody tr')).map(
    (tr) => (tr as HTMLElement).querySelectorAll('td')[colIndex].textContent?.trim() ?? '',
  );
}

function clickHeader(fixture: ReturnType<typeof setup>, colIndex: number): void {
  const headers = fixture.nativeElement.querySelectorAll('thead th .sort');
  (headers[colIndex] as HTMLButtonElement).click();
  fixture.detectChanges();
}

describe('DataGrid — ordenamiento de cliente', () => {
  it('respeta el orden de llegada mientras no se ordene', () => {
    const fixture = setup();
    expect(columnaVisible(fixture)).toEqual(['Ítem 10', 'ítem 9', '', 'Ábaco']);
  });

  it('ordena texto con criterio local: tildes e "Ítem 9" antes que "Ítem 10"', () => {
    const fixture = setup();
    clickHeader(fixture, 0);
    // 'Ábaco' primero pese a la tilde; el 9 antes que el 10 pese a ser texto.
    expect(columnaVisible(fixture)).toEqual(['Ábaco', 'ítem 9', 'Ítem 10', '']);
  });

  it('deja los vacíos al final TAMBIÉN al invertir el sentido', () => {
    const fixture = setup();
    clickHeader(fixture, 0); // asc
    clickHeader(fixture, 0); // desc
    const visible = columnaVisible(fixture);
    expect(visible.at(-1)).toBe(''); // el vacío no sube al invertir
    expect(visible.slice(0, 3)).toEqual(['Ítem 10', 'ítem 9', 'Ábaco']);
  });

  it('al tercer clic quita el orden y vuelve al de llegada', () => {
    const fixture = setup();
    clickHeader(fixture, 0);
    clickHeader(fixture, 0);
    clickHeader(fixture, 0);
    expect(columnaVisible(fixture)).toEqual(['Ítem 10', 'ítem 9', '', 'Ábaco']);
  });

  it('ordena los números como números, no como texto', () => {
    const fixture = setup();
    clickHeader(fixture, 1);
    expect(columnaVisible(fixture, 1)).toEqual(['5', '20', '100', '']);
  });

  it('publica aria-sort en la columna activa y lo deja en none en las demás', () => {
    const fixture = setup();
    clickHeader(fixture, 0);
    const ths = fixture.nativeElement.querySelectorAll('thead th');
    expect(ths[0].getAttribute('aria-sort')).toBe('ascending');
    expect(ths[1].getAttribute('aria-sort')).toBe('none');
  });
});

// ── Agrupación expandible (opt-in con [groupBy]) ─────────────────────────────

interface Cuenta {
  grupo: string;
  cuenta: string;
  monto: number;
}

const CUENTAS_COLUMNS: GridColumn<Cuenta>[] = [
  { key: 'cuenta', header: 'Cuenta', sortable: true },
  {
    key: 'monto',
    header: 'Monto',
    align: 'right',
    sortable: true,
    groupCell: (rows) => String(rows.reduce((acc, r) => acc + r.monto, 0)),
  },
];

const CUENTAS: Cuenta[] = [
  { grupo: 'ACTIVO', cuenta: '10', monto: 100 },
  { grupo: 'PASIVO', cuenta: '40', monto: 7 },
  { grupo: 'ACTIVO', cuenta: '12', monto: 20 },
];

function setupGrupos(collapsed = true) {
  TestBed.configureTestingModule({ imports: [DataGrid] });
  const fixture = TestBed.createComponent<DataGrid<Cuenta>>(DataGrid);
  fixture.componentRef.setInput('columns', CUENTAS_COLUMNS);
  fixture.componentRef.setInput('rows', CUENTAS);
  fixture.componentRef.setInput('groupBy', 'grupo');
  fixture.componentRef.setInput('groupsCollapsed', collapsed);
  fixture.detectChanges();
  return fixture;
}

/**
 * Celda `colIndex` de cada `<tr>` del cuerpo, con las filas de grupo entre corchetes. En la
 * primera columna del grupo se lee solo el rótulo (`.group-name`), sin el contador.
 */
function filasVisibles(fixture: ReturnType<typeof setupGrupos>, colIndex = 0): string[] {
  return Array.from(fixture.nativeElement.querySelectorAll('tbody tr')).map((tr) => {
    const el = tr as HTMLElement;
    const celda = el.querySelectorAll('td')[colIndex];
    if (!el.classList.contains('group-tr')) return celda.textContent?.trim() ?? '';
    const rotulo = celda.querySelector('.group-name') ?? celda;
    return `[${rotulo.textContent?.trim() ?? ''}]`;
  });
}

describe('DataGrid — agrupación expandible', () => {
  it('pinta una fila por grupo, colapsada, en orden de primera aparición', () => {
    const fixture = setupGrupos();
    expect(filasVisibles(fixture)).toEqual(['[ACTIVO]', '[PASIVO]']);
  });

  it('rotula cada grupo con cuántas filas contiene', () => {
    const fixture = setupGrupos();
    const contadores = Array.from(
      fixture.nativeElement.querySelectorAll('tbody tr.group-tr .group-count'),
    ).map((el) => (el as HTMLElement).textContent?.trim());
    expect(contadores).toEqual(['2', '1']);
  });

  it('totaliza cada grupo con el `groupCell` de la columna', () => {
    const fixture = setupGrupos();
    expect(filasVisibles(fixture, 1)).toEqual(['[120]', '[7]']);
  });

  it('despliega solo el grupo pulsado', () => {
    const fixture = setupGrupos();
    (fixture.nativeElement.querySelectorAll('tbody tr.group-tr')[0] as HTMLElement).click();
    fixture.detectChanges();
    expect(filasVisibles(fixture)).toEqual(['[ACTIVO]', '10', '12', '[PASIVO]']);
  });

  it('arranca con todo abierto si `groupsCollapsed` es false', () => {
    const fixture = setupGrupos(false);
    expect(filasVisibles(fixture)).toEqual(['[ACTIVO]', '10', '12', '[PASIVO]', '40']);
  });

  it('el botón de la cabecera abre y cierra todos los grupos', () => {
    const fixture = setupGrupos();
    const todos = fixture.nativeElement.querySelector('thead th .group-all') as HTMLButtonElement;
    todos.click();
    fixture.detectChanges();
    expect(filasVisibles(fixture)).toEqual(['[ACTIVO]', '10', '12', '[PASIVO]', '40']);
    todos.click();
    fixture.detectChanges();
    expect(filasVisibles(fixture)).toEqual(['[ACTIVO]', '[PASIVO]']);
  });

  it('mantiene los grupos abiertos al ordenar una columna', () => {
    const fixture = setupGrupos(false);
    clickHeader(fixture as never, 0); // asc por cuenta
    // Sigue abierto y el orden reordena tanto los grupos como sus filas.
    expect(filasVisibles(fixture)).toEqual(['[ACTIVO]', '10', '12', '[PASIVO]', '40']);
  });
});
