/**
 * Rol de una persona. Catálogo de solo lectura para el front: llega de
 * `GET /catalogos/roles` (tabla pequeña y estable, se sirve entera sin paginar) y aquí
 * solo alimenta el combo de filtro del listado. Su mantenimiento sigue en el legacy.
 */
export interface Rol {
  rolid: number;
  nombre: string;
  /** A qué clase de persona aplica: `'N'` natural, `'J'` jurídica, `'X'` ambas. */
  tipopersona: string;
}
