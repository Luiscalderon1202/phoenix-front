import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { PersonaApi, ReferenciaApi, RolApi } from '@phoenix/basic/data-access';
import type { PersonaFicha, PersonaInput } from '@phoenix/basic/domain';
import { ConfirmService, NotificationService } from '@phoenix/shared/ui';
import { PersonaFormPage } from './persona-form-page';

function ficha(over: Partial<PersonaFicha> = {}): PersonaFicha {
  return {
    personaid: 7,
    tipo: 'N',
    direccion: 'AV TEST 100',
    distritoid: 1219,
    paisid: 1,
    estado: true,
    registro: '24/08/2026',
    titulo: '',
    ape_pat: 'PEREZ',
    ape_mat: 'GOMEZ',
    nombre: 'JUAN',
    sexo: 'M',
    est_civil: 'S',
    nacimiento: '1990-05-14',
    raz_soc: '',
    nombre_comercial: '',
    distrito_nombre: 'JOSE LEONARDO ORTIZ',
    provinciaid: 124,
    provincia_nombre: 'CHICLAYO',
    departamentoid: 13,
    departamento_nombre: 'LAMBAYEQUE',
    pais_nombre: 'PERU',
    foto: '',
    telefonos: [
      {
        telefonoid: 55,
        personaid: 7,
        tipoid: 2,
        tipo_nombre: 'Movil',
        tipo_requerido: false,
        numero: '999111222',
        nombre: 'CEL',
        main: true,
        publico: false,
      },
    ],
    emails: [
      {
        emailid: 33,
        personaid: 7,
        tipoid: 1,
        tipo_nombre: 'Personal',
        tipo_requerido: false,
        email: 'juan@test.local',
        nombre: '',
        main: true,
        publico: false,
      },
    ],
    social_media: [
      { personaid: 7, tipoid: 1, tipo_nombre: 'Facebook', tipo_url: 'https://fb/', usuario: 'juanp' },
    ],
    documentos: [
      {
        personaid: 7,
        tipoid: 1,
        tipo_nombre: 'DNI',
        numero: '12345678',
        tipo_nombre_numero: 'DNI 12345678',
        main: true,
      },
    ],
    roles: [3],
    ...over,
  };
}

class PersonaApiMock {
  readonly fichasPedidas: number[] = [];
  readonly creados: PersonaInput[] = [];
  readonly actualizados: { id: number; input: PersonaInput }[] = [];
  fallarGuardado = false;
  fallarFicha = false;

  get(personaid: number) {
    this.fichasPedidas.push(personaid);
    if (this.fallarFicha) return throwError(() => new Error('500'));
    return of(ficha({ personaid }));
  }

  create(input: PersonaInput) {
    this.creados.push(input);
    if (this.fallarGuardado) return throwError(() => new Error('403'));
    return of(ficha({ personaid: 99 }));
  }

  update(id: number, input: PersonaInput) {
    this.actualizados.push({ id, input });
    if (this.fallarGuardado) return throwError(() => new Error('409'));
    return of(ficha({ personaid: id }));
  }
}

class ReferenciaApiMock {
  paises() {
    return of([{ paisid: 1, nombre: 'PERU' }] as never);
  }
  tiposTelefono() {
    return of([
      { tipoid: 1, nombre: 'Fijo', requerido: false, pordefecto: false, orden: 1, estado: true },
      { tipoid: 2, nombre: 'Movil', requerido: false, pordefecto: true, orden: 2, estado: true },
    ] as never);
  }
  tiposEmail() {
    return of([
      { tipoid: 1, nombre: 'Personal', requerido: false, pordefecto: true, orden: 1, estado: true },
    ] as never);
  }
  tiposRedSocial() {
    return of([{ tipoid: 1, nombre: 'Facebook', url: 'https://fb/', icono: '', orden: 1, estado: true }] as never);
  }
  tiposID() {
    return of([
      { tipoid: 1, nombre: 'DNI', abreviatura: 'DNI', codigo_contable: '1', longitud: 8, tipopersona: 'N', orden: 1, estado: true },
      { tipoid: 2, nombre: 'RUC', abreviatura: 'RUC', codigo_contable: '6', longitud: 11, tipopersona: 'J', orden: 2, estado: true },
    ] as never);
  }
  distritos(opts: { q?: string } = {}) {
    const q = (opts.q ?? '').trim();
    if (q.length < 2) return of([]);
    return of([
      {
        distritoid: 1219,
        nombre: 'JOSE LEONARDO ORTIZ',
        provinciaid: 124,
        provincia: 'CHICLAYO',
        departamentoid: 13,
        departamento: 'LAMBAYEQUE',
        ubigeo: '140102',
      },
    ] as never);
  }
}

