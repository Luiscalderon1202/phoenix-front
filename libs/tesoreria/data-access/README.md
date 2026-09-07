# tesoreria-data-access

Lib del módulo **tesorería** (caja, cobros y pagos del legacy pseraphis).

Servicios HTTP de los cinco catálogos del módulo. Las rutas son relativas a
`API_BASE_URL`; el header `X-CSRF-Token` lo pone el `csrf-interceptor`.

## Tests

`nx test tesoreria-data-access`
