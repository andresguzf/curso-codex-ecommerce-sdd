# Validación de fase 20 — tarea 20.10

Fecha: 1 de octubre de 2026. Cambio: `build-technology-ecommerce-platform`, esquema `spec-driven`.

## Alcance y estado

La fase 20 entrega seed no productivo, imágenes ordenadas, portada única, contratos públicos, recientes en la landing, catálogo completo separado y galería accesible. 21.1–21.3 también están implementadas porque el API de composición desbloqueó 20.7. Al cerrar 20.10 el avance es 140/145; quedan exclusivamente 21.4–21.8.

No se acreditan controles editoriales del backoffice, seed de destacados/categorías importantes ni sus secciones visuales: siguen pendientes. La landing actual representa `latestProducts`, no `featuredProducts` ni `highlightedCategories`.

## Matriz de cobertura consolidada

| Área | Evidencia | Comportamiento verificado |
| --- | --- | --- |
| Modelo de imágenes | `apps/api/test/database/catalog-inventory.persistence.integration.spec.ts` | Migración antigua/vacía, portada única y obligatoria para activos, posiciones y concurrencia |
| Mutaciones REST | `apps/api/test/product-catalog/product-administration.integration.spec.ts` | Solo ADMIN, bytes/metadatos, reordenar/portada, aislamiento por producto, borrado seguro y limpieza de archivos |
| Seed | `apps/api/test/database/development-seed.integration.spec.ts`, `seed-config.spec.ts`, `product-image-manifest.spec.ts` | 20 SKU, 60 imágenes, usuarios/roles, USD, idempotencia, conservación de stock y datos ajenos, rollback, login y rechazo de producción |
| Contratos | Pruebas OpenAPI del API, cliente generado y `packages/api-schemas/test/{products,product-images,catalog-landing}.spec.ts` | Portada frente a galería, metadatos, arrays limitados, esquemas estrictos y generación coherente |
| Composición REST | `apps/api/test/product-catalog/catalog-landing.integration.spec.ts` | Límites 3/9/3, activos, orden/desempate, deduplicación, configuración parcial/vacía y lectura coherente |
| Componentes | Pruebas storefront de catálogo, landing, tarjetas, detalle y galería | Estados, portada explícita, navegación, carrito, teclado, gestos, foco, fallback y ausencia de autoplay |
| Navegador | `e2e/frontend/storefront-{catalog,gallery,accessibility}.spec.ts` y suites de temas | Nueve recientes, enlace/búsqueda hacia catálogo, paginación backend, URL/recarga, galería, tamaños estables, WCAG automatizada y ambos temas |

## Adiciones de 20.10

1. Una integración sobre PostgreSQL y NestJS reales conecta el seed con los endpoints públicos. Comprueba 18 productos activos en páginas de 12 y 6, nueve recientes, ausencia de galerías en tarjetas, detalle por ID/slug concordante, tres imágenes ordenadas con una portada y texto alternativo, y rechazo de productos inactivos. La comparación respeta el desempate de landing por ID descendente; el catálogo general usa ID ascendente como clave secundaria estable.
2. Un caso de navegador fuerza un 404 de imagen, verifica fallback, texto alternativo, tamaño estable, ausencia de mutaciones de producto al navegar y recuperación de la portada tras recargar.
3. Dos pruebas de tarjeta distinguen la portada explícita de una referencia `image` heredada distinta y verifican compatibilidad cuando `coverImage=null`. Se corrige la tarjeta para priorizar `coverImage.url`; no cambia el diseño ni el contrato.
4. README y AGENTS.md actualizados: 48 paths OpenAPI, seed ampliado/configuración privada, imágenes, galería y recientes implementados; pendientes de fase 21 claramente separados.

## Resultados

- `pnpm test`: aprobado. API 305 pruebas; storefront 117; backoffice 118; api-schemas 46; UI 38; reglas de arquitectura dos. Turborepo reutiliza resultados sin cambios y vuelve a ejecutar las suites afectadas.
- `pnpm typecheck`, `pnpm lint`, `pnpm build`: aprobados.
- `pnpm openapi:check`: documento y cliente generado coherentes. `pnpm contract:check`: una prueba de cliente generado y 17 pruebas de contrato API aprobadas; estas últimas ya forman parte de las 305 del API.
- `pnpm test:e2e:frontends --workers=2`: 70 pruebas aprobadas, incluidas las ocho de regresión de temas. No se actualizan referencias visuales en 20.10; se conservan las cuatro revisadas por el cambio de galería de 20.9.
- `pnpm test:e2e:invoices`: tres pruebas con API y PostgreSQL reales aprobadas; se verifica que los contratos de producto mantienen el autocomplete y facturación de ADMIN/BILLING.
- `pnpm test:e2e:design-tokens`: siete pruebas aprobadas.
- `openspec validate build-technology-ecommerce-platform --strict` y `git diff --check`: aprobados.

## Límites de la evidencia

Las integraciones crean y eliminan bases temporales con nombres validados; no se ejecuta el seed sobre la base local de desarrollo de la tienda. El conteo de veinte corresponde a los SKU administrados por el seed, no a eliminar productos ajenos en una base existente.

La suite general Playwright usa respuestas REST controladas; el recorrido seed→API se prueba con PostgreSQL y NestJS reales, y las tres pruebas de facturación usan servidor real. No se presenta el conjunto como una prueba única navegador→seed. Los gestos son eventos Touch sintéticos y axe no sustituye auditoría manual con lectores de pantalla/dispositivos físicos.

No se añaden dependencias de red a las suites: el manifiesto Picsum se valida estructuralmente y la revisión externa histórica está en `docs/development-image-manifest.md`; esta validación no garantiza disponibilidad futura de terceros ni fidelidad fotográfica de productos. Antes de producción se requieren assets propios/aprobados gestionados, no hotlinks de demostración. Las referencias visuales son Chromium/macOS.

## Archivos de esta tarea

- `apps/api/test/database/development-seed.integration.spec.ts`: integración seed→REST.
- `apps/storefront/src/features/catalog/product-card.tsx`: prioridad de portada explícita.
- `apps/storefront/test/product-card-design.spec.tsx`: portada frente a compatibilidad y fallback.
- `e2e/frontend/catalog-api-fixture.ts`: URL configurable para simular fallos de imagen.
- `e2e/frontend/storefront-gallery.spec.ts`: fallback, recarga y ausencia de mutaciones.
- `README.md` y `AGENTS.md`: estado y convenciones actuales, sin eliminar requisitos futuros.
- `e2e/VALIDATION-20.10.md`: cobertura y evidencia.
- `openspec/changes/build-technology-ecommerce-platform/tasks.md`: cierre de 20.10.

Se preservan los cambios previos de fases 20/21 presentes en el árbol de trabajo. No se inicia 21.4, no se archiva el cambio y no se realiza commit/push.
