import { Route } from '@angular/router';
import {
  authGuard,
  CambioClavePage,
  cambioClaveGuard,
  LoginPage,
  procesoGuard,
} from '@phoenix/shared/auth';
import { HomePage } from './home/home-page';
import { MainLayout } from './layout/main-layout/main-layout';

export const appRoutes: Route[] = [
  // Login público, FUERA del layout (sin navbar/sidebar). `shared/auth` se usa eager
  // (provideAuth/authGuard), por eso LoginPage se importa estático y no lazy.
  { path: 'login', component: LoginPage },

  // Cambio de contraseña: FUERA del layout, como el login. Quien llega aquí tiene
  // una clave temporal pendiente y no debe poder navegar a nada más, así que
  // mostrarle navbar y menú sería ofrecerle salidas que el guard va a bloquear.
  // Exige sesión (authGuard) pero NO cambioClaveGuard: es su propio destino.
  {
    path: 'cambiar-clave',
    component: CambioClavePage,
    canMatch: [authGuard],
    data: { title: 'Cambiar contraseña' },
  },

  // Árbol privado: el `MainLayout` (navbar + sidebar + outlet) envuelve todo, protegido
  // por `authGuard` (canMatch en el padre). Cada ruta declara `breadcrumb`/`title` para que
  // los breadcrumbs y el título se deriven solos de la ruta activa.
  //
  // A medida que se migren módulos del legacy (pseraphis) se agrega aquí un hijo lazy
  // por dominio: `loadChildren: () => import('@phoenix/<dominio>/shell').then(…)`.
  {
    path: '',
    component: MainLayout,
    canMatch: [authGuard],
    // Desvía a /cambiar-clave mientras la contraseña siga siendo la temporal. Va
    // en el padre para cubrir TODO el árbol privado de una sola vez.
    canActivate: [cambioClaveGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'inicio' },
      {
        path: 'inicio',
        component: HomePage,
        data: { title: 'Inicio', breadcrumb: 'Inicio' },
      },
      // Mantenimiento (tablas básicas del legacy pseraphis). El tramo padre no tiene
      // pantalla propia: solo aporta la migaja "Mantenimiento" y agrupa a sus hijos.
      {
        path: 'mantenimiento',
        data: { breadcrumb: 'Mantenimiento' },
        children: [
          {
            // Índice de los 40 catálogos. Es el destino de la fila 58 del menú
            // (`TABLAS-BASICAS`), que en el legacy abre `TablasBasicas.php`: un hub, no
            // una pantalla. Desde aquí se entra a cada tabla, migrada o no.
            path: 'tablas-basicas',
            canMatch: [procesoGuard('TABLAS-BASICAS')],
            loadChildren: () =>
              import('@phoenix/basic/feature-tablas-basicas').then(
                (m) => m.TABLAS_BASICAS_ROUTES,
              ),
          },
          {
            path: 'tipos-telefono',
            canMatch: [procesoGuard('TABLAS-BASICAS')],
            loadChildren: () =>
              import('@phoenix/basic/feature-tipos-telefono').then(
                (m) => m.TIPOS_TELEFONO_ROUTES,
              ),
          },
          {
            path: 'tipos-email',
            canMatch: [procesoGuard('TABLAS-BASICAS')],
            loadChildren: () =>
              import('@phoenix/basic/feature-tipos-email').then(
                (m) => m.TIPOS_EMAIL_ROUTES,
              ),
          },
          {
            path: 'tipos-direccion',
            canMatch: [procesoGuard('TABLAS-BASICAS')],
            loadChildren: () =>
              import('@phoenix/basic/feature-tipos-direccion').then(
                (m) => m.TIPOS_DIRECCION_ROUTES,
              ),
          },
          {
            path: 'social-media',
            canMatch: [procesoGuard('TABLAS-BASICAS')],
            loadChildren: () =>
              import('@phoenix/basic/feature-social-media').then(
                (m) => m.SOCIAL_MEDIA_ROUTES,
              ),
          },
          {
            path: 'empresas',
            // Proceso propio (`basic.menuweb` 6), NO el hub de Tablas Basicas.
            //
            // ⚠ EMPRESA decide quien puede MANTENER el catalogo de empresas. No es el
            // ambito multiempresa: quien puede operar sobre los datos de una empresa
            // concreta lo decide `basic.permisos_empresa` y viaja como `?empresaid=`.
            canMatch: [procesoGuard('EMPRESA')],
            loadChildren: () =>
              import('@phoenix/basic/feature-empresas').then((m) => m.EMPRESAS_ROUTES),
          },
          {
            path: 'almacenes',
            // Proceso propio (`basic.menuweb` 69). La tabla se llama `almacen` pero la
            // pantalla son LOCALES: la sede fisica desde la que se vende.
            canMatch: [procesoGuard('ALMACEN')],
            loadChildren: () =>
              import('@phoenix/basic/feature-almacenes').then((m) => m.ALMACENES_ROUTES),
          },
          {
            path: 'tipos-empresa',
            // Mismo proceso que Personas usa para lo suyo, pero aquí es TABLAS-BASICAS:
            // es el proceso que el legacy asigna a toda la pantalla TablasBasicas.php y
            // el que las propias funciones de `basic.tipo_empresa` comprueban.
            canMatch: [procesoGuard('TABLAS-BASICAS')],
            loadChildren: () =>
              import('@phoenix/basic/feature-tipos-empresa').then(
                (m) => m.TIPOS_EMPRESA_ROUTES,
              ),
          },
          {
            path: 'tipos-tributo',
            canMatch: [procesoGuard('TABLAS-BASICAS')],
            loadChildren: () =>
              import('@phoenix/basic/feature-tipos-tributo').then(
                (m) => m.TIPOS_TRIBUTO_ROUTES,
              ),
          },
          // Los tres siguientes son del dominio `inventarios`, no de `basic`: sus
          // tablas viven en el esquema `inventarios` y son las que lee la pantalla
          // de Pedido/Cotización. El proceso de permiso, en cambio, es el mismo —
          // en el legacy los tres cuelgan del hub TablasBasicas.php.
          {
            path: 'tipos-consumo',
            canMatch: [procesoGuard('TABLAS-BASICAS')],
            loadChildren: () =>
              import('@phoenix/inventarios/feature-tipos-consumo').then(
                (m) => m.TIPOS_CONSUMO_ROUTES,
              ),
          },
          {
            path: 'canales-atencion',
            canMatch: [procesoGuard('TABLAS-BASICAS')],
            loadChildren: () =>
              import('@phoenix/inventarios/feature-canales-atencion').then(
                (m) => m.CANALES_ATENCION_ROUTES,
              ),
          },
          {
            path: 'estados-proceso-pedido',
            canMatch: [procesoGuard('TABLAS-BASICAS')],
            loadChildren: () =>
              import('@phoenix/inventarios/feature-estados-proceso-pedido').then(
                (m) => m.ESTADOS_PROCESO_PEDIDO_ROUTES,
              ),
          },
          {
            path: 'tipos-operacion',
            canMatch: [procesoGuard('TABLAS-BASICAS')],
            loadChildren: () =>
              import('@phoenix/basic/feature-tipos-operacion').then(
                (m) => m.TIPOS_OPERACION_ROUTES,
              ),
          },
          {
            path: 'tipos-venta',
            canMatch: [procesoGuard('TABLAS-BASICAS')],
            loadChildren: () =>
              import('@phoenix/basic/feature-tipos-venta').then(
                (m) => m.TIPOS_VENTA_ROUTES,
              ),
          },
          {
            path: 'motivos-anulacion',
            canMatch: [procesoGuard('TABLAS-BASICAS')],
            loadChildren: () =>
              import('@phoenix/inventarios/feature-motivos-anulacion').then(
                (m) => m.MOTIVOS_ANULACION_ROUTES,
              ),
          },
          {
            path: 'motivos-notas',
            canMatch: [procesoGuard('TABLAS-BASICAS')],
            loadChildren: () =>
              import('@phoenix/inventarios/feature-motivos-notas').then(
                (m) => m.MOTIVOS_NOTAS_ROUTES,
              ),
          },
          // Grupo "Tesorería" del hub. Los cuatro primeros van con TABLAS-BASICAS;
          // el quinto NO — ver su comentario.
          {
            path: 'condiciones-pago',
            canMatch: [procesoGuard('TABLAS-BASICAS')],
            loadChildren: () =>
              import('@phoenix/tesoreria/feature-condiciones-pago').then(
                (m) => m.CONDICIONES_PAGO_ROUTES,
              ),
          },
          {
            path: 'tipos-forma-pago',
            canMatch: [procesoGuard('TABLAS-BASICAS')],
            loadChildren: () =>
              import('@phoenix/tesoreria/feature-tipos-forma-pago').then(
                (m) => m.TIPOS_FORMA_PAGO_ROUTES,
              ),
          },
          {
            path: 'tipos-tarjeta',
            canMatch: [procesoGuard('TABLAS-BASICAS')],
            loadChildren: () =>
              import('@phoenix/tesoreria/feature-tipos-tarjeta').then(
                (m) => m.TIPOS_TARJETA_ROUTES,
              ),
          },
          {
            path: 'tipos-descuento',
            canMatch: [procesoGuard('TABLAS-BASICAS')],
            loadChildren: () =>
              import('@phoenix/tesoreria/feature-tipos-descuento').then(
                (m) => m.TIPOS_DESCUENTO_ROUTES,
              ),
          },
          {
            path: 'tipos-movimiento-caja',
            // ⚠ TIPMOVCAJA, no TABLAS-BASICAS. Esta pantalla cuelga del mismo hub
            // que las cuatro de arriba pero tiene permiso propio: TipMovCaj.php
            // declara `$segProcesoMenu=array("TIPMOVCAJA")` y sus stored procedures
            // comprueban ese mismo proceso. Copiar aquí el del hub la abriría a
            // quien no la tiene concedida.
            canMatch: [procesoGuard('TIPMOVCAJA')],
            loadChildren: () =>
              import('@phoenix/tesoreria/feature-tipos-movimiento-caja').then(
                (m) => m.TIPOS_MOVIMIENTO_CAJA_ROUTES,
              ),
          },
          // ── Catálogo (maestro de productos) ─────────────────────────
          // ⚠ Estas cinco NO cuelgan del hub TABLAS-BASICAS: son opciones de
          // menú propias bajo el padre 70 («Catalogo») y CADA UNA TIENE SU
          // PROPIO PROCESO. No están en `tablas.ts` y no deben añadirse ahí; el
          // interruptor strangler es `ruta_phoenix` en su fila de `basic.menuweb`
          // (74, 92, 73, 72 y 75 respectivamente).
          {
            path: 'unidades-medida',
            // De UnidadMedida.php:9. menuweb 74.
            canMatch: [procesoGuard('CAT-UNIDAD-MEDIDA')],
            loadChildren: () =>
              import('@phoenix/catalogo/feature-unidades-medida').then(
                (m) => m.UNIDADES_MEDIDA_ROUTES,
              ),
          },
          {
            path: 'unidades-base',
            // De Unidad.php:9. menuweb 92, «Unidad Base».
            // ⚠ Es OTRA tabla que unidades de medida (`catalogo.unidad` frente a
            // `catalogo.unidadmedida`) y otro permiso. Un producto necesita las
            // dos a la vez: ProductoEdit.php pinta los dos selectores.
            canMatch: [procesoGuard('CAT-UNIDAD')],
            loadChildren: () =>
              import('@phoenix/catalogo/feature-unidades-base').then(
                (m) => m.UNIDADES_BASE_ROUTES,
              ),
          },
          {
            path: 'marcas',
            // De Marca.php:9. menuweb 73.
            canMatch: [procesoGuard('CAT-MARCA')],
            loadChildren: () =>
              import('@phoenix/catalogo/feature-marcas').then(
                (m) => m.MARCAS_ROUTES,
              ),
          },
          {
            path: 'categorias',
            // De Categoria.php:9. menuweb 72.
            canMatch: [procesoGuard('CAT-CATEGORIA')],
            loadChildren: () =>
              import('@phoenix/catalogo/feature-categorias').then(
                (m) => m.CATEGORIAS_ROUTES,
              ),
          },
          {
            path: 'subcategorias',
            // De SubCategoria.php:8. menuweb 75.
            // ⚠ El legacy declara `array("CAT-CATEGORIA","CAT-SUBCATEGORIA")`,
            // que se evaluaba como OR. Aquí se exige solo el específico de la
            // pantalla; es una decisión tomada, no un descuido.
            canMatch: [procesoGuard('CAT-SUBCATEGORIA')],
            loadChildren: () =>
              import('@phoenix/catalogo/feature-subcategorias').then(
                (m) => m.SUBCATEGORIAS_ROUTES,
              ),
          },
          {
            path: 'lineas',
            // De Linea.php:9. menuweb 71.
            // ⚠ Su columna `orden` no servía para nada en el legacy: no existe
            // `palinea_cambiar_orden` y el `_leer` ordena por nombre a fuego. La
            // migración 0009 de Phoenix aporta las dos cosas.
            canMatch: [procesoGuard('CAT-LINEA')],
            loadChildren: () =>
              import('@phoenix/catalogo/feature-lineas').then(
                (m) => m.LINEAS_ROUTES,
              ),
          },
          {
            path: 'grupos',
            // De Grupo.php:9. menuweb 81, el primer nodo del grupo «Catalogo».
            canMatch: [procesoGuard('CAT-GRUPO')],
            loadChildren: () =>
              import('@phoenix/catalogo/feature-grupos').then(
                (m) => m.GRUPOS_ROUTES,
              ),
          },
          {
            path: 'laboratorios',
            // De Laboratorio.php:9. menuweb 91.
            canMatch: [procesoGuard('CAT-LABORATORIO')],
            loadChildren: () =>
              import('@phoenix/catalogo/feature-laboratorios').then(
                (m) => m.LABORATORIOS_ROUTES,
              ),
          },
          {
            path: 'colores',
            // De Color.php:9.
            // ⚠ Este proceso NO TENÍA FILA en `basic.menuweb`: al legacy solo se
            // llega por URL directa o desde el formulario de producto. La fila la
            // crea Phoenix (ver el README de phoenix-api), con el proceso que el
            // .php ya declaraba y no con uno inventado, para que el permiso valga
            // en las dos aplicaciones mientras convivan.
            canMatch: [procesoGuard('CAT-COLOR')],
            loadChildren: () =>
              import('@phoenix/catalogo/feature-colores').then(
                (m) => m.COLORES_ROUTES,
              ),
          },
          {
            path: 'tallas',
            // De Talla.php:9. Mismo caso que colores: proceso sin fila de menú en
            // el legacy, fila creada por Phoenix.
            canMatch: [procesoGuard('CAT-TALLA')],
            loadChildren: () =>
              import('@phoenix/catalogo/feature-tallas').then(
                (m) => m.TALLAS_ROUTES,
              ),
          },
          {
            path: 'productos',
            // De Producto.php:8, que declara `array("CAT-PRODUCTO")`. menuweb 76.
            // ⚠ UNA ruta para DOS grillas: productos detallados y masters son las
            // dos pestañas de la misma pantalla del legacy, comparten filtros y
            // comparten permiso. No se parten en dos.
            // ⚠ Y su fila de menú NO cuelga del padre 70 («Catalogo») como los diez
            // catálogos, sino del 1.
            canMatch: [procesoGuard('CAT-PRODUCTO')],
            loadChildren: () =>
              import('@phoenix/catalogo/feature-productos').then(
                (m) => m.PRODUCTOS_ROUTES,
              ),
          },
          {
            path: 'personas',
            // `procesoGuard` y no `permissionGuard`: en Phoenix la unidad de
            // permiso es `basic.menuweb.proceso`, no el par (menuid, acción) de
            // ezer. PERSONA es el mismo valor que usa $segProcesoMenu en el PHP,
            // y el backend revalida el mismo proceso con RequirePermiso.
            canMatch: [procesoGuard('PERSONA')],
            loadChildren: () =>
              import('@phoenix/basic/feature-personas').then(
                (m) => m.PERSONAS_ROUTES,
              ),
          },
        ],
      },
    ],
  },

  { path: '**', redirectTo: '' },
];
