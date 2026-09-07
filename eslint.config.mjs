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
