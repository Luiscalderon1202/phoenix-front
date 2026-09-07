import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LEGACY_BASE_URL } from '@phoenix/shared/http';
import { GRUPOS_TABLAS } from './tablas';
import { TablasBasicasPage } from './tablas-basicas-page';

async function setup(legacyBase = '') {
  TestBed.configureTestingModule({
    imports: [TablasBasicasPage],
    providers: [
      // `erp-page-header` monta los breadcrumbs, que leen la ruta activa.
      provideRouter([]),
      { provide: LEGACY_BASE_URL, useValue: legacyBase },
    ],
  });
  const fixture = TestBed.createComponent(TablasBasicasPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

function comp(fixture: { componentInstance: unknown }) {
  return fixture.componentInstance as unknown as {
    onBuscar(v: string): void;
    onLimpiar(): void;
    busqueda(): string;
  };
}

function titulos(el: HTMLElement): string[] {
  return Array.from(el.querySelectorAll('.opcion__titulo')).map(
    (n) => n.textContent?.trim() ?? '',
  );
}

describe('catálogo de tablas básicas', () => {
  const opciones = GRUPOS_TABLAS.flatMap((g) => g.opciones);

  it('replica las 40 opciones de TablasBasicas.php en sus 11 grupos', () => {
    expect(GRUPOS_TABLAS.length).toBe(11);
    expect(opciones.length).toBe(40);
  });

  it('cada opción apunta a Angular o al PHP, nunca a los dos ni a ninguno', () => {
    // Es la invariante del hub: una tabla está migrada o no lo está.
    for (const o of opciones) {
      expect(!!o.ruta !== !!o.legacy, `«${o.titulo}» debe tener ruta o legacy, no ambas`).toBe(
        true,
      );
    }
  });

  it('no hay títulos repetidos: son la clave del render', () => {
    expect(new Set(opciones.map((o) => o.titulo)).size).toBe(opciones.length);
  });

  it('las rutas del legacy son absolutas desde la raíz del PHP', () => {
    // Relativas ('TipoEmpresa.php') resolverían contra la URL de Angular y darían 404.
    for (const o of opciones) {
      if (o.legacy) expect(o.legacy.startsWith('/admin/interfaz/')).toBe(true);
    }
  });
});

describe('TablasBasicasPage', () => {
  it('pinta las 40 tarjetas agrupadas', async () => {
    const { el } = await setup();
    expect(el.querySelectorAll('.opcion').length).toBe(40);
    expect(el.querySelectorAll('.grupo').length).toBe(11);
  });

  it('las migradas navegan por routerLink y las demás salen al PHP', async () => {
    const { el } = await setup();
    const externas = el.querySelectorAll('.opcion--externa');
    // El recuento se deriva del propio catálogo: así el test sigue valiendo según
    // se vayan migrando tablas, en vez de fijar un número que caduca cada lote.
    const migradas = GRUPOS_TABLAS.flatMap((g) => g.opciones).filter((o) => o.ruta).length;
    expect(externas.length).toBe(40 - migradas);
    expect(el.querySelectorAll('.opcion').length - externas.length).toBe(migradas);
  });

  it('antepone la raíz del legacy cuando el PHP vive en otro host', async () => {
    const { el } = await setup('http://localhost/pseraphis');
    const href = el.querySelector('.opcion--externa')?.getAttribute('href');
    expect(href?.startsWith('http://localhost/pseraphis/admin/interfaz/')).toBe(true);
  });

  it('sin raíz configurada usa la ruta absoluta tal cual (mismo host)', async () => {
    const { el } = await setup();
    const href = el.querySelector('.opcion--externa')?.getAttribute('href');
    expect(href?.startsWith('/admin/interfaz/')).toBe(true);
  });

  it('la tabla migrada apunta a su ruta de Angular', async () => {
    const { el } = await setup();
    const interna = el.querySelector('.opcion:not(.opcion--externa)');
    expect(interna?.getAttribute('href')).toBe('/mantenimiento/tipos-empresa');
  });

  it('filtra por nombre de catálogo', async () => {
    const { fixture, el } = await setup();
    comp(fixture).onBuscar('empresa');
    fixture.detectChanges();

    const encontrados = titulos(el);
    expect(encontrados).toContain('Tipos de empresa');
    expect(encontrados).toContain('Sub tipos de empresa');
    expect(encontrados.length).toBeLessThan(40);
  });

  it('buscar por el nombre del grupo devuelve todas sus tablas', async () => {
    // Quien escribe "tesorería" espera sus cinco tablas, aunque ninguna se llame así.
    const { fixture, el } = await setup();
    comp(fixture).onBuscar('tesorería');
    fixture.detectChanges();

    expect(el.querySelectorAll('.grupo').length).toBe(1);
    expect(el.querySelectorAll('.opcion').length).toBe(5);
  });

  it('no deja encabezados de grupo huérfanos sobre un hueco', async () => {
    const { fixture, el } = await setup();
    comp(fixture).onBuscar('empresa');
    fixture.detectChanges();

    for (const grupo of Array.from(el.querySelectorAll('.grupo'))) {
      expect(grupo.querySelectorAll('.opcion').length).toBeGreaterThan(0);
    }
  });

  it('avisa cuando nada coincide', async () => {
    const { fixture, el } = await setup();
    comp(fixture).onBuscar('zzzz');
    fixture.detectChanges();

    expect(el.querySelectorAll('.opcion').length).toBe(0);
    expect(el.querySelector('.vacio')).not.toBeNull();
  });

  it('limpiar restituye las 40', async () => {
    const { fixture, el } = await setup();
    comp(fixture).onBuscar('zzzz');
    fixture.detectChanges();
    comp(fixture).onLimpiar();
    fixture.detectChanges();

    expect(el.querySelectorAll('.opcion').length).toBe(40);
  });

  it('muestra el avance de la migración', async () => {
    const { el } = await setup();
    const migradas = GRUPOS_TABLAS.flatMap((g) => g.opciones).filter((o) => o.ruta).length;
    expect(el.querySelector('.avance')?.textContent?.trim()).toBe(`${migradas} de 40 migradas`);
  });
});
