# Phoenix ERP – Frontend

Frontend del sistema ERP **Phoenix**, construido con **Angular 22** en un monorepo **Nx**.

## Stack Tecnológico

| Capa             | Tecnología                        |
| ---------------- | --------------------------------- |
| Framework        | Angular 22                        |
| Monorepo         | Nx 23                             |
| Lenguaje         | TypeScript 6                      |
| Estilos          | SCSS                              |
| Build            | Angular Build (esbuild + Vite)    |
| Testing          | Vitest + Analog                   |
| E2E              | Playwright                        |
| Linting          | ESLint 9 + angular-eslint         |
| Formateo         | Prettier                          |
| Gráficos         | Chart.js                          |

## Estructura del Proyecto

```
phoenix-front/
├── apps/
│   ├── erp/                    # Aplicación principal del ERP
│   └── erp-e2e/                # Tests end-to-end (Playwright)
├── libs/
│   ├── basic/                  # Módulos de negocio
│   │   ├── data-access/        #   Servicios y estado (API calls)
│   │   ├── domain/             #   Modelos e interfaces del dominio
│   │   ├── feature-personas/   #   Feature: gestión de personas
│   │   ├── feature-tablas-basicas/ # Feature: índice de los 40 catálogos
│   │   └── feature-tipos-empresa/ # Feature: tipos de empresa (CRUD + PDF)
│   └── shared/                 # Librerías compartidas
│       ├── api/                #   Endpoints y tipos de la API
│       ├── api-client/         #   Cliente HTTP generado (OpenAPI)
│       ├── auth/               #   Autenticación, guards y login
│       ├── domain/             #   Modelos compartidos (flags, enums)
│       ├── http/               #   Interceptors, CSRF, refresh tokens
│       ├── ui/                 #   Componentes UI reutilizables
│       └── util/               #   Utilidades (export, base64, etc.)
├── nx.json                     # Configuración del workspace Nx
├── package.json                # Dependencias del proyecto
└── tsconfig.base.json          # TypeScript base config
```

## Requisitos Previos

- **Node.js** >= 22
- **npm** >= 10
- **Backend** (phoenix-api) corriendo en `http://localhost:8080`

## Instalación

```bash
# Clonar el repositorio
git clone https://github.com/Luiscalderon1202/phoenix-front.git
cd phoenix-front

# Instalar dependencias
npm install
```

## Iniciar el Proyecto

```bash
# Servidor de desarrollo (http://localhost:4200)
npx nx serve erp
```

El servidor incluye un proxy que redirige las peticiones `/api` al backend en `http://localhost:8080`.

## Otros Comandos Útiles

```bash
# Build de producción
npx nx build erp --configuration=production

# Ejecutar tests unitarios
npx nx test erp

# Ejecutar tests E2E
npx nx e2e erp-e2e

# Lint
npx nx lint erp

# Ver el grafo de dependencias
npx nx graph
```

## Tablas básicas y la migración por partes

`/mantenimiento/tablas-basicas` replica el índice de `TablasBasicas.php`: 40
catálogos en 11 grupos. Cada tarjeta enlaza a la ruta Angular si esa tabla ya está
migrada, o al `.php` del legacy si no, marcándolo con ↗.

Migrar una tabla es cambiar dos líneas en
`libs/basic/feature-tablas-basicas/src/lib/tablas-basicas/tablas.ts`: se sustituye
su `legacy` por la `ruta` nueva. El menú no se toca.

Si el legacy vive en otro host (lo normal en desarrollo), se declara en
`assets/config.json`:

```json
{ "apiBaseUrl": "/api", "legacyBaseUrl": "http://localhost/pseraphis" }
```

## Personas: alta y edición

El formulario es **página propia** (`/mantenimiento/personas/nueva` y
`/mantenimiento/personas/:id`), no un modal: tiene dos variantes según el tipo de
persona y cuatro listas dinámicas más los roles.

⚠ **Las cinco listas se guardan por REEMPLAZO.** El backend borra lo que no llegue, así
que la página carga la ficha entera antes de editar y la manda entera al guardar. Los
teléfonos y emails existentes viajan con su id para que se actualicen; con id 0 el
backend daría de alta uno nuevo y borraría el viejo.

⚠ **La fecha de nacimiento es obligatoria para una persona natural** — la columna es
NOT NULL — y no para una jurídica. Los `required` se mueven al cambiar el tipo.