class RolApiMock {
  list() {
    return of([
      { rolid: 3, nombre: 'CLIENTE' },
      { rolid: 4, nombre: 'PROVEEDOR' },
    ] as never);
  }
}

class ConfirmServiceMock {
  respuesta = true;
  ask() {
    return Promise.resolve(this.respuesta);
  }
}

class NotificationServiceMock {
  readonly exitos: string[] = [];
  readonly errores: string[] = [];
  success(m: string) {
    this.exitos.push(m);
  }
  error(m: string) {
    this.errores.push(m);
  }
}

/** `id` null monta el alta; con valor, la edición de esa persona. */
async function setup(id: string | null, api = new PersonaApiMock()) {
  const notify = new NotificationServiceMock();
  const confirm = new ConfirmServiceMock();

  TestBed.configureTestingModule({
    imports: [PersonaFormPage],
    providers: [
      // ⚠ Con `provideRouter([])` cada `navigate` al listado rechazaba con un 4002 y
      // ensuciaba la corrida con errores no capturados: la ruta destino tiene que
      // existir en el arnés.
      provideRouter([{ path: 'mantenimiento/personas', children: [] }]),
      { provide: PersonaApi, useValue: api },
      { provide: ReferenciaApi, useValue: new ReferenciaApiMock() },
      { provide: RolApi, useValue: new RolApiMock() },
      { provide: ConfirmService, useValue: confirm },
      { provide: NotificationService, useValue: notify },
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: { get: () => id } } },
      },
    ],
  });

  const fixture = TestBed.createComponent(PersonaFormPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, api, notify, confirm, el: fixture.nativeElement as HTMLElement };
}

async function asentar(fixture: { whenStable(): Promise<unknown>; detectChanges(): void }) {
  for (let i = 0; i < 4; i++) {
    await fixture.whenStable();
    fixture.detectChanges();
  }
}

function comp(fixture: { componentInstance: unknown }) {
  return fixture.componentInstance as unknown as Record<string, (...a: never[]) => unknown> & {
    form: {
      patchValue(v: unknown): void;
      getRawValue(): Record<string, unknown>;
      valid: boolean;
      controls: Record<string, { value: unknown; valid: boolean; setValue(v: unknown): void }>;
    };
    telefonos: { length: number; controls: unknown[]; getRawValue(): unknown[] };
    emails: { length: number; getRawValue(): unknown[] };
    redes: { length: number };
    documentos: { length: number };
    esEdicion(): boolean;
    esNatural(): boolean;
    titulo(): string;
    registro(): string;
    opcionesDistrito(): { distritoid: number; etiqueta: string }[];
    tieneRol(id: number): boolean;
  };
}

