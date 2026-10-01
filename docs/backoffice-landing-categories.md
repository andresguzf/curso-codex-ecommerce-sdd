# Categorías importantes: tarea 21.5

## Comportamiento implementado

En `/categories`, exclusivamente para `ADMIN`, la estrella de cada fila incluye una categoría activa en la landing. Un panel independiente de la búsqueda y paginación muestra hasta tres selecciones, su estado y su posición persistida. Se recomienda seleccionar dos o tres categorías activas; una configuración parcial se permite, pero muestra una advertencia.

- Arrastrar el asa sobre otra categoría **intercambia** sus posiciones. No desplaza todas las posiciones intermedias.
- Las flechas subir/bajar ofrecen la misma operación con teclado y pantalla táctil. Tienen nombres accesibles y foco visible.
- Cada movimiento usa un único `PATCH /api/v1/categories/:categoryId` con `landingOrder`. El backend existente intercambia ambas posiciones y audita dentro de una transacción; no se retiran y vuelven a seleccionar categorías para reordenarlas.
- Retirar una selección exige confirmación. El modal advierte si quedarán menos de dos categorías activas. Envía únicamente `showOnLanding: false`; no elimina la categoría ni modifica sus productos.
- Una cuarta selección y las categorías inactivas están deshabilitadas. Las selecciones previamente desactivadas siguen ocupando su posición: se muestran y se pueden retirar, pero no reordenar.
- Las operaciones recargan las listas y la selección, incluso después de un conflicto con otro administrador. Se muestra feedback flash seguro y se bloquean nuevos comandos durante el guardado y la recarga. No se persiste información administrativa en almacenamiento del navegador.

## Lectura acotada y contratos

Se amplió el listado existente `GET /api/v1/categories` con el filtro booleano `showOnLanding`, exclusivo de `view=administrative` y del rol `ADMIN`. El panel solicita `page=1&pageSize=3&showOnLanding=true`; no descarga todas las categorías ni depende de la página visible de la tabla. La consulta incluye selecciones inactivas o sin productos y filtra antes de contar/paginar. El filtro no se admite en la vista pública ni en el listado de etiquetas.

Se mantienen los endpoints, el límite máximo y las transacciones de 21.2. Se actualizaron OpenAPI, el cliente generado y el esquema de consulta Zod. La invalidación de caché actúa dentro de la aplicación; la otra aplicación consulta nuevamente el resumen público al remontarse o recuperar el foco, según 21.4.

## Archivos de esta tarea

- Backoffice: `apps/backoffice/src/features/classifications/classification-management.tsx`, `classification-api.ts`, `landing-categories-panel.tsx` y `use-landing-categories.ts`.
- API: `apps/api/src/product-catalog/classification.controller.ts`, `classification.repository.ts`, `classification.service.ts` y `classification.types.ts`.
- Contratos: `apps/api/openapi/openapi.json`, `packages/api-client/src/generated/openapi.ts` y `packages/api-schemas/src/classifications.ts`.
- Primitivas: `packages/ui/src/icon-button.tsx` incorpora iconos de asa y flechas verticales, conservando los existentes.
- Pruebas: `apps/backoffice/test/classification-api.spec.ts`, `classification-management.spec.tsx`, `apps/api/test/product-catalog/product-administration.integration.spec.ts`, `e2e/frontend/backoffice-catalog.spec.ts` y `catalog-api-fixture.ts`.
- Verificación: `packages/api-schemas/eslint.config.mjs` excluye `dist/**` para no analizar declaraciones generadas como fuentes; no cambia la validación de datos.
- Seguimiento: este documento y `openspec/changes/build-technology-ecommerce-platform/tasks.md`.

Los cambios de productos, storefront y referencias visuales de 21.4 que ya estaban en el árbol de trabajo se conservan; no corresponden a una implementación nueva de 21.5.

## Verificación

- Pruebas de componentes y transporte: selección, límite, categoría inactiva, intercambio por teclado/drag, retiro confirmado/cancelado, conflicto concurrente y bloqueo durante guardado.
- Integración con PostgreSQL aislado: selección acotada, filtro antes de paginar, inclusión de selecciones inactivas y rechazo de acceso público, `CUSTOMER`, `BILLING`, valores inválidos y filtros sobre etiquetas.
- Navegador: selección, teclado, arrastre, recarga, retiro, permisos, accesibilidad automatizada y ausencia de desbordamiento en ambos temas a 375 y 1440 px.
- Suites del repositorio, tipos, lint, builds y contrato generado: exitosos.
- Navegador: 81 pruebas de frontend, ocho de regresión de temas y siete de tokens de diseño exitosas. Se revisaron visualmente las capturas del panel en móvil oscuro y escritorio claro; las referencias visuales existentes no se actualizaron en esta tarea.
- `openspec validate build-technology-ecommerce-platform --strict`: válido.

Esta tarea no amplía el seed (21.6), no implementa las secciones editoriales públicas (21.7) y no sustituye la revisión general de README/AGENTS prevista en 21.8.
