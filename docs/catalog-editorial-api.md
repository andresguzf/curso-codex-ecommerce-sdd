# Mutaciones editoriales del catálogo — 21.2

Solo `ADMIN` puede usar los comandos editoriales de los `PATCH` existentes. No se crean rutas alternativas ni se agregan controles de UI en esta tarea.

## Productos

`PATCH /api/v1/products/:productId` acepta `isFeatured: boolean`. La primera activación requiere un producto activo y asigna `featuredAt` desde el reloj del servidor. Repetir `true` o editar otros campos conserva la fecha. Retirar con `false` limpia la fecha y una activación posterior registra una fecha nueva. El cliente no puede enviar `featuredAt`, ni siquiera junto a otro campo válido.

La lectura y actualización bloquean el producto y la auditoría `PRODUCT_UPDATED` incluye ambos valores antes/después. Un fallo de auditoría revierte el comando. Desactivar o eliminar lógicamente un producto conserva sus metadatos históricos; un producto inactivo puede retirar el destaque, incluso si se ha retirado su portada. Destacar no cambia inventario, imágenes ni asociaciones de clasificación.

## Categorías

`PATCH /api/v1/categories/:categoryId` acepta:

- `showOnLanding: true` para seleccionar una categoría activa. Si no se envía posición, se asigna la primera libre entre 1 y 3.
- `landingOrder: 1 | 2 | 3` para elegir una posición o reordenar una categoría ya seleccionada.
- `showOnLanding: false` para retirarla y liberar su posición. Puede enviarse también `landingOrder: null`.

Cuando dos categorías activas ya seleccionadas intercambian posición, ambos cambios y ambas entradas `CATEGORY_UPDATED` se confirman juntos. Una selección nueva no desplaza silenciosamente a otra: una posición ocupada responde `409 CATEGORY_LANDING_POSITION_OCCUPIED`; una cuarta selección responde `409 CATEGORY_LANDING_LIMIT_EXCEEDED`. Los formatos o combinaciones inválidas responden `400`. No se exige un mínimo permanente de dos categorías: se admiten configuraciones parciales.

Los comandos de categoría toman un bloqueo transaccional de configuración antes de bloquear filas. Esto coordina selecciones simultáneas, reordenamiento y eliminación; las restricciones PostgreSQL siguen protegiendo posiciones y el máximo de tres. No cambian las asociaciones de productos. Los campos ausentes en un `PATCH` conservan descripción y estado, sin aplicar los defaults de creación.

Desactivar una categoría conserva su selección, que puede retirarse explícitamente; no se puede seleccionar o reordenar una categoría inactiva. Eliminarla lógicamente retira su selección y libera únicamente su posición en la misma operación auditada, evitando posiciones irrecuperables. Las posiciones de las otras categorías no se normalizan ni se cambian por una retirada.

## Lecturas y contratos

Las mutaciones y lecturas administrativas devuelven los metadatos editoriales. Los listados y detalles públicos de productos/categorías los omiten. Las etiquetas no admiten estos comandos. OpenAPI, el cliente TypeScript generado y los esquemas Zod incorporan los campos administrativos y las entradas nuevas.

El endpoint público agregado `/api/v1/catalog/landing` sigue pendiente de 21.3; los controles visuales corresponden a 21.4 y 21.5. No se modifica el seed en 21.2.

## Verificación y archivos

Las pruebas REST/PostgreSQL cubren activación/retirada, fechas autoritativas, repetición, permisos negativos para visitante/CUSTOMER/BILLING, ocultación pública, categoría inactiva, máximo de tres, posiciones, intercambio, retirada, conservación de asociaciones, concurrencia y rollback de productos/categorías por fallo de auditoría. Las pruebas de contrato ahora crean y migran una base temporal propia, sin depender del esquema de la base de desarrollo.

Verificación satisfactoria: `pnpm test` (incluye 289 pruebas del API y 42 de esquemas), `pnpm typecheck`, `pnpm lint`, `pnpm build` y `pnpm contract:check`. Se regeneraron OpenAPI y el cliente TypeScript sin diferencias pendientes de generación. No se modificó UI ni se ejecutaron pruebas visuales en esta tarea.

Archivos de esta tarea:

- `apps/api/src/product-catalog/product-administration.controller.ts`, `product-administration.service.ts`, `product-administration.repository.ts`, `product-administration.types.ts` y `product-listing.controller.ts`.
- `apps/api/src/product-catalog/classification.controller.ts`, `classification.service.ts`, `classification.repository.ts` y `classification.types.ts`.
- `apps/api/openapi/openapi.json` y `packages/api-client/src/generated/openapi.ts`.
- `packages/api-schemas/src/products.ts`, `packages/api-schemas/src/classifications.ts` y sus pruebas `packages/api-schemas/test/products.spec.ts` y `classifications.spec.ts`.
- `apps/api/test/product-catalog/product-administration.integration.spec.ts` y `apps/api/test/openapi/openapi-contract.integration.spec.ts`.
- `docs/catalog-editorial-api.md`, `docs/catalog-editorial-model.md` y `openspec/changes/build-technology-ecommerce-platform/tasks.md`.

Se preservan los cambios previos del árbol de trabajo; no se atribuyen a esta tarea. La migración aditiva 0014 pertenece a 21.1 y se aplica al entorno local de desarrollo para habilitar las consultas nuevas, sin repoblar el catálogo.