describe('PersonaFormPage · alta', () => {
  it('no pide ninguna ficha', async () => {
    const { fixture, api } = await setup(null);
    expect(api.fichasPedidas).toEqual([]);
    expect(comp(fixture).esEdicion()).toBe(false);
    expect(comp(fixture).titulo()).toBe('Nueva persona');
  });

  it('arranca como persona natural y con las listas vacías', async () => {
    const { fixture } = await setup(null);
    const c = comp(fixture);
    expect(c.esNatural()).toBe(true);
    expect(c.telefonos.length + c.emails.length + c.redes.length + c.documentos.length).toBe(0);
  });

  /**
   * ⚠ La regresión que costó un viaje a la base: `basic.persona_natural.nacimiento` es
   * NOT NULL. Sin este validador el alta reventaba con un 23502 que no decía qué faltaba.
   */
  it('exige la fecha de nacimiento a una persona NATURAL', async () => {
    const { fixture } = await setup(null);
    const c = comp(fixture);

    c.form.patchValue({
      tipo: 'N',
      ape_pat: 'PEREZ',
      nombre: 'JUAN',
      distritoid: 1219,
      paisid: 1,
      nacimiento: '',
    });
    expect(c.form.controls['nacimiento'].valid).toBe(false);
    expect(c.form.valid).toBe(false);

    c.form.patchValue({ nacimiento: '1990-05-14' });
    expect(c.form.valid).toBe(true);
  });

  it('NO se la exige a una persona jurídica', async () => {
    const { fixture } = await setup(null);
    const c = comp(fixture);

    c.form.patchValue({ tipo: 'J' });
    await asentar(fixture);
    c.form.patchValue({ raz_soc: 'CLIENTE S.A.C.', distritoid: 1219, paisid: 1, nacimiento: '' });

    expect(c.esNatural()).toBe(false);
    expect(c.form.valid).toBe(true);
  });

  it('cambia los obligatorios al cambiar de tipo', async () => {
    const { fixture } = await setup(null);
    const c = comp(fixture);

    // Natural: apellido y nombre obligatorios, razón social no.
    expect(c.form.controls['ape_pat'].valid).toBe(false);
    c.form.patchValue({ tipo: 'J' });
    await asentar(fixture);

    // Jurídica: al revés.
    expect(c.form.controls['ape_pat'].valid).toBe(true);
    expect(c.form.controls['raz_soc'].valid).toBe(false);
  });

  it('un formulario inválido no llega al backend', async () => {
    const { fixture, api, notify } = await setup(null);
    await (comp(fixture)['onGuardar'] as () => Promise<void>)();
    await asentar(fixture);

    expect(api.creados).toHaveLength(0);
    expect(notify.errores).toHaveLength(1);
  });

  it('al añadir un teléfono propone el tipo marcado «por defecto»', async () => {
    const { fixture } = await setup(null);
    const c = comp(fixture);

    (c['agregarTelefono'] as () => void)();
    // En el doble, «Movil» (tipoid 2) es el pordefecto.
    expect((c.telefonos.getRawValue()[0] as { tipoid: number }).tipoid).toBe(2);
  });

  it('un teléfono nuevo va con telefonoid 0, que es como el backend distingue el alta', async () => {
    const { fixture } = await setup(null);
    const c = comp(fixture);

    (c['agregarTelefono'] as () => void)();
    expect((c.telefonos.getRawValue()[0] as { telefonoid: number }).telefonoid).toBe(0);
  });

  it('limpia los campos del tipo que no aplica antes de mandar', async () => {
    const { fixture, api } = await setup(null);
    const c = comp(fixture);

    // Se rellena como natural y luego se cambia a jurídica: los apellidos no deben viajar.
    c.form.patchValue({ ape_pat: 'PEREZ', nombre: 'JUAN', nacimiento: '1990-05-14' });
    c.form.patchValue({ tipo: 'J' });
    await asentar(fixture);
    c.form.patchValue({ raz_soc: 'CLIENTE S.A.C.', distritoid: 1219, paisid: 1 });

    await (c['onGuardar'] as () => Promise<void>)();
    await asentar(fixture);

    expect(api.creados).toHaveLength(1);
    const enviado = api.creados[0];
    expect(enviado.raz_soc).toBe('CLIENTE S.A.C.');
    expect(enviado.ape_pat).toBe('');
    expect(enviado.nombre).toBe('');
    expect(enviado.nacimiento).toBe('');
  });

  it('manda SIEMPRE las cinco listas, aunque estén vacías', async () => {
    const { fixture, api } = await setup(null);
    const c = comp(fixture);

    c.form.patchValue({
      ape_pat: 'PEREZ',
      nombre: 'JUAN',
      nacimiento: '1990-05-14',
      distritoid: 1219,
      paisid: 1,
    });
    await (c['onGuardar'] as () => Promise<void>)();
    await asentar(fixture);

    // El backend guarda por reemplazo: omitir una lista no es «no la toques».
    const enviado = api.creados[0];
    for (const k of ['telefonos', 'emails', 'social_media', 'documentos', 'roles'] as const) {
      expect(Array.isArray(enviado[k])).toBe(true);
    }
  });
});

