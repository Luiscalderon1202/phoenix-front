import nx from '@nx/eslint-plugin';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: [
      '**/dist',
      '**/vite.config.*.timestamp*',
      '**/vitest.config.*.timestamp*',
      '**/disenio/**',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: [],
          depConstraints: [
            // ---- Eje SCOPE (layering de dominios) ----
            // `shared` es la base: no puede depender de ningún dominio.
            {
              sourceTag: 'scope:shared',
              onlyDependOnLibsWithTags: ['scope:shared'],
            },
            // Al ir migrando módulos del legacy (pseraphis) se agrega aquí un
            // `scope:<modulo>` por dominio, siempre pudiendo depender de
            // `scope:shared` y de los dominios que estén por debajo suyo.
            //
            // `basic` = mantenimiento de las tablas básicas del legacy (Personas y
            // los catálogos que cuelgan de ella). Es el primer dominio migrado y no
            // hay ninguno por debajo suyo, así que solo mira a `shared` y a sí mismo.
            {
              sourceTag: 'scope:basic',
              onlyDependOnLibsWithTags: ['scope:shared', 'scope:basic'],
            },
            // `catalogo` = el maestro de productos: unidades de medida, unidad
            // base, marcas, categorías y subcategorías. Va POR ENCIMA de
            // `basic` y POR DEBAJO de `inventarios`: un pedido apunta a un
            // producto, y un producto a una marca y a una subcategoría, pero el
            // catálogo no sabe nada de almacenes ni de pedidos.
            //
            // ⚠ Estas pantallas NO cuelgan del hub `TABLAS-BASICAS`: son cinco
            // opciones de menú propias (`basic.menuweb` 72-75 y 92, bajo el
            // padre 70 «Catalogo») y cada una tiene su propio proceso de
            // permiso. Por eso viven en su propio scope y no dentro de `basic`.
            {
              sourceTag: 'scope:catalogo',
              onlyDependOnLibsWithTags: ['scope:shared', 'scope:basic', 'scope:catalogo'],
            },
            // `inventarios` = existencias, ventas y pedidos. Va POR ENCIMA de
            // `basic`: un pedido se emite a una empresa, desde un almacén y para
            // una persona, así que puede mirar hacia abajo. `basic` no puede
            // mirar hacia aquí, y esa es toda la gracia de declararlo.
            {
              sourceTag: 'scope:inventarios',
              onlyDependOnLibsWithTags: ['scope:shared', 'scope:basic', 'scope:inventarios'],
            },
            // `tesoreria` = caja, cobros y pagos. Como `inventarios`, va por
            // encima de `basic`: un cobro se registra contra una empresa y una
            // persona. Todavía no depende de `inventarios` y no se le concede
            // hasta que lo necesite: las restricciones se abren cuando hay un
            // import que las pida, no por si acaso.
            {
              sourceTag: 'scope:tesoreria',
              onlyDependOnLibsWithTags: ['scope:shared', 'scope:basic', 'scope:tesoreria'],
            },
            { sourceTag: 'scope:app', onlyDependOnLibsWithTags: ['*'] },

            // ---- Eje TYPE (capas dentro de cada scope) ----
            {
              sourceTag: 'type:shell',
              onlyDependOnLibsWithTags: [
                'type:feature',
                'type:ui',
                'type:data-access',
                'type:domain',
                'type:util',
              ],
            },
            {
              sourceTag: 'type:feature',
              onlyDependOnLibsWithTags: [
                'type:feature',
                'type:ui',
                'type:data-access',
                'type:domain',
                'type:util',
              ],
            },
            {
              sourceTag: 'type:ui',
              onlyDependOnLibsWithTags: ['type:ui', 'type:domain', 'type:util'],
            },
            {
              sourceTag: 'type:data-access',
              onlyDependOnLibsWithTags: [
                'type:data-access',
                'type:domain',
                'type:util',
              ],
            },
            {
              sourceTag: 'type:domain',
              onlyDependOnLibsWithTags: ['type:domain', 'type:util'],
            },
            { sourceTag: 'type:util', onlyDependOnLibsWithTags: ['type:util'] },
            { sourceTag: 'type:app', onlyDependOnLibsWithTags: ['*'] },
          ],
        },
      ],
    },
  },
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.jsx',
      '**/*.cjs',
      '**/*.mjs',
    ],
    // Override or add rules here
    rules: {},
  },
];
