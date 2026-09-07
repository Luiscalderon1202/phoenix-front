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
│   │   └── feature-personas/   #   Feature: gestión de personas
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

## Arquitectura

El proyecto sigue una **arquitectura por capas** dentro del monorepo:

- **`feature-*`** → Páginas y componentes inteligentes (smart components)
- **`data-access`** → Servicios, stores y llamadas a la API
- **`domain`** → Interfaces, tipos y modelos de datos
- **`ui`** → Componentes presentacionales reutilizables (dumb components)
- **`util`** → Funciones auxiliares sin dependencia de Angular
- **`auth`** → Manejo de sesión, guards, interceptors de autenticación


