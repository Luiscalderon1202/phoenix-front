/**
 * Índice de las tablas básicas del ERP, transcrito de
 * `pseraphis/admin/interfaz/mantenimiento/TablasBasicas.php` y su
 * `js/tablasbasicas.js`.
 *
 * Son 40 opciones en 11 grupos. Se conservan los grupos y el orden del legacy: quien lleva
 * años usando esa pantalla busca cada tabla donde siempre ha estado.
 *
 * **No están las 46 que aparecen en el JS.** Seis de sus manejadores apuntan a botones que el
 * HTML ya no pinta (`btnTesoCat`, `btnTesoCon`, `btnTesoCaja`, `btnGpsTipVeh`, `btnGpsTipSer`,
 * `btnSoatTipUso`): son opciones muertas y replicarlas resucitaría pantallas que el legacy
 * dejó de ofrecer.
 *
 * Cada opción apunta a UNA de dos cosas: `ruta` si la tabla ya está migrada a Angular, o
 * `legacy` con su `.php` si todavía no. Migrar una tabla es cambiar esas dos líneas.
 */

/** Una tabla del catálogo. Lleva `ruta` (migrada) o `legacy` (aún en PHP), nunca las dos. */
export interface OpcionTabla {
  /** Nombre del icono en `ICON_REGISTRY`. */
  readonly icono: string;
  /** Color de acento del badge del icono. */
  readonly acento: string;
  readonly titulo: string;
  readonly descripcion: string;
  /** Ruta de Angular, si la tabla ya está migrada. */
  readonly ruta?: string;
  /** Ruta del `.php`, absoluta desde la raíz del legacy, si no lo está. */
  readonly legacy?: string;
}

export interface GrupoTablas {
  readonly titulo: string;
  readonly opciones: readonly OpcionTabla[];
}

/** Raíz de las pantallas del legacy, para no repetirla 40 veces. */
const L = '/admin/interfaz';