⚠ **El permiso no es solo el del menú**: el backend comprueba además `persona-add` /
`persona-edit` contra el segundo sistema de permisos del legacy, que no tiene paso libre
para el superusuario. Sale como 403 y lo notifica el interceptor.

La **foto** no se edita aquí: tiene su propia pantalla en el legacy y su propio permiso.

### Un control reactivo NO es una señal

Vale para toda la app:

```ts
// ✗ se calcula UNA vez y no vuelve a recalcularse: la plantilla se queda congelada
readonly esNatural = computed(() => this.form.controls.tipo.value === 'N');

// ✓ señal actualizada desde valueChanges
readonly esNatural = signal(true);
```

Un `computed` solo reacciona a señales. Leer dentro de él el `value` de un
`FormControl` compila, parece funcionar en la primera pintada y luego nunca cambia: aquí
dejaba el formulario mostrando para siempre la mitad de persona natural.

## Empresas y Locales

Dos pantallas nuevas bajo `/mantenimiento`, cada una con su propio proceso de
permiso: `EMPRESA` (`basic.menuweb` 6) y `ALMACEN` (69). **No cuelgan del hub de
Tablas Básicas.**

⚠ `EMPRESA` decide quién puede MANTENER el catálogo de empresas. No es el ámbito
multiempresa: quién puede operar sobre los datos de una empresa concreta lo decide
`basic.permisos_empresa` y viaja como `?empresaid=`.

⚠ La tabla del legacy se llama `almacen`, pero la pantalla son **LOCALES**: la sede
física desde la que se vende, no un depósito.

Las dos son el MANTENIMIENTO. Fuera quedan la configuración de la empresa
(certificados, series, correlativos, SUNAT) y la de venta por local, que son otro
tramo.

**El reparto entre servidor y cliente no es el mismo en las dos, y conviene saber
por qué antes de tocarlas:**

| | Empresas | Locales |
|---|---|---|
| Filtros al servidor | **ninguno** | texto, zona, unidad de negocio y tipo |
| Filtros en cliente | texto y estado | estado |
| Paginación | cliente | cliente |
| Borrado en lote | no | no |

Lo de empresas no es una decisión de la pantalla: **`basic.paempresa_leer()` no
acepta ningún argumento**, así que no hay nada que delegarle. Su `resource` no lleva
`params` y se recarga a mano.

El distrito **no es un desplegable**: son 1.839 filas y el backend exige acotar la
búsqueda (dos caracteres, o un departamento, o una provincia). `ReferenciaApi`
aplica el mismo corte antes de salir a la red, porque ese endpoint se dispara al
teclear. Por eso los formularios tienen un buscador propio delante del combo.

Zona, unidad de negocio y corporación se sirven de **solo lectura** desde
`/catalogos/*`: ninguno tiene pantalla de mantenimiento, ni aquí ni en el legacy.

### Un `resource` en error LANZA al leer su valor

Vale para toda la app, no solo para estas dos pantallas:

```ts
// ✗ si el resource está en error, esto lanza ResourceValueError durante el render
// y se lleva por delante la pantalla ENTERA: ni grilla, ni aviso, nada.
computed(() => this.catalogoRes.value() ?? [])

// ✓
computed(() => this.catalogoRes.hasValue() ? this.catalogoRes.value() : [])
```

Visto en vivo: un 500 en `/tipos-empresa` dejaba la pantalla de locales en blanco.
Que un desplegable no cargue tiene que degradar ese desplegable, no la pantalla.

## Cliente de la API

El contrato es `../phoenix-api/api/openapi.yaml`, en el **otro repositorio**. Los dos
no comparten código: solo ese archivo.

```bash
npm run api:client    # regenera libs/shared/api-client desde el spec
```

Tras cambiar el backend hay que regenerarlo, o los tipos se quedan mintiendo en
silencio.

## Arquitectura

El proyecto sigue una **arquitectura por capas** dentro del monorepo:

- **`feature-*`** → Páginas y componentes inteligentes (smart components)
- **`data-access`** → Servicios, stores y llamadas a la API
- **`domain`** → Interfaces, tipos y modelos de datos
- **`ui`** → Componentes presentacionales reutilizables (dumb components)
- **`util`** → Funciones auxiliares sin dependencia de Angular
- **`auth`** → Manejo de sesión, guards, interceptors de autenticación