describe('PersonaFormPage · edición', () => {
  it('pide la ficha y la vuelca entera, listas incluidas', async () => {
    const { fixture, api } = await setup('7');
    const c = comp(fixture);

    expect(api.fichasPedidas).toEqual([7]);
    expect(c.titulo()).toBe('Editar persona');
    expect(c.form.getRawValue()['ape_pat']).toBe('PEREZ');
    expect(c.telefonos.length).toBe(1);
    expect(c.emails.length).toBe(1);
    expect(c.redes.length).toBe(1);
    expect(c.documentos.length).toBe(1);
    expect(c.tieneRol(3)).toBe(true);
    expect(c.tieneRol(4)).toBe(false);
  });

  it('conserva el id de los teléfonos existentes, para que el backend los ACTUALICE', async () => {
    const { fixture } = await setup('7');
    // Con telefonoid 0 el backend daría de alta uno nuevo y borraría el viejo.
    expect((comp(fixture).telefonos.getRawValue()[0] as { telefonoid: number }).telefonoid).toBe(55);
  });

  it('deja el distrito ya elegible sin haber buscado nada', async () => {
    const { fixture } = await setup('7');
    const opciones = comp(fixture).opcionesDistrito();
    expect(opciones).toHaveLength(1);
    expect(opciones[0].etiqueta).toBe('JOSE LEONARDO ORTIZ (CHICLAYO, LAMBAYEQUE)');
  });

  it('muestra la fecha de alta tal y como llega, sin reinterpretarla', async () => {
    const { fixture } = await setup('7');
    // ⚠ Llega como dd/mm/aaaa, ya formateada por la base; no es ISO.
    expect(comp(fixture).registro()).toBe('24/08/2026');
    // (en producción incluye además la hora: «24/08/2026 12:09 PM»)
  });

  it('quitar una fila la saca del envío, que es como se borra en el backend', async () => {
    const { fixture, api } = await setup('7');
    const c = comp(fixture);

    (c['quitar'] as (l: unknown, i: number) => void)(c.emails, 0);
    await (c['onGuardar'] as () => Promise<void>)();
    await asentar(fixture);

    expect(api.actualizados).toHaveLength(1);
    expect(api.actualizados[0].input.emails).toHaveLength(0);
    // Y lo que sigue en la lista viaja con su id.
    expect(api.actualizados[0].input.telefonos[0].telefonoid).toBe(55);
  });

  it('si la ficha no carga, avisa en pantalla en vez de dejar el formulario mudo', async () => {
    const api = new PersonaApiMock();
    api.fallarFicha = true;
    const { el } = await setup('7', api);
    expect(el.textContent).toContain('No se pudo cargar');
  });

  it('si guardar falla, la página se queda con lo escrito', async () => {
    const api = new PersonaApiMock();
    api.fallarGuardado = true;
    const { fixture } = await setup('7', api);
    const c = comp(fixture);

    c.form.patchValue({ nombre: 'JUAN CARLOS' });
    await (c['onGuardar'] as () => Promise<void>)();
    await asentar(fixture);

    expect(c.form.getRawValue()['nombre']).toBe('JUAN CARLOS');
  });

  it('al guardar vuelve al listado', async () => {
    const { fixture } = await setup('7');
    const router = TestBed.inject(Router);
    const navegaciones: unknown[][] = [];
    router.navigate = ((c: unknown[]) => {
      navegaciones.push(c);
      return Promise.resolve(true);
    }) as typeof router.navigate;

    await (comp(fixture)['onGuardar'] as () => Promise<void>)();
    await asentar(fixture);

    expect(navegaciones).toEqual([['/mantenimiento/personas']]);
  });

  it('cancelar con cambios sin guardar pide confirmación', async () => {
    const { fixture, confirm } = await setup('7');
    const c = comp(fixture);
    confirm.respuesta = false;

    const router = TestBed.inject(Router);
    const navegaciones: unknown[][] = [];
    router.navigate = ((ruta: unknown[]) => {
      navegaciones.push(ruta);
      return Promise.resolve(true);
    }) as typeof router.navigate;

    c.form.patchValue({ nombre: 'CAMBIADO' });
    c.form.markAsDirty();
    await (c['onCancelar'] as () => Promise<void>)();

    // Dijo que no: se queda donde estaba.
    expect(navegaciones).toEqual([]);
  });

  it('un id que no es un número se trata como alta, no como edición', async () => {
    const { fixture, api } = await setup('nueva');
    expect(api.fichasPedidas).toEqual([]);
    expect(comp(fixture).esEdicion()).toBe(false);
  });
});
