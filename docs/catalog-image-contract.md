# Contrato de portada y galería — 20.6

`GET /api/v1/products` devuelve `coverImage` en cada elemento, tanto en el listado público como en `view=administrative`. El listado nunca devuelve `images` ni carga galerías: paginación y conteo siguen siendo por producto, aunque tenga múltiples imágenes.

`GET /api/v1/products/:productId` y `GET /api/v1/products/slug/:slug` incluyen la misma portada y `images`, ordenadas por `sortOrder ASC, id ASC`. La consulta de detalle usa una transacción de lectura `REPEATABLE READ`: portada, clasificación, disponibilidad y galería proceden del mismo snapshot. La portada puede estar en cualquier posición, no necesariamente en la primera.

Cada imagen pública contiene `id`, `storageKey`, `url`, `altText`, `isPrimary`, `sortOrder`, `width`, `height` y `mimeType`. No incluye `productId`, fechas de persistencia ni datos del proveedor. Los metadatos ausentes en registros antiguos son `null`; no se inventan dimensiones.

## Ausencia de portada y fallback

- Un producto activo mantiene exactamente una portada por las restricciones de 20.1. Una imagen local placeholder administrada cuenta como portada y conserva su identificador y texto alternativo.
- Los borradores inactivos sin portada pueden consultarse por `ADMIN` usando `view=administrative`; `coverImage` será `null`. `images` conserva las imágenes existentes no seleccionadas, o es `[]` si no hay ninguna. No se fabrica una imagen de galería con un UUID falso.
- Una referencia sin portada no hace desaparecer el borrador de la lista administrativa. Las lecturas públicas excluyen inactivos, eliminados y referencias sin portada; el detalle público responde 404.
- `image` se conserva temporalmente como referencia `{ storageKey, url }` para compatibilidad con las pantallas existentes, y se marca deprecated en OpenAPI. Sin portada, apunta al fallback local `/images/product-placeholder.svg`.
- Los consumidores nuevos deben elegir `coverImage` para tarjetas, y mostrar un fallback accesible cuando sea `null` o la URL falle. El backend no descarga ni verifica URLs remotas al leer el catálogo. La galería interactiva y sus fallbacks corresponden a 20.9; esta tarea no implementa el carrusel.
- No cambia el contrato de creación/edición comercial ni se reemplazan snapshots históricos de carrito, órdenes o facturas. Wishlist conserva su proyección actual; la adaptación de sus tarjetas pertenece al trabajo de presentación posterior.

## Contratos y pruebas

OpenAPI define `CatalogImageDto`; el cliente TypeScript se regenera con `pnpm openapi:generate`. `packages/api-schemas` exporta `catalogImageSchema` y `CatalogImage`; los esquemas de listado requieren `coverImage` y los de detalle también requieren `images`. No se aceptan respuestas antiguas que omitan estos campos, ni IDs/dimensiones/posiciones inválidos.

Las pruebas PostgreSQL/REST verifican listas sin duplicación, portada en posición distinta de cero, orden de galería, equivalencia de las dos rutas de detalle, una sola imagen, borradores vacíos/sin portada, placeholder y visibilidad pública. Se validan respuestas reales contra OpenAPI mediante AJV. Las fixtures de las pruebas de frontend y autocomplete se actualizan al nuevo contrato sin cambiar su UI.

### Verificación realizada

- `pnpm contract:check`: contrato generado y OpenAPI coherentes.
- `pnpm typecheck`, `pnpm lint` y `pnpm test`: comprobaciones del monorepo satisfactorias; la suite de API incluye 274 pruebas.
- `pnpm build`: compilación de producción satisfactoria de la API y ambas aplicaciones Next.js.
- Pruebas Playwright de `storefront-catalog.spec.ts` y `backoffice-catalog.spec.ts`: dos pruebas satisfactorias.

### Archivos de la tarea 20.6

- API: `apps/api/src/product-catalog/catalog-image.dto.ts`, `product-administration.types.ts`, `product-administration.repository.ts` y `product-listing.controller.ts` dentro del mismo directorio.
- Contrato: `apps/api/openapi/openapi.json` y `packages/api-client/src/generated/openapi.ts`.
- Validación: `packages/api-schemas/src/products.ts`, `packages/api-schemas/src/index.ts` y `packages/api-schemas/test/products.spec.ts`.
- Pruebas API: `apps/api/test/product-catalog/product-administration.integration.spec.ts`.
- Fixtures storefront: `apps/storefront/test/catalog-page.spec.tsx`, `catalog-landing.spec.tsx`, `product-card-design.spec.tsx` y `product-detail.spec.tsx` dentro del mismo directorio.
- Fixtures backoffice: `apps/backoffice/test/product-api.spec.ts`, `product-management.spec.tsx` y `invoice-autocomplete-api.spec.ts` dentro del mismo directorio.
- Fixtures de navegador: `e2e/frontend/catalog-api-fixture.ts`.
- Documentación y seguimiento: `docs/catalog-image-contract.md` y `openspec/changes/build-technology-ecommerce-platform/tasks.md`.

Este registro no atribuye a 20.6 los cambios previos de otras tareas que ya estaban presentes en el árbol de trabajo. No se ejecuta un seed ni se modifica la base de datos local de desarrollo.
