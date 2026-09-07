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
