# Modelo editorial del catálogo — 21.1

La migración `0014_catalog_editorial_fields.sql` amplía el esquema existente sin modificar productos, imágenes, etiquetas, categorías, precios ni inventario previos.

## Campos y restricciones

- `Product.isFeatured`: booleano obligatorio, por defecto `false`.
- `Product.featuredAt`: fecha con zona horaria, inicialmente `null`. Un producto destacado requiere una fecha. Retirar el flag permite conservar la fecha histórica o limpiarla; las transiciones y la asignación automática de fecha corresponden a 21.2.
- `Category.showOnLanding`: booleano obligatorio, por defecto `false`.
- `Category.landingOrder`: `smallint` nullable. Una categoría seleccionada requiere una posición entre 1 y 3; una no seleccionada requiere `null`.
- Un índice único parcial sobre las posiciones seleccionadas impide duplicados y, junto al rango 1–3, impide seleccionar una cuarta categoría, incluso con escrituras concurrentes. Se permiten cero o una selección durante la configuración; no se obliga a tener siempre dos categorías.

Las restricciones de persistencia permiten conservar los metadatos editoriales al desactivar o eliminar lógicamente un registro. La API implementada en 21.2 conserva esos metadatos al desactivar y al eliminar productos; al eliminar una categoría retira su selección y libera la posición, conservando el valor anterior en auditoría. Las categorías desactivadas mantienen su posición hasta retirar la selección. Las futuras consultas públicas excluirán registros inactivos o eliminados. No se modifica el inventario al editar estos campos.

Los índices parciales `products_public_featured_idx` y `products_public_recent_idx` preparan las consultas acotadas de productos activos no eliminados con orden determinista por fecha e identificador. `categories_landing_order_unique` también permite recorrer las posiciones seleccionadas en orden.

## Alcance

Esta tarea entrega persistencia, migración e integridad; no agrega endpoints, cambia OpenAPI ni implementa controles de administración, composición pública o destaques del seed. Las mutaciones corresponden a 21.2 y `/api/v1/catalog/landing` a 21.3. La tarea 20.7 sigue pendiente de esas dependencias.

Las pruebas crean bases PostgreSQL temporales propias. Una reconstruye todas las migraciones anteriores a 0014, inserta un catálogo relacionado y aplica la migración actual mediante el runner de despliegue; comprueba defaults, conservación de los registros y asociaciones, y reejecución sin duplicar historial. Otras cubren posiciones inválidas, unicidad, límite máximo, liberación de posición, fechas con zona horaria, conservación al desactivar y concurrencia. La suite de persistencia existente mantiene la verificación de migración desde cero.

## Archivos de esta tarea

Verificación satisfactoria: `pnpm --filter @technology-ecommerce/api test` (285 pruebas, 39 archivos), `typecheck`, `lint`, `build` y `db:check`. Una segunda ejecución de `db:generate` no encuentra diferencias de esquema ni genera otra migración.

- `apps/api/src/database/schema/catalog.ts`: campos, índices y checks.
- `apps/api/src/database/migrations/0014_catalog_editorial_fields.sql`: migración aditiva.
- `apps/api/src/database/migrations/meta/0014_snapshot.json` y `meta/_journal.json`: metadatos generados por Drizzle.
- `apps/api/test/database/catalog-editorial.persistence.integration.spec.ts`: 11 pruebas nuevas.
- `apps/api/test/database/catalog-inventory.persistence.integration.spec.ts`: selección explícita de la migración histórica de imágenes, independiente de nuevas migraciones.
- `docs/catalog-editorial-model.md`: alcance y evidencia de implementación.
- `openspec/changes/build-technology-ecommerce-platform/tasks.md`: seguimiento de 21.1, sin marcar otras tareas.

Los cambios anteriores presentes en el árbol de trabajo se preservan y no se atribuyen a esta tarea.
