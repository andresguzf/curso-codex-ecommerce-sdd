# Composición pública de landing — 21.3

`GET /api/v1/catalog/landing` es público y devuelve una sola respuesta con:

- `featuredProducts`: hasta tres productos activos no eliminados, por `featuredAt DESC, id DESC`.
- `latestProducts`: hasta nueve productos activos no eliminados, por `createdAt DESC, id DESC`, excluyendo los identificadores de los destacados que aparecen en esta respuesta. Un producto destacado que no entra en los tres seleccionados puede aparecer aquí.
- `highlightedCategories`: hasta tres categorías seleccionadas, activas y no eliminadas, por `landingOrder ASC, id ASC`. Cada sección contiene una categoría pública y hasta tres productos activos recientes por `createdAt DESC, id DESC`.

Las categorías pueden repetir productos de destacados o recientes. Una categoría sin productos públicos se omite sin cambiar su posición persistida. Configuraciones parciales o vacías son válidas y no se rellenan con contenido artificial. Los productos agotados permanecen visibles con `stockAvailable=0`; un balance ausente se proyecta como cero.

El endpoint rechaza cualquier query parameter con `400 REQUEST_VALIDATION_FAILED`: búsqueda, filtros, orden y paginación siguen perteneciendo a `GET /products`. La respuesta no tiene metadatos de paginación ni requiere sesión, cookies o permisos administrativos; enviar una sesión no amplía los campos devueltos.

## Datos y consistencia

Las tarjetas reutilizan la proyección pública del catálogo, con `coverImage` y la referencia `image` de compatibilidad. Solo se selecciona la portada; la galería no se carga. Los productos sin portada no se publican. Las clasificaciones inactivas o eliminadas se omiten de etiquetas y se proyectan como `category=null` cuando corresponda. Las secciones de categorías solo incluyen categorías activas.

No se exponen `isFeatured`, `featuredAt`, `showOnLanding`, `landingOrder`, `deletedAt` ni cantidades internas del inventario. Los importes conservan la moneda fija `USD` y el stock disponible es una proyección pública, no una reserva.

El controlador delega en `CatalogLandingService` y el repositorio de catálogo. Todos los límites se aplican en SQL antes de hidratar clasificaciones. Se leen como máximo tres categorías y veintiuna filas de producto entre las secciones, sin descargar el catálogo completo. Portadas, balances, selección editorial y clasificaciones comparten una transacción PostgreSQL `REPEATABLE READ`, `READ ONLY`. La respuesta usa `Cache-Control: no-store`, evitando una caché HTTP obsoleta tras cambios editoriales o de disponibilidad.

OpenAPI publica `getCatalogLanding`, DTOs públicos y límites de arrays; el cliente TypeScript se regenera desde ese contrato. Los esquemas Zod estrictos verifican límites, estado activo, campos públicos, ausencia de parámetros, deduplicación entre destacados/recientes y pertenencia de los productos a su sección de categoría.

## Verificación

Se añadieron catorce escenarios REST/PostgreSQL en una base temporal migrada: catálogo vacío, composición completa, orden por fecha y desempate por ID, límites, deduplicación, repetición contextual, configuración parcial, balance ausente, productos/clasificaciones inactivos o eliminados, categorías vacías, acceso público y por los tres roles, parámetros rechazados y lectura consistente ante una edición concurrente confirmada antes de hidratar las clasificaciones. Se valida la respuesta contra el OpenAPI publicado.

Se añadieron cuatro pruebas de esquemas Zod y un caso de respuesta real a la suite de contrato existente. Verificación satisfactoria: `pnpm test` (304 pruebas del API y 46 de esquemas), `pnpm typecheck`, `pnpm lint`, `pnpm build` y `pnpm contract:check`. No se ejecutaron pruebas visuales porque no cambia la UI.

## Archivos de esta tarea

- `apps/api/src/product-catalog/catalog-landing.controller.ts`: ruta pública, validación de query vacía y DTOs OpenAPI.
- `apps/api/src/product-catalog/catalog-landing.service.ts` y `catalog-landing.types.ts`: operación de aplicación y respuesta pública.
- `apps/api/src/product-catalog/product-administration.repository.ts`: composición acotada y consistente, reutilizando la proyección pública y filtrando clasificaciones.
- `apps/api/src/product-catalog/product-listing.controller.ts`: exportación del DTO existente para reutilizar sus campos públicos sin metadatos editoriales.
- `apps/api/src/product-catalog/product-catalog.module.ts`: registro de controlador y servicio.
- `apps/api/src/openapi/openapi.ts`: etiqueta de composición pública.
- `apps/api/openapi/openapi.json` y `packages/api-client/src/generated/openapi.ts`: contrato y cliente regenerados.
- `packages/api-schemas/src/catalog-landing.ts`, `src/index.ts` y `test/catalog-landing.spec.ts`: validación pública, exports y pruebas.
- `apps/api/test/product-catalog/catalog-landing.integration.spec.ts` y `apps/api/test/openapi/openapi-contract.integration.spec.ts`: pruebas de integración y contrato.
- `docs/catalog-landing-api.md` y `openspec/changes/build-technology-ecommerce-platform/tasks.md`: evidencia y seguimiento.

Se preservan los cambios previos del árbol de trabajo. No se ejecuta el seed ni se modifica el catálogo local. Esta tarea entrega exclusivamente el API y sus contratos: los controles administrativos de 21.4/21.5, el seed editorial de 21.6 y la integración visual de landing de 20.7/21.7 siguen pendientes.
