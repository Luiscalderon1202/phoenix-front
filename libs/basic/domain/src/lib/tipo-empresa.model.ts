/**
 * Modelos del dominio Tipo de Empresa (`basic.tipo_empresa`, bloque Tablas Básicas).
 *
 * La fuente de verdad es `phoenix-api/api/openapi.yaml`, cuyo cliente generado vive en
 * `@phoenix/shared/api-client` (`TipoEmpresa`, `TipoEmpresaInput`). Estos tipos son la
 * vista de dominio de ese contrato; si el spec cambia, hay que regenerar el cliente
 * (`npm run api:client`) y ajustar esto.
 */

/**
 * Fila del catálogo (`GET /tipos-empresa`). Ningún campo es opcional: las tres columnas
 * de texto son NOT NULL en la base y el legacy guarda cadena vacía en vez de NULL, así
 * que `tipo` y `categoria` llegan en blanco muy a menudo pero siempre llegan.
 */
export interface TipoEmpresa {
  tipoempresaid: number;
  nombre: string;
  tipo: string;
  categoria: string;
  /** Posición en la lista. Se cambia con `PATCH /tipos-empresa/orden`, no editando. */
  orden: number;
  /** Se cambia con `POST /tipos-empresa/{id}/estado/alternar`, no editando. */
  estado: boolean;
}

/**
 * Cuerpo del alta y de la edición.
 *
 * NO lleva `orden` ni `estado` a propósito: el alta los fija sola (orden al final,
 * estado activo) y la edición ni los mira. Incluirlos en el formulario prometería un
 * efecto que el backend no produce.
 */
export interface TipoEmpresaInput {
  nombre: string;
  tipo: string;
  categoria: string;
}

/**
 * Respuesta de `POST /tipos-empresa/{id}/estado/alternar`. Devuelve el estado RESULTANTE
 * porque es un toggle: al endpoint no se le manda el valor deseado.
 */
export interface TipoEmpresaEstado {
  tipoempresaid: number;
  estado: boolean;
}

/**
 * Resultado por id de `POST /tipos-empresa/lote/eliminar`. Un tipo de empresa puede fallar
 * (está en uso por una unidad de negocio o un almacén) mientras el resto del lote sí se
 * elimina, así que el saldo se lee fila a fila y no del código HTTP.
 */
export interface ResultadoLoteTipoEmpresa {
  tipoempresaid: number;
  ok: boolean;
  /** Solo cuando `ok` es `false`: mensaje listo para mostrar. */
  mensaje?: string;
  /** Solo cuando `ok` es `false`: código estable del error. */
  codigo?: string;
}

/** Límite de las tres columnas de texto (`varchar(50)`), que el backend también valida. */
export const TIPO_EMPRESA_MAX_TEXTO = 50;