export const GRUPOS_TABLAS: readonly GrupoTablas[] = [
  {
    titulo: 'General',
    opciones: [
      {
        icono: 'scale',
        acento: '#475569',
        titulo: 'Tipos de régimen',
        descripcion: 'Administra los regímenes tributarios',
        legacy: `${L}/basic/TipoRegimen.php`,
      },
      {
        icono: 'sort',
        acento: '#64748b',
        titulo: 'Tipos de posición',
        descripcion: 'Administra los tipos de posición',
        legacy: `${L}/mantenimiento/TipoPosicion.php`,
      },
      {
        icono: 'users',
        acento: '#f97316',
        titulo: 'Roles',
        descripcion: 'Administra los roles de persona',
        legacy: `${L}/mantenimiento/Rol.php`,
      },
      {
        icono: 'map',
        acento: '#7c3aed',
        titulo: 'Ubigeo',
        descripcion: 'Administra departamentos, provincias y distritos',
        legacy: `${L}/mantenimiento/Ubigeo.php`,
      },
      {
        icono: 'building',
        acento: '#0891b2',
        titulo: 'Tipos de empresa',
        descripcion: 'Administra los tipos de empresa',
        // Primera tabla migrada. Ver libs/basic/feature-tipos-empresa.
        ruta: '/mantenimiento/tipos-empresa',
      },
      {
        icono: 'apps',
        acento: '#0e7490',
        titulo: 'Sub tipos de empresa',
        descripcion: 'Administra los subtipos de empresa',
        legacy: `${L}/mantenimiento/SubTipoEmpresa.php`,
      },
      {
        icono: 'map-pin',
        acento: '#ec4899',
        titulo: 'Zonas',
        descripcion: 'Administra las zonas geográficas',
        legacy: `${L}/basic/Zona.php`,
      },
    ],
  },
  {
    titulo: 'Persona',
    opciones: [
      {
        icono: 'id-card',
        acento: '#8b5cf6',
        titulo: 'Tipos de identificación',
        descripcion: 'Administra los tipos de documento de identidad',
        legacy: `${L}/basic/TipoId.php`,
      },
      {
        icono: 'phone',
        acento: '#3b82f6',
        titulo: 'Tipos de teléfono',
        descripcion: 'Administra los tipos de teléfono',
        ruta: '/mantenimiento/tipos-telefono',
      },
      {
        icono: 'mail',
        acento: '#22c55e',
        titulo: 'Tipos de email',
        descripcion: 'Administra los tipos de correo',
        ruta: '/mantenimiento/tipos-email',
      },
      {
        icono: 'map-pin',
        acento: '#ec4899',
        titulo: 'Tipos de dirección',
        descripcion: 'Administra los tipos de dirección',
        ruta: '/mantenimiento/tipos-direccion',
      },
      {
        icono: 'brand',
        acento: '#6366f1',
        titulo: 'Social media',
        descripcion: 'Administra las redes sociales',
        ruta: '/mantenimiento/social-media',
      },
      {
        icono: 'accessibility',
        acento: '#ef4444',
        titulo: 'Categorías de licencia',
        descripcion: 'Administra las categorías de licencia de conducir',
        legacy: `${L}/mantenimiento/CategoriaLicencia.php`,
      },
    ],
  },
  {
    titulo: 'Servicios web',
    opciones: [
      {
        icono: 'bank',
        acento: '#0ea5e9',
        titulo: 'Instituciones',
        descripcion: 'Administra las instituciones consultadas',
        legacy: `${L}/webservice/Institucion.php`,
      },
      {
        icono: 'apps',
        acento: '#14b8a6',
        titulo: 'Tipos',
        descripcion: 'Administra los tipos de servicio web',
        legacy: `${L}/webservice/Tipo.php`,
      },
      {
        icono: 'user',
        acento: '#f59e0b',
        titulo: 'Usuarios',
        descripcion: 'Administra los usuarios de los servicios',
        legacy: `${L}/webservice/Usuario.php`,
      },
      {
        icono: 'globe',
        acento: '#06b6d4',
        titulo: 'Servicios web',
        descripcion: 'Administra los servicios web disponibles',
        legacy: `${L}/webservice/WebService.php`,
      },
      {
        icono: 'shield',
        acento: '#dc2626',
        titulo: 'Credenciales API',
        descripcion: 'Administra las credenciales de acceso a la API',
        legacy: `${L}/webservice/CredencialAPI.php`,
      },
    ],
  },
  {
    titulo: 'Ventas',
    opciones: [
      {
        icono: 'receipt',
        acento: '#0891b2',
        titulo: 'Tipos de operación',
        descripcion: 'Administra los tipos de operación',
        ruta: '/mantenimiento/tipos-operacion',
      },
      {
        icono: 'cash',
        acento: '#f59e0b',
        titulo: 'Tipos de venta',
        descripcion: 'Administra los tipos de venta',
        ruta: '/mantenimiento/tipos-venta',
      },
      {
        icono: 'scale',
        acento: '#475569',
        titulo: 'Tipos de tributo',
        descripcion: 'Administra los tributos aplicables',
        ruta: '/mantenimiento/tipos-tributo',
      },
      {
        icono: 'x-circle',
        acento: '#ef4444',
        titulo: 'Motivos de anulación',
        descripcion: 'Administra los motivos de anulación de comprobantes',
        ruta: '/mantenimiento/motivos-anulacion',
      },
      {
        icono: 'doc',
        acento: '#8b5cf6',
        titulo: 'Motivos de notas',
        descripcion: 'Administra los motivos de notas de crédito y débito',
        ruta: '/mantenimiento/motivos-notas',
      },
      {
        icono: 'grid',
        acento: '#22c55e',
        titulo: 'Tipos de consumo',
        descripcion: 'Administra los tipos de consumo',
        ruta: '/mantenimiento/tipos-consumo',
      },
      {
        icono: 'phone',
        acento: '#3b82f6',
        titulo: 'Canales de atención',
        descripcion: 'Administra los canales de atención al cliente',
        ruta: '/mantenimiento/canales-atencion',
      },
    ],
  },
  {
    titulo: 'Pedidos',
    opciones: [
      {
        icono: 'clock',
        acento: '#d97706',
        titulo: 'Estados de proceso',
        descripcion: 'Administra los estados del proceso de pedidos',
        ruta: '/mantenimiento/estados-proceso-pedido',
      },
    ],
  },
  {
    titulo: 'Inventarios',
    opciones: [
      {
        icono: 'move',
        acento: '#7c3aed',
        titulo: 'Tipos de movimiento',
        descripcion: 'Administra los movimientos de mercadería',
        legacy: `${L}/inventarios/TipMovMer.php`,
      },
    ],
  },
  {
    titulo: 'Tesorería',
    opciones: [
      {
        icono: 'cash',
        acento: '#f59e0b',
        titulo: 'Tipos de forma de pago',
        descripcion: 'Administra las formas de pago',
        ruta: '/mantenimiento/tipos-forma-pago',
      },
      {
        icono: 'credit-card',
        acento: '#6366f1',
        titulo: 'Tipos de tarjeta',
        descripcion: 'Administra los tipos de tarjeta',
        ruta: '/mantenimiento/tipos-tarjeta',
      },
      {
        icono: 'calendar-check',
        acento: '#0ea5e9',
        titulo: 'Condiciones de pago',
        descripcion: 'Administra las condiciones de pago',
        ruta: '/mantenimiento/condiciones-pago',
      },
      {
        icono: 'bank',
        acento: '#0891b2',
        titulo: 'Tipos de movimiento de caja',
        descripcion: 'Administra los movimientos de caja',
        ruta: '/mantenimiento/tipos-movimiento-caja',
      },
      {
        icono: 'receipt',
        acento: '#22c55e',
        titulo: 'Tipos de descuento',
        descripcion: 'Administra los tipos de descuento',
        ruta: '/mantenimiento/tipos-descuento',
      },
    ],
  },
  {
    titulo: 'Facturación electrónica',
    opciones: [
      {
        icono: 'folder',
        acento: '#d97706',
        titulo: 'Archivos adicionales',
        descripcion: 'Administra los archivos que acompañan al comprobante',
        legacy: `${L}/basic/Firmador.php`,
      },
      {
        icono: 'edit',
        acento: '#8b5cf6',
        titulo: 'Firmas digitales',
        descripcion: 'Administra las firmas digitales',
        legacy: `${L}/basic/FirmaDigital.php`,
      },
      {
        icono: 'shield',
        acento: '#dc2626',
        titulo: 'Certificados digitales',
        descripcion: 'Administra los certificados de SUNAT',
        legacy: `${L}/basic/CertificadoDigital.php`,
      },
    ],
  },
  {
    titulo: 'Guías de remisión',
    opciones: [
      {
        icono: 'apps',
        acento: '#14b8a6',
        titulo: 'Modalidades',
        descripcion: 'Administra las modalidades de traslado',
        legacy: `${L}/guia/Modalidad.php`,
      },
      {
        icono: 'doc',
        acento: '#8b5cf6',
        titulo: 'Motivos',
        descripcion: 'Administra los motivos de traslado',
        legacy: `${L}/guia/Motivo.php`,
      },
      {
        icono: 'building',
        acento: '#0891b2',
        titulo: 'Entidades',
        descripcion: 'Administra las entidades de transporte',
        legacy: `${L}/guia/Entidad.php`,
      },
    ],
  },
  {
    titulo: 'Planillas',
    opciones: [
      {
        icono: 'briefcase',
        acento: '#6366f1',
        titulo: 'Cargos',
        descripcion: 'Administra los cargos del personal',
        legacy: `${L}/basic/Cargo.php`,
      },
    ],
  },
  {
    titulo: 'Otros',
    opciones: [
      {
        icono: 'folder',
        acento: '#64748b',
        titulo: 'Tipos de archivo',
        descripcion: 'Administra los tipos de archivo admitidos',
        legacy: `${L}/basic/TipoArchivo.php`,
      },
    ],
  },
];
