# Modelo de imágenes de producto — tarea 20.1

Se amplía `product_images` para una colección ordenada por producto. El contrato REST todavía devuelve `image`; los endpoints de gestión, `coverImage`/`images` y el carrusel corresponden a 20.2, 20.6 y 20.9 y no se implementan en esta tarea.

## Campos y restricciones

- `altText`: texto alternativo no vacío. La creación de producto y el seed usan su nombre; el valor por defecto mantiene compatibilidad con inserciones antiguas.
- `isPrimary`: portada. El índice parcial permite como máximo una por producto.
- `sortOrder`: entero no negativo, único por producto; cero es la posición inicial.
- `width` y `height`: enteros positivos o NULL cuando no se conocen.
- `mimeType`: MIME `image/*` válido o NULL cuando no se conoce. No sustituye la validación del archivo en el adaptador.
- Se conservan ID, propietario, clave de almacenamiento única, URL y fechas.

Los defaults `isPrimary=true` y `sortOrder=0` conservan la inserción histórica de una sola portada. Al agregar imágenes adicionales se debe indicar explícitamente `isPrimary=false` y otra posición. Los nuevos endpoints deberán ofrecer texto alternativo descriptivo y metadatos comprobados del asset.

Un producto activo y no eliminado requiere una portada al confirmar la transacción. La comprobación diferida permite crear producto e imagen juntos, o desmarcar la portada anterior y marcar la nueva, dentro de una sola transacción. No permite confirmar un estado final sin portada. Los productos inactivos pueden prepararse sin portada; el índice sigue impidiendo dos portadas. La restricción también comprueba al propietario anterior si una imagen cambia de producto.

Las mutaciones de imágenes bloquean sus propietarios en orden estable y escriben su identidad sin modificar fechas ni datos comerciales para serializar operaciones y evitar write skew también bajo repeatable read. No tocan inventario. Las eliminaciones en cascada de una base de prueba siguen funcionando; esto no autoriza eliminación física de productos históricos desde el API.

Referencia técnica: [triggers de restricción diferibles de PostgreSQL](https://www.postgresql.org/docs/current/sql-createtrigger.html).

## Migración y compatibilidad

La migración `0013_lucky_the_watchers.sql` conserva las imágenes existentes como portadas en posición cero, completa su texto alternativo con el nombre del producto y deja dimensiones/MIME desconocidos en NULL. Para productos activos antiguos sin imagen, crea una referencia local al placeholder existente con texto “Imagen no disponible”; no desactiva productos, borra archivos ni cambia precios o stock.

Se generaron el snapshot Drizzle y el journal; los triggers de integridad están declarados explícitamente en SQL. La migración se aplicó en la base local. Las consultas de productos, wishlist y carrito unen solo la portada para no duplicar filas o totales al existir galería. La edición heredada de imagen afecta solo a la portada, actualiza su texto alternativo y elimina metadatos que no puede verificar para el nuevo asset. El seed básico actual actualiza únicamente esa portada, sin modificar imágenes adicionales.

## Verificación y archivos

Las pruebas usan bases PostgreSQL aisladas y verifican múltiples imágenes, portada única, posiciones duplicadas/negativas, texto vacío, dimensiones/MIME inválidos, activación sin portada, retirada de portada, cambio atómico, traslado entre productos, eliminación en cascada, concurrencia y migración desde el esquema anterior. Los fixtures antiguos se adaptaron para crear productos activos con portada en una sola transacción. Las regresiones de catálogo y carrito incorporan imágenes adicionales y conservan filas, totales y respuestas anteriores.

Archivos de implementación:

- `apps/api/src/database/schema/catalog.ts`
- `apps/api/src/database/migrations/0013_lucky_the_watchers.sql`
- `apps/api/src/database/migrations/meta/0013_snapshot.json` y `meta/_journal.json`
- `apps/api/src/database/seed/development-seed.ts`
- `apps/api/src/product-catalog/product-administration.repository.ts`
- `apps/api/src/product-catalog/wishlist.repository.ts`
- `apps/api/src/shopping-cart-checkout/cart.repository.ts`

Pruebas y fixtures modificados:

- `apps/api/test/product-fixtures.ts`
- `apps/api/test/database/catalog-inventory.persistence.integration.spec.ts`
- `apps/api/test/database/billing.persistence.integration.spec.ts`
- `apps/api/test/database/cart-order.persistence.integration.spec.ts`
- `apps/api/test/database/wishlist.persistence.integration.spec.ts`
- `apps/api/test/billing-invoicing/invoice-lifecycle.integration.spec.ts`
- `apps/api/test/billing-invoicing/issuer-snapshot.integration.spec.ts`
- `apps/api/test/dashboard/dashboard.integration.spec.ts`
- `apps/api/test/identity-access/user-administration.integration.spec.ts`
- `apps/api/test/product-catalog/product-administration.integration.spec.ts`
- `apps/api/test/shopping-cart-checkout/cart.integration.spec.ts`
- `apps/api/test/e2e/invoice-browser-server.ts`

También se actualizaron este documento y el checkbox 20.1 en `openspec/changes/build-technology-ecommerce-platform/tasks.md`. No se inició 20.2 ni se modificó el contrato OpenAPI.

Verificación completada: 235 pruebas del backend, typecheck, lint, build, comprobación Drizzle, migración local y validación OpenSpec estricta. Progreso: 129/145 tareas. Los datos existentes se conservaron y no se ejecutó el seed ampliado.
