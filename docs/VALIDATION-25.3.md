# 25.3 — evidencia parcial de despliegue y corrección ESM

Fecha: 2026-10-05. Cambio: `build-technology-ecommerce-platform`.
La tarea sigue abierta; 25.4 no se ha iniciado.

## Incidente y corrección

El usuario confirmó el dominio API
`https://curso-codex-ecommerce-sdd.vercel.app` y aportó el error de runtime
`ERR_REQUIRE_ESM`: `apps/api/src/main.js` intentaba cargar mediante `require`
el paquete ESM `@nestjs/config@12.0.0`. El error persistió tras seleccionar
Node 22.x y reconstruir sin caché. Cambiar variables de entorno no corrige
esa incompatibilidad de formato.

Se configuró únicamente el API con `type: module` y TypeScript NodeNext.
Los imports relativos de fuente, herramientas y pruebas del API se ajustaron
mecánicamente a `.js` o `/index.js`; no se cambiaron consultas, reglas de negocio,
versiones de dependencias, migraciones, contratos HTTP ni aplicaciones frontend.
Cuatro pruebas adaptan la interoperabilidad de los imports de AJV/ajv-formats.
El lector de la única imagen histórica empaquetada usa una URL literal relativa
a `import.meta.url`, conservando bytes, clave y SHA-256.

## Archivos

- `apps/api/package.json` y `apps/api/tsconfig.json`: formato ESM/NodeNext.
- `apps/api/src/**/*.ts`, `apps/api/test/**/*.ts` y `apps/api/drizzle.config.ts`:
  rutas relativas explícitas; el tamaño del diff refleja este ajuste mecánico.
- `apps/api/src/product-catalog/image-storage/bundled-catalog-image.ts`:
  resolución de recurso compatible con ESM y file tracing.
- `apps/api/test/deployment/esm-runtime.spec.ts`: nuevo smoke del código compilado.
- `docs/vercel-course-deployment.md`, este informe y diseño/tasks OpenSpec:
  instrucciones y evidencia parcial, sin marcar terminada la tarea.

## Verificación local

- `pnpm --filter @technology-ecommerce/api build`: correcto.
- `pnpm --filter @technology-ecommerce/api typecheck`: correcto.
- `pnpm --filter @technology-ecommerce/api lint`: correcto.
- Pruebas API, excluyendo integración, e2e y contratos que requieren infraestructura:
  **186 pruebas en 26 archivos**, correctas.
- `pnpm openapi:check`: correcto; `apps/api/openapi/openapi.json` sin diferencias.
- File tracing del lector compilado con `@vercel/nft` distribuido por Next:
  PNG histórico incluido, cero advertencias.

El smoke compila las fuentes actuales, carga el grafo NestJS y configura HTTP
en un proceso Node con `--no-experimental-require-module`. Verifica respuestas
reales in-process del SVG empresarial y PNG histórico, incluida su huella.
Usa configuración ficticia offline, bloquea operaciones de PostgreSQL y omite
solo el readiness query; `VERCEL=1` impide los timers permanentes. No realiza
uploads ni llamadas reales a Cloudinary. No simula el wrapper interno de Vercel,
ni acredita conectividad real, login, cron o despliegue remoto.

## Límites y próximos pasos

No se editaron archivos privados `.env`, conexiones activas, datos, assets
remotos, seed, migraciones o ejecutores periódicos. El usuario autorizó commit
y push de esta corrección, para activar el despliegue automático existente.

El health del API se verificó posteriormente con HTTP 200, base `up`, catálogo
HTTP 200 y OpenAPI HTTP 200 (47 paths). El error ESM dejó de aparecer; el usuario
configuró las variables de autenticación que faltaban en Vercel.

Quedan pendientes los dominios y despliegues
storefront/backoffice, URLs/CORS definitivos y corte del ejecutor local antes
de habilitar el cron remoto. No activar limpieza ni probar compras sin la
autorización correspondiente. El placeholder compartido de CRON_SECRET debe
reemplazarse por un secreto aleatorio privado antes de habilitar el cron.

## Corrección del empaquetado frontend — 2026-10-06

El log del storefront mostró Next.js 16.3.4, compilación y TypeScript correctos,
pero `onBuildComplete` de Vercel falló por ausencia de
`.next/next-server.js.nft.json`. Ambos `next.config.ts` forzaban standalone.
La corrección autorizada conserva ese modo fuera de Vercel y lo desactiva
cuando `VERCEL=1`, sin alterar rewrites, tracing root, imágenes, rutas o UI.
Incidente relacionado: https://github.com/vercel/next.js/issues/96646.

Archivos: `apps/storefront/next.config.ts`, `apps/backoffice/next.config.ts`,
`apps/api/test/deployment/vercel-config.spec.ts`, guía de despliegue, este informe
y evidencia de tasks OpenSpec. Ocho pruebas de configuración pasaron, incluidos
los dos modos de output en ambas apps y los rewrites REST. Typecheck y lint de
ambos frontends correctos. Builds Next.js con `VERCEL=1`, REST same-origin y
directorio aislado `.next-vercel-validation` correctos en ambas aplicaciones.
Esta prueba local no incluye el hook propietario `onBuildComplete` de Vercel;
el build y la accesibilidad remotos quedan por verificar tras el push autorizado.
No se modificaron `.env`, dependencias, datos ni assets y no se activó cron.
25.3 sigue pendiente y 25.4 no se inicia.
