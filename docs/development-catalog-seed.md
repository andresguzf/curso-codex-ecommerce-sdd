# Seed del catálogo de desarrollo — 20.4

El seed explícito crea o actualiza **20 SKU de demostración**, 4 categorías (`dev-laptop`, `dev-monitor`, `dev-keyboard`, `dev-phone`), 2 etiquetas y 40 asociaciones producto-etiqueta. Cada producto tiene slug, descripción, precio decimal positivo en USD, categoría principal y tres imágenes ordenadas del manifiesto de 20.3, con exactamente una portada. Hay 18 productos activos y 2 inactivos.

En una base vacía produce 60 imágenes, 20 balances y 20 movimientos `OPENING`. Los tres SKU originales conservan sus identificadores y los de sus portadas; sus balances existentes no se recrean. Los slugs ya publicados se conservan.

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
- Las claves naturales son SKU, slug de clasificación y clave de imagen; se conservan identificadores. El namespace `DEV-*`/`dev-*` y sus fichas son datos administrados por el seed.
- No elimina productos ni clasificaciones ajenos para forzar un conteo global de veinte. Es exactamente veinte productos **del seed**; una base con productos adicionales conserva esos registros.
- Actualiza las fichas demo y sus tres imágenes, conserva imágenes adicionales de administradores y no reasigna una clave de imagen perteneciente a otro producto.
- Si existe un balance, conserva cantidad y versión: nunca repone unidades vendidas ni crea ajustes para restablecer el stock inicial. Solo un balance nuevo genera su movimiento de apertura, dentro de la misma transacción.
- Conserva un perfil empresarial ya configurado. El resultado `inventoryMovements` cuenta los movimientos de apertura **creados en esa ejecución**, normalmente cero en la segunda; los otros conteos describen las asociaciones administradas por el seed, no todos los datos de la base.

## Verificación

```sh
pnpm --filter @technology-ecommerce/api exec vitest run test/database/development-seed.integration.spec.ts
```

Las pruebas crean una base PostgreSQL aislada y la eliminan al finalizar, sin poblar la base local de la tienda. Comprueban actualización desde los tres SKU antiguos, conteos, claves, relaciones, USD, estados, portada/orden/metadatos, movimientos de apertura, estabilidad de IDs, segunda ejecución, concurrencia, conservación del stock consumido y de imágenes adicionales, rollback ante fallo y rechazo de producción.

Esta tarea no implementa el contrato público de galería (20.6), su UI (20.9) ni la composición editorial de landing (fase 21).
