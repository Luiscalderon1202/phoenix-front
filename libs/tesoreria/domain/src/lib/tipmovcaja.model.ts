/**
 * Modelos del dominio Tipo de Movimiento de Caja (`tesoreria.tipmovcaja`).
 *
 * Clasifica cada apunte de la caja chica —venta, depósito, pasajes, viáticos— y lo referencia
 * `tesoreria.cajaplanilla_detalle_items`.
 *
 * Sale del hub "Tablas Básicas" del legacy, grupo Tesorería, pero **no comparte su permiso**:
 * `TipMovCaj.php` exige el proceso `TIPMOVCAJA` y sus stored procedures buscan ése mismo. La
 * ruta de Angular lleva su propio `procesoGuard`; copiar el del hub abriría la pantalla a
 * quien no la tiene concedida.
 *
 * Es también el catálogo que más se sale del molde: no tiene columna `orden` —así que no se
 * reordena—, tiene DOS interruptores en vez de uno, y arrastra tres columnas contables que el
 * formulario del legacy dejó de mostrar y que la API conserva sola.
 *
 * La fuente de verdad es `phoenix-api/api/openapi.yaml`.
 */

/** Los tres valores de `tipo`, tomados del desplegable de `TipMovCajEdit.php`. */
export type TipoMovimientoCaja = 'I' | 'S' | 'A';

/**
 * Etiquetas de los tres tipos.
 *
 * ⚠ Son I / S / A, que es lo que la tabla guarda. El desplegable del LISTADO del legacy
 * ofrece I / E / A, y ese desajuste es justo lo que hace que filtrar por "egreso" no devuelva
 * nada en producción: el stored procedure traduce `E` a `tipo in ('E','A')` y ninguna fila
 * tiene 'E'. El backend filtra con los valores reales.
 */
export const TIPOS_MOVIMIENTO_CAJA: readonly {
  readonly valor: TipoMovimientoCaja;
  readonly etiqueta: string;
}[] = [
  { valor: 'I', etiqueta: 'Ingreso' },
  { valor: 'S', etiqueta: 'Salida' },
  { valor: 'A', etiqueta: 'Ambos' },
];

/** Etiqueta legible de un tipo, para la grilla y las exportaciones. */
export function etiquetaTipoMovimientoCaja(tipo: string): string {
  return TIPOS_MOVIMIENTO_CAJA.find((t) => t.valor === tipo)?.etiqueta ?? tipo;
}

/**
 * Fila del catálogo (`GET /tipos-movimiento-caja`). Ningún campo es opcional.
 *
 * **Sin `orden`**: es el único catálogo del bloque sin esa columna. El listado llega ordenado
 * por nombre y la pantalla no ofrece arrastrar.
 *
 * `tipo` se declara `string` y no `TipoMovimientoCaja` a propósito: es lo que devuelve el
 * backend y la columna no tiene check, así que una fila vieja podría traer cualquier cosa.
 */
export interface TipMovCaja {
  tipoid: number;
  nombre: string;
  /** Etiqueta corta. Son 10 caracteres, no los 20 que anuncia el formulario del legacy. */
  abreviatura: string;
  /** `I` = ingreso, `S` = salida, `A` = ambos. */
  tipo: string;
  /**
   * Solo lectura desde esta API: el formulario del legacy la tiene comentada. La API la
   * conserva al editar, en vez de borrarla como hace el legacy en cada guardado.
   */
  estructura: string;
  /** Cuenta del Plan Contable General. Solo lectura, como `estructura`. */
  pcgr_general: string;
  /** Cuenta del Plan Contable Empresarial. Solo lectura, como `estructura`. */
  pcgr_empresarial: string;
  /**
   * Qué hace falta para registrar el movimiento. El legacy ofrece un único valor, `SUBDPTO`
   * (departamento de tesorería), más la opción vacía.
   */
  requiere: string;
  /** Si el movimiento exige indicar mes y año. Tiene su PROPIA ruta, como el estado. */
  requerir_mesanio: boolean;
  estado: boolean;
}

/**
 * Cuerpo del alta y de la edición.
 *
 * NO lleva `estado` ni `requerir_mesanio` —cada uno tiene su ruta, porque el legacy les dedica
 * una función aparte y las dos son toggles— ni `estructura`, `pcgr_general` o
 * `pcgr_empresarial`, que el backend conserva solo.
 *
 * `tipo` es obligatorio y sin valor neutro: decide en qué mitad del catálogo cae el
 * movimiento.
 */
export interface TipMovCajaInput {
  tipo: TipoMovimientoCaja;
  nombre: string;
  abreviatura: string;
  requiere: string;
}

/** Filtros del listado. Los resuelve el backend, no el stored procedure. */
export interface TipMovCajaFiltros {
  /** Búsqueda parcial por nombre, sin distinguir mayúsculas. */
  nombre?: string;
  /** `I`, `S` o `A`. Vacío = todos. */
  tipo?: string;
  /** `Y` = activos, `N` = inactivos. Vacío = todos. */
  estado?: string;
}

/** Respuesta de `POST /tipos-movimiento-caja/{id}/estado/alternar`. */
export interface TipMovCajaEstado {
  tipoid: number;
  estado: boolean;
}

/**
 * Respuesta de `POST /tipos-movimiento-caja/{id}/requerir-mes-anio/alternar`. El SEGUNDO
 * interruptor del recurso; devuelve el valor RESULTANTE porque también es un toggle.
 */
export interface TipMovCajaRequerirMesAnio {
  tipoid: number;
  requerir_mesanio: boolean;
}

/**
 * Resultado por id de `POST /tipos-movimiento-caja/lote/eliminar`. Uno puede fallar (tiene
 * movimientos de caja) mientras el resto del lote sí se elimina.
 */
export interface ResultadoLoteTipMovCaja {
  tipoid: number;
  ok: boolean;
  /** Solo cuando `ok` es `false`: mensaje listo para mostrar. */
  mensaje?: string;
  /** Solo cuando `ok` es `false`: código estable del error. */
  codigo?: string;
}

/** Límites de las columnas de texto, tomados de la COLUMNA y no del formulario del legacy. */
export const TIPMOVCAJA_MAX_NOMBRE = 50;
/** ⚠ Son 10, no los 20 que anuncia `TipMovCajEdit.php`. */
export const TIPMOVCAJA_MAX_ABREVIATURA = 10;
export const TIPMOVCAJA_MAX_REQUIERE = 20;
