# shared-api-client

Cliente HTTP **generado** desde `../phoenix-api/api/openapi.yaml`.

```bash
npm run api:client   # regenera tras cambiar el contrato
```

No edites `src/lib/generated/`: se sobrescribe entero en cada generacion.

Los modelos que expone (`AuthUser`, `MenuItem`, `MenuPermiso`, `Envelope`…)
sustituyen progresivamente a los tipos escritos a mano en `shared/auth` y
`shared/api`. Mientras dure la transicion conviven; la referencia es esta.
