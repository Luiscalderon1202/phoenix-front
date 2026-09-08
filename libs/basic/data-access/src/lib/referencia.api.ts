import { inject, Injectable } from '@angular/core';
import { type Observable, of } from 'rxjs';
import { ApiService } from '@phoenix/shared/http';
import {
  type Corporacion,
  DISTRITO_MIN_BUSQUEDA,
  type Distrito,
  type Pais,
  type TipoContacto,
  type TipoIDCatalogo,
  type TipoRedSocial,
  type UnidadNegocio,
  type Zona,
} from '@phoenix/basic/domain';

/**
 * Catálogos de apoyo de los formularios de Empresa y Local (`GET /catalogos/*`).
 *
 * Los cuatro son de SOLO LECTURA porque **ninguno tiene pantalla de mantenimiento**: zona no
 * tiene ni fila en `basic.menuweb`, y las de unidad de negocio (20) y corporación (95) están
 * con `estado=false`. Se editan contra la base.
 *
 * Van en un solo servicio, y no en cuatro, porque no son un dominio: son los desplegables de
 * otras dos pantallas.
 */
@Injectable({ providedIn: 'root' })
export class ReferenciaApi {
  private readonly api = inject(ApiService);

  /**
   * Países, para el selector del formulario de persona. Se sirve entero: es una tabla
   * corta y estable.
   */
  paises(): Observable<Pais[]> {
    return this.api.get<Pais[]>('/catalogos/paises');
  }

  /** Catálogo completo de zonas, activas e inactivas. */
  zonas(): Observable<Zona[]> {
    return this.api.get<Zona[]>('/catalogos/zonas');
  }

  /**
   * Unidades de negocio, opcionalmente acotadas a un tipo de empresa: en el formulario del
   * local los dos selectores van encadenados.
   *
   * `0` o sin valor equivale a «todas», que es lo que espera el backend.
   */
  unidadesNegocio(tipoempresaid = 0): Observable<UnidadNegocio[]> {
    return this.api.get<UnidadNegocio[]>('/catalogos/unidades-negocio', {
      tipoempresaid: tipoempresaid || undefined,
    });
  }

  /** Catálogo completo de corporaciones. */
  corporaciones(): Observable<Corporacion[]> {
    return this.api.get<Corporacion[]>('/catalogos/corporaciones');
  }

  /**
   * BUSCA distritos. **No es un catálogo que se pueda cargar entero**: son 1.839 filas y el
   * stored procedure no limita, así que el backend exige acotar —dos caracteres de texto, o
   * un departamento, o una provincia— y sin eso devuelve lista vacía.
   *
   * Aquí se aplica el mismo corte ANTES de salir a la red: una consulta que se sabe que va a
   * volver vacía no merece una petición, y este endpoint se dispara al teclear.
   */
  distritos(opts: {
    q?: string;
    departamentoid?: number;
    provinciaid?: number;
  } = {}): Observable<Distrito[]> {
    const q = (opts.q ?? '').trim();
    const departamentoid = opts.departamentoid || 0;
    const provinciaid = opts.provinciaid || 0;

    if (q.length < DISTRITO_MIN_BUSQUEDA && !departamentoid && !provinciaid) {
      return of([]);
    }
    return this.api.get<Distrito[]>('/catalogos/distritos', {
      q: q || undefined,
      departamentoid: departamentoid || undefined,
      provinciaid: provinciaid || undefined,
    });
  }


  /**
   * Documentos de identidad (DNI, RUC, pasaporte…) para el formulario de persona.
   *
   * ⚠ Su `tipoid` NO es el mismo espacio de numeración que el de los tipos de teléfono o
   * de email, aunque las tres columnas se llamen igual.
   */
  tiposID(): Observable<TipoIDCatalogo[]> {
    return this.api.get<TipoIDCatalogo[]>('/catalogos/tipos-id');
  }

  /** Tipos de teléfono, para el selector de cada fila de teléfono. */
  tiposTelefono(): Observable<TipoContacto[]> {
    return this.api.get<TipoContacto[]>('/catalogos/tipos-telefono');
  }

  /** Tipos de email. Comparte forma con los de teléfono: las dos tablas son iguales. */
  tiposEmail(): Observable<TipoContacto[]> {
    return this.api.get<TipoContacto[]>('/catalogos/tipos-email');
  }

  /** Redes sociales. */
  tiposRedSocial(): Observable<TipoRedSocial[]> {
    return this.api.get<TipoRedSocial[]>('/catalogos/tipos-social-media');
  }
}
