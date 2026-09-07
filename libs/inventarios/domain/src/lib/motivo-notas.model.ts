/**
 * Modelos del dominio Motivo de Notas (`inventarios.motivo_notas`, bloque Tablas Básicas del
 * legacy, grupo Ventas).
 *
 * Guarda los motivos de una nota de crédito o de débito, con el código que SUNAT exige en el
 * comprobante (catálogos 09 y 10).
 *
 * A diferencia del resto de los catálogos, éste NO es una lista plana: la columna `tipo` lo
 * parte en dos —crédito y débito— y esa división llega hasta la unicidad, que el backend
 * comprueba dentro de cada tipo. Dos motivos pueden llamarse igual si son de tipos distintos,
 * y tienen que poder: los dos catálogos de SUNAT repiten conceptos.
 *
 * La fuente de verdad es `phoenix-api/api/openapi.yaml`; estos tipos son la vista de dominio
 * de ese contrato.
 */

/**
 * Los dos únicos valores de `tipo`. La columna es `varchar(1)` **sin check en la base**: quien
 * la acota es el backend, y esta unión hace que el front no pueda mandar otra cosa.
 */
export type TipoNota = 'C' | 'D';

/** Etiquetas de los dos tipos, tomadas del desplegable del legacy (`MotivoNotasEdit.php`). */
export const TIPOS_NOTA: readonly { readonly valor: TipoNota; readonly etiqueta: string }[] = [
  { valor: 'C', etiqueta: 'Nota de crédito' },
  { valor: 'D', etiqueta: 'Nota de débito' },
];

/** Etiqueta legible de un tipo, para la grilla y las exportaciones. */
export function etiquetaTipoNota(tipo: string): string {
  return TIPOS_NOTA.find((t) => t.valor === tipo)?.etiqueta ?? tipo;
}

/**
 * Fila del catálogo (`GET /motivos-notas`). Ningún campo es opcional: todas las columnas son
 * NOT NULL en la base y el legacy nunca guarda NULL, guarda cadena vacía.
 *
 * `tipo` se declara como `string` y no como `TipoNota` a propósito: es lo que devuelve el
 * backend, y la columna no tiene check, así que una fila vieja podría traer cualquier cosa.
 * Tiparla como la unión obligaría a mentir en el `as` de cada respuesta.
 */
export interface MotivoNotas {
  motivoid: number;
  /** `C` = nota de crédito, `D` = nota de débito. */
  tipo: string;
  nombre: string;
  /** Etiqueta corta. */
  abreviatura: string;
  /**
   * Código de SUNAT (catálogo 09 para crédito, 10 para débito). **Único dentro de su tipo**,
   * salvo que vaya vacío.
   */
  codigo_contable: string;
  /** Si la nota devuelve mercadería al stock. */
  afectastock: boolean;
  /** Posición en la lista. Se cambia con `PATCH /motivos-notas/orden`, no editando. */
  orden: number;
  estado: boolean;
}

/**
 * Cuerpo del alta y de la edición.
 *
 * NO lleva `orden` ni `estado`: el alta fija el orden al final, y el estado se cambia por su
 * propia ruta —el stored procedure sí lo recibe, pero el backend le devuelve el que la fila ya
 * tenía—.
 *
 * `tipo` y `afectastock` SÍ van aquí: son datos del motivo, no interruptores. `tipo` además es
 * obligatorio y no tiene valor por defecto en el contrato: adivinarlo pondría el motivo en la
 * mitad equivocada del catálogo sin que nadie se entere.
 */
export interface MotivoNotasInput {
  tipo: TipoNota;
  nombre: string;
  abreviatura: string;
  codigo_contable: string;
  afectastock: boolean;
}

/**
 * Respuesta de `POST /motivos-notas/{id}/estado/alternar`. Devuelve el estado RESULTANTE
 * porque es un toggle: al endpoint no se le manda el valor deseado.
 */
export interface MotivoNotasEstado {
  motivoid: number;
  estado: boolean;
}

/**
 * Resultado por id de `POST /motivos-notas/lote/eliminar`.
 *
 * En este recurso el fallo esperable es el 404 y no el "en uso": el stored procedure de
 * borrado comprueba la tabla equivocada y contra `motivo_notas` no hay ninguna clave foránea.
 * El saldo se sigue leyendo fila a fila porque el lote es parcial por diseño.
 */
export interface ResultadoLoteMotivoNotas {
  motivoid: number;
  ok: boolean;
  /** Solo cuando `ok` es `false`: mensaje listo para mostrar. */
  mensaje?: string;
  /** Solo cuando `ok` es `false`: código estable del error. */
  codigo?: string;
}

/** Límite de `nombre` (`varchar(50)`), que el backend también valida. */
export const MOTIVO_NOTAS_MAX_NOMBRE = 50;
/** Límite de `abreviatura` (`varchar(20)`). */
export const MOTIVO_NOTAS_MAX_ABREVIATURA = 20;
/** Límite de `codigo_contable` (`varchar(10)`). */
export const MOTIVO_NOTAS_MAX_CODIGO_CONTABLE = 10;
