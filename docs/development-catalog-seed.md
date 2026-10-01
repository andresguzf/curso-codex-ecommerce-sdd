# Seed del catálogo de desarrollo — 20.4 y 21.6

El seed explícito crea o actualiza **20 SKU de demostración**, 4 categorías (`dev-laptop`, `dev-monitor`, `dev-keyboard`, `dev-phone`), 2 etiquetas y 40 asociaciones producto-etiqueta. Cada producto tiene slug, descripción, precio decimal positivo en USD, categoría principal y tres imágenes ordenadas del manifiesto de 20.3, con exactamente una portada. Hay 18 productos activos y 2 inactivos.

En una base vacía produce 60 imágenes, 20 balances y 20 movimientos `OPENING`. Los tres SKU originales conservan sus identificadores y los de sus portadas; sus balances existentes no se recrean. Los slugs ya publicados se conservan.

## Composición editorial reproducible — 21.6

El seed configura exactamente tres productos activos destacados: `DEV-LAPTOP-001`, `DEV-MONITOR-001` y `DEV-PHONE-001`. Sus fechas fijas de destaque son respectivamente el 2, 3 y 4 de enero de 2026 a las 00:00 UTC; por tanto la sección pública presenta primero el smartphone, después el monitor y finalmente el notebook. Los otros quince productos activos siguen disponibles para completar los nueve recientes sin repetir destacados.

Selecciona tres categorías activas: `dev-laptop` en posición 1, `dev-monitor` en posición 2 y `dev-phone` en posición 3. `dev-keyboard` queda fuera de esa selección, pero sus productos siguen formando parte del catálogo. Cada categoría seleccionada tiene al menos tres productos activos para completar su sección.

Las fechas de creación de las **fichas demo** se normalizan al 1 de enero de 2026 a las 00:00 UTC más un minuto por posición en el manifiesto de imágenes. Son fechas sintéticas, no evidencia histórica de altas reales. Evitan que UUID aleatorios decidan el orden de recientes en bases nuevas; `updatedAt` sigue reflejando la escritura real. Una reejecución restaura las banderas, fechas y posiciones demo, incluidos cambios editoriales administrativos dentro del namespace del seed, sin alterar identificadores, slugs publicados, inventario operativo ni datos históricos de órdenes/facturas.

La composición completa se verifica mediante `GET /api/v1/catalog/landing`: tres destacados, nueve recientes deduplicados y tres categorías con tres productos cada una. Una base con productos o destaques administrativos adicionales los conserva y puede mostrar una composición distinta según sus fechas; no se vacía la tienda para forzar el contenido demo.

## Ejecución explícita

```sh
pnpm --filter @technology-ecommerce/api db:migrate
NODE_ENV=development pnpm --filter @technology-ecommerce/api db:seed
```

Requiere `NODE_ENV` explícito, `DATABASE_URL` y las variables privadas `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_BILLING_EMAIL`, `SEED_BILLING_PASSWORD`, `SEED_CUSTOMER_EMAIL`, `SEED_CUSTOMER_PASSWORD`. No hay ejecución automática al iniciar el API. La configuración y las pruebas de login de las tres cuentas se documentan desde 20.5 en [usuarios demo](development-user-seed.md). No se añaden credenciales locales al repositorio.

Solo se aceptan los entornos `development` y `test`; producción y valores desconocidos fallan antes de abrir la conexión. No solicita imágenes por red ni carga assets: persiste las referencias temporales y metadatos revisados del [manifiesto](development-image-manifest.md).

## Reejecución y seguridad

- Una única transacción incluye usuarios, perfil y catálogo; cualquier fallo revierte toda la operación.
- Un bloqueo transaccional serializa las ejecuciones concurrentes del seed.
- La configuración de categorías comparte además el bloqueo editorial de las mutaciones administrativas. Primero libera solo posiciones de categorías demo dentro de la transacción y luego restaura 1/2/3, evitando colisiones si fueron intercambiadas. Si una selección ajena al seed ocupa una posición, falla y revierte toda la operación: un administrador debe retirarla explícitamente si desea reemplazarla por la configuración demo. Nunca se retiran selecciones ajenas automáticamente.
- Las claves naturales son SKU, slug de clasificación y clave de imagen; se conservan identificadores. El namespace `DEV-*`/`dev-*` y sus fichas son datos administrados por el seed.
- No elimina productos ni clasificaciones ajenos para forzar un conteo global de veinte. Es exactamente veinte productos **del seed**; una base con productos adicionales conserva esos registros.
- Actualiza las fichas demo y sus tres imágenes, conserva imágenes adicionales de administradores y no reasigna una clave de imagen perteneciente a otro producto.
- Si existe un balance, conserva cantidad y versión: nunca repone unidades vendidas ni crea ajustes para restablecer el stock inicial. Solo un balance nuevo genera su movimiento de apertura, dentro de la misma transacción.
- Conserva un perfil empresarial ya configurado. El resultado `inventoryMovements` cuenta los movimientos de apertura **creados en esa ejecución**, normalmente cero en la segunda; los otros conteos describen las asociaciones administradas por el seed, no todos los datos de la base.

## Verificación

```sh
pnpm --filter @technology-ecommerce/api exec vitest run test/database/development-seed.integration.spec.ts
```

Las pruebas crean una base PostgreSQL aislada y la eliminan al finalizar, sin poblar la base local de la tienda. Comprueban actualización desde los tres SKU antiguos, conteos, claves, relaciones, USD, estados, portada/orden/metadatos, movimientos de apertura, estabilidad de IDs, segunda ejecución, concurrencia, conservación del stock consumido y de imágenes adicionales, rollback ante fallo y rechazo de producción. Desde 21.6 también verifican la respuesta editorial 3/9/3, tres productos por categoría, restauración tras cambiar destaques e intercambiar posiciones, estabilidad de fechas/composición en dos reejecuciones y rechazo atómico al encontrar selecciones ajenas.

El contrato público de galería y su UI ya se implementaron en 20.6 y 20.9. La tarea 21.6 prepara los datos editoriales; no implementa las secciones visuales de destacados y categorías en la landing, que corresponden a 21.7. Esta implementación se verifica en una base aislada: no ejecuta el seed contra la base local de la tienda.

Verificación de 21.6: 308 pruebas del API exitosas, incluidas nueve pruebas de seed; typecheck, lint, build y validación OpenSpec estricta exitosos. Archivos modificados: `apps/api/src/database/seed/catalog-seed.ts`, `apps/api/test/database/development-seed.integration.spec.ts`, este documento y el checklist `openspec/changes/build-technology-ecommerce-platform/tasks.md`.
