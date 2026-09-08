import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '@phoenix/shared/http';
// Imports relativos, no por el alias del propio proyecto: Nx lo exige dentro de una misma lib.
import { almacenQueryParams } from './almacen.api';
import { ReferenciaApi } from './referencia.api';

/**
 * Tests de la capa HTTP de locales y de los catálogos de apoyo.
 *
 * Están aquí y no en el spec de la pantalla a propósito: **decidir qué entra en la URL es del
 * cliente HTTP**, no del componente. Probarlo a través de un doble del API no probaría nada,
 * porque el doble recibe el objeto de filtros, no la petición.
 */
describe('almacenQueryParams', () => {
  it('sin filtros no manda nada', () => {
    expect(almacenQueryParams({})).toEqual({});
  });

  it('OMITE los filtros vacíos en vez de mandarlos en cero', () => {
    // Para el backend un id 0 y un `q=` vacío significan «sin filtro»: mandarlos no cambia el
    // resultado, solo ensucia la URL.
    expect(
      almacenQueryParams({ q: '', zonaid: 0, unidadnegocioid: 0, tipoempresaid: 0 }),
    ).toEqual({});
  });

  it('recorta el texto de búsqueda', () => {
    expect(almacenQueryParams({ q: '  centro  ' })).toEqual({ q: 'centro' });
  });

  it('un texto de solo espacios se OMITE, no se manda en blanco', () => {
    expect(almacenQueryParams({ q: '   ' })).toEqual({});
  });

  it('pasa los cuatro filtros que sí tienen valor', () => {
    expect(
      almacenQueryParams({ q: 'centro', zonaid: 2, unidadnegocioid: 3, tipoempresaid: 4 }),
    ).toEqual({ q: 'centro', zonaid: 2, unidadnegocioid: 3, tipoempresaid: 4 });
  });
});

describe('ReferenciaApi', () => {
  let api: ReferenciaApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: '/api/v1' },
      ],
    });
    api = TestBed.inject(ReferenciaApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /**
   * ⚠ El corte de la búsqueda de distritos. Son 1.839 filas y `basic.padistrito_consulta` no
   * limita nada, así que el backend exige acotar y devuelve lista vacía si no se hace. Aquí se
   * aplica el mismo corte ANTES de salir a la red: este endpoint se dispara al teclear, y una
   * petición que se sabe que va a volver vacía no merece gastarse.
   */
  it('con menos de dos caracteres NO sale a la red', async () => {
    const sinNada = await firstValueFrom(api.distritos());
    const unaLetra = await firstValueFrom(api.distritos({ q: 'B' }));
    const soloEspacios = await firstValueFrom(api.distritos({ q: '  ' }));

    expect(sinNada).toEqual([]);
    expect(unaLetra).toEqual([]);
    expect(soloEspacios).toEqual([]);
    http.expectNone(() => true);
  });

  it('con dos caracteres sí consulta, y recorta el texto', async () => {
    const pendiente = firstValueFrom(api.distritos({ q: '  BRE  ' }));
    const req = http.expectOne((r) => r.url === '/api/v1/catalogos/distritos');
    expect(req.request.params.get('q')).toBe('BRE');
    req.flush({ status: 'success', data: [] });
    await pendiente;
  });

  it('una provincia basta para consultar aunque no haya texto', async () => {
    const pendiente = firstValueFrom(api.distritos({ provinciaid: 124 }));
    const req = http.expectOne((r) => r.url === '/api/v1/catalogos/distritos');
    expect(req.request.params.get('provinciaid')).toBe('124');
    expect(req.request.params.has('q')).toBe(false);
    req.flush({ status: 'success', data: [] });
    await pendiente;
  });

  it('un departamento también basta', async () => {
    const pendiente = firstValueFrom(api.distritos({ departamentoid: 13 }));
    const req = http.expectOne((r) => r.url === '/api/v1/catalogos/distritos');
    expect(req.request.params.get('departamentoid')).toBe('13');
    req.flush({ status: 'success', data: [] });
    await pendiente;
  });

  it('unidades de negocio sin tipo NO manda el parámetro', async () => {
    const pendiente = firstValueFrom(api.unidadesNegocio());
    const req = http.expectOne((r) => r.url === '/api/v1/catalogos/unidades-negocio');
    // `0` es «todas» para el backend, pero omitirlo dice lo mismo sin gastar parámetro.
    expect(req.request.params.has('tipoempresaid')).toBe(false);
    req.flush({ status: 'success', data: [] });
    await pendiente;
  });

  it('unidades de negocio con tipo lo acota', async () => {
    const pendiente = firstValueFrom(api.unidadesNegocio(2));
    const req = http.expectOne((r) => r.url === '/api/v1/catalogos/unidades-negocio');
    expect(req.request.params.get('tipoempresaid')).toBe('2');
    req.flush({ status: 'success', data: [] });
    await pendiente;
  });
});
