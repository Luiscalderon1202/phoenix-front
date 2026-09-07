// Sub-barrel "chrome": SOLO las piezas del armazón de la app (navbar, sidebar, feedback, icono…)
// que el grafo EAGER (main-layout) necesita. NINGUNA de estas importa `chart.js`.
//
// Por qué existe: el barrel principal `@phoenix/shared/ui` hace `export *` de los gráficos, y
// `chart.js` tiene side-effects que esbuild no puede tree-shakear; si el layout eager importa
// del barrel ancho, se lo arrastra al bundle INICIAL. Las pantallas lazy siguen usando
// `@phoenix/shared/ui`; solo el código eager importa desde aquí.

// feedback (toasts + confirmaciones)
export * from './lib/feedback/notification-service';
export * from './lib/feedback/toaster';
export * from './lib/feedback/confirm-service';
export * from './lib/feedback/confirm-dialog';

// app shell (chrome)
export * from './lib/icon/icon';
export * from './lib/icon/icon-registry';
export * from './lib/modal/modal';
export * from './lib/navbar/navbar';
export * from './lib/user-menu/user-menu';
export * from './lib/sidebar/sidebar';
export * from './lib/nav-tree/nav-tree';
export * from './lib/breadcrumbs/breadcrumbs';
export * from './lib/nav-tree-config';
export * from './lib/ui-preferences-store';
