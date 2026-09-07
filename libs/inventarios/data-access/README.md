# inventarios-data-access

Lib del módulo **inventarios** (existencias, ventas y pedidos del legacy pseraphis).

Servicios HTTP de los tres catálogos del módulo. Las rutas son relativas a
`API_BASE_URL`; el header `X-CSRF-Token` lo pone el `csrf-interceptor`.

## Tests

`nx test inventarios-data-access`
