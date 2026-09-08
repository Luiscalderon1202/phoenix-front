# phoenix-front

Front Angular del ERP **Phoenix**. Workspace Nx.

- Backend: `../phoenix-api` (repo separado).
- Referencia: `~/proyectos/ezer/ezer-front/erp`, de donde vienen las libs
  `shared/{ui,api,http,auth,util,domain}`.

## Versiones: no las cambies sin verificar en npm

| | |
|---|---|
| Angular | 22.0.x (zoneless) |
| Nx | 23.x — **Nx 22 NO soporta Angular 22** |
| TypeScript | **6.0.3** — Angular 22 exige `>=6.0 <6.1`; ni 5 ni 7 |
| Vitest | **4.x** — `@angular/build` pide `^4.0.8`; el 5 publicado no vale |

Kit de UI **propio**: sin PrimeNG (dejó de ser MIT en la v18), sin Material,
sin AG Grid.

## Cabecera de las pantallas con grilla

En un listado, la cabecera **no lleva subtítulo ni breadcrumbs**: la migaja repite
el título y el subtítulo describe lo evidente, y entre las dos se comen una franja
que la grilla aprovecha mejor.

```html
<erp-page-header title="Tipos de empresa" [breadcrumbs]="false" />
```

El `subtitle` se reserva para formularios especiales, donde de verdad explica algo
que el título no dice.

En el `erp-filter-panel`, los botones del slot `[filterActions]` van **en la misma
fila** que los campos, no en una franja debajo: esa franja costaba ~69px. Si los
campos necesitan todo el ancho, las acciones bajan solas a la línea siguiente.

Agrupa las acciones afines en un `erp-export-menu` (acepta `label`, `icon` y
`[options]` a medida) en vez de alinear botones sueltos: Exportar reúne Excel y
CSV, Imprimir reúne la vista PDF y la impresión de pantalla.

**El reporte PDF NO es estándar.** Una pantalla de mantenimiento lleva por defecto
solo el menú Exportar; el PDF se añade únicamente a los recursos que el usuario
pida, porque cada uno cuesta un endpoint, una definición de columnas en
`<modulo>/reportes/` y su sitio en el contrato. Hoy lo tiene Tipos de empresa.

Al imprimir, esa cabecera y el panel de filtros se ocultan y los sustituye
`erp-print-header`, que lleva el título, la fecha y los filtros APLICADOS
(el snapshot de la última búsqueda, no el formulario vivo).

## Cliente HTTP

Generado desde el contrato, no escrito a mano:

```bash
npm run api:client   # desde ../phoenix-api/api/openapi.yaml
```

No editar `libs/shared/api-client/src/lib/generated/`.

## Estrategia strangler

El menú lleva a dos aplicaciones. `MenuItem.migrado === false` significa que la
pantalla sigue en el PHP legacy: el sidebar usa `href` (navegación completa) en
vez de `routerLink`, y la marca con ↗. Migrar una pantalla es una fila en la BD
(`auth.pamenu_ruta_set`), sin desplegar el front.

## Permisos

`can(menuid, code)` acepta el comodín `'*'`: pseraphis concede el menú entero,
sin granularidad de acción. No cambiar sin leer el modelo de permisos.

## Boundaries

`@nx/enforce-module-boundaries` con ejes scope + type. Al migrar un módulo del
legacy hay que declarar su `scope:<modulo>` en `eslint.config.mjs`.

Scopes declarados: `shared` (base, no depende de nadie), `basic` (tablas básicas
y personas), `catalogo` (el maestro de productos: unidades, marcas, categorías y
subcategorías), `inventarios` (existencias, ventas y pedidos) y `tesorería` (caja,
cobros y pagos). Los tres últimos van **por encima** de `basic` — un pedido se
emite a una empresa, desde un almacén y para una persona, así que pueden mirar
hacia abajo y `basic` no puede mirar hacia arriba. Entre ellos todavía no se
conceden nada: las restricciones se abren cuando hay un import que las pida.

## Dónde va una pantalla de tabla básica

**Por el esquema de su tabla, no por el hub del que cuelga.** Las 40 opciones de
`TablasBasicas.php` viven en esquemas distintos, así que Tipos de consumo o
Canales de atención van a `libs/inventarios/`, no a `libs/basic/`, aunque el
usuario llegue a ellas desde el mismo índice y compartan el proceso de permiso
`TABLAS-BASICAS`. La ruta de la app sí las agrupa bajo `/mantenimiento/`, que es
lo que el usuario ve.

Migrar una de esas tablas es cambiar su `legacy` por `ruta` en
`libs/basic/feature-tablas-basicas/.../tablas.ts`. El menú no se toca.

⚠ **Y hay pantallas de mantenimiento que NO son tablas básicas.** Las cinco de
`libs/catalogo/` —unidades de medida, unidad base, marcas, categorías y
subcategorías— no aparecen en `TablasBasicas.php` ni en `tablas.ts`: son cinco
opciones de menú propias (`basic.menuweb` 72-75 y 92, bajo el padre 70
«Catalogo»), **cada una con su propio proceso de permiso** —`CAT-UNIDAD-MEDIDA`,
`CAT-UNIDAD`, `CAT-MARCA`, `CAT-CATEGORIA`, `CAT-SUBCATEGORIA`—. Migrar una de
ellas es poner su `ruta_phoenix` en su fila del menú
(`auth.pamenu_ruta_set(74, '/mantenimiento/unidades-medida')`), no tocar
`tablas.ts`. Comprueba siempre el `$segProcesoMenu` del `.php` antes de escribir
el `procesoGuard`: copiar el del vecino abre la pantalla a quien no la tiene
concedida.

## El proceso de permiso se decide por pantalla

Casi todas las tablas del hub van con `procesoGuard('TABLAS-BASICAS')`, pero eso
es una coincidencia, no una regla: **Tipos de movimiento de caja exige
`TIPMOVCAJA`**, porque así lo declara `TipMovCaj.php` y así lo comprueban sus
stored procedures. Antes de copiar el guard de la ruta de al lado, mirar el
`$segProcesoMenu` del `.php` que se está migrando.
