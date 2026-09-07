import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import type { PersonaListQuery } from '@phoenix/basic/domain';
import { API_BASE_URL } from '@phoenix/shared/http';
import { PERSONA_FOTO_BASE_URL, PersonaApi, personaQueryParams } from './persona.api';

const BASE: PersonaListQuery = { page: 2, page_size: 25 };

describe('personaQueryParams', () => {
  it('siempre manda la paginación', () => {
    expect(personaQueryParams(BASE)).toEqual({ page: 2, page_size: 25 });
  });

  it('omite los filtros vacíos en vez de mandarlos en blanco', () => {
    // `q=` sería "buscar la cadena vacía"; un combo en "Todos" es NO filtrar.
    const params = personaQueryParams({ ...BASE, q: '', tipo: '', estado: '', orderby: '' });
    expect(params).toEqual({ page: 2, page_size: 25 });
  });

  it('omite los filtros `undefined` (rolid sin elegir)', () => {
    expect(personaQueryParams({ ...BASE, rolid: undefined })).toEqual({ page: 2, page_size: 25 });
  });

  it('propaga los filtros con valor, respetando el tipo de cada uno', () => {
    const params = personaQueryParams({
      ...BASE,
      q: 'perez',
      apemat: 'lopez',
      nombre: 'juan',
      paisid: 51,
      sexo: 'M',
      estado: 'Y',
      con_foto: 'N',
      tipo: 'N',
      rolid: 7,
      orderby: 'nombre',
    });
    expect(params).toEqual({
      page: 2,
      page_size: 25,
      q: 'perez',
      apemat: 'lopez',
      nombre: 'juan',
      paisid: 51,
      sexo: 'M',
      estado: 'Y',
      con_foto: 'N',
      tipo: 'N',
      rolid: 7,
      orderby: 'nombre',
    });
  });

  it('conserva el 0 (es un valor, no un "sin filtro")', () => {
    expect(personaQueryParams({ ...BASE, paisid: 0 })).toMatchObject({ paisid: 0 });
  });
});

/** `foto` es un nombre de archivo: quien sabe convertirlo en URL es el data-access. */
describe('PersonaApi.fotoUrl', () => {
  function api(fotoBase?: string): PersonaApi {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        { provide: API_BASE_URL, useValue: '/api/v1' },
        ...(fotoBase === undefined ? [] : [{ provide: PERSONA_FOTO_BASE_URL, useValue: fotoBase }]),
      ],
    });
    return TestBed.inject(PersonaApi);
  }

  it('sin base configurada no inventa una ruta', () => {
    // Por defecto el token es '': el listado cae al avatar en vez de pedir 404 por fila.
    expect(api().fotoUrl('perfil-1.webp')).toBeNull();
  });

  it('sin foto devuelve null aunque haya base', () => {
    expect(api('/media/personas/').fotoUrl('')).toBeNull();
  });

  it('con base configurada concatena el nombre de archivo', () => {
    expect(api('/media/personas/').fotoUrl('perfil-1.webp')).toBe('/media/personas/perfil-1.webp');
  });
});
