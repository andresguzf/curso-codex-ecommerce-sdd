# Recuperación de imágenes del catálogo

Implementación de 23.4, guía consolidada en 23.8. No activa Cloudinary ni migra imágenes actuales. Consultar [configuración, activación autorizada y rollback](catalog-cloudinary-storage.md). Antes de seleccionar el proveedor, aplicar las migraciones con el procedimiento de despliegue existente y confirmar el modo de carpetas; las credenciales permanecen exclusivamente en configuración privada del backend.

`catalog_image_operations` guarda UUID de operación (public ID previsto `codex-storefront/<UUID>`), cloud, clave, estado, intentos y fechas; nunca bytes ni secretos. `UPLOADING` se escribe antes de llamar al proveedor. La asociación, portada/orden, auditoría y `CONFIRMED` se confirman en la misma transacción. Retirar o reemplazar una referencia Cloudinary encola `PENDING` en esa misma transacción. Los archivos locales y logos conservan su almacenamiento anterior; referencias Picsum no se encolan.

Un mutex advisory de sesión por UUID coordina uploads y reconciliadores entre procesos; usa un pool separado y no mantiene una transacción ni bloqueos de filas durante llamadas remotas. Antes de la limpieza se cambia a `PENDING`, impidiendo confirmaciones tardías. Las claves gestionadas Cloudinary no pueden adjuntarse desde el campo comercial de URL/clave: deben entrar por el endpoint de carga coordinado. Un cambio de conexión o caída deja la operación durable para recuperación.

El worker revisa hasta 20 operaciones cada 30 segundos cuando la configuración privada está completa, incluso si las nuevas cargas están en local. Las operaciones en upload tienen dos minutos de gracia y una operación aún activa conserva su mutex. Nunca reenvía bytes. Comprueba identidad, carpeta, etiqueta propia y referencias de productos/logos; borra un único asset ID con invalidación. Referencias activas, identidades ajenas o respuestas inseguras quedan `BLOCKED`. La limpieza fallida no revierte una eliminación confirmada.

Hasta ocho intentos, con backoff exponencial de 60 segundos hasta una hora. Los fallos persistentes quedan `BLOCKED` para revisión. Una identidad no confirmada y ausente se consulta durante ocho intentos antes de `DONE`, evitando asumir que un timeout implica que no hubo upload. Una clave conocida ya ausente concluye inmediatamente. No existe transacción distribuida ni garantía de eliminación instantánea: si un proveedor materializa un upload después de esa ventana, debe revisarse y reencolarse específicamente.

## Operación manual

Después de revisar el entorno/base y contar con autorización para operar sobre sus assets:

```sh
pnpm --filter @technology-ecommerce/api images:reconcile
pnpm --filter @technology-ecommerce/api images:reconcile --requeue=UUID-DE-LA-OPERACION
```

El primer comando procesa únicamente trabajos vencidos. El segundo reabre solo un trabajo `BLOCKED`/`DONE` del cloud configurado y sin referencias conocidas, y después procesa la pasada de trabajos vencidos (no únicamente ese UUID); no reabre uploads activos ni confirmados. Todas las comprobaciones de propiedad y referencias se repiten. Consultar primero `catalog_image_operations` por ID; no editar claves ni borrar carpetas. Corregir la causa (conexión, configuración, límites remotos) antes de reencolar. Conservar credenciales/modo para gestionar assets anteriores al volver a proveedor local. Estos comandos pueden eliminar assets remotos; requieren autorización, no deben ejecutarse como comprobación de solo lectura.

Referencias técnicas: [advisory locks de PostgreSQL](https://www.postgresql.org/docs/current/explicit-locking.html#ADVISORY-LOCKS), [Admin API de Cloudinary](https://cloudinary.com/documentation/admin_api). Las pruebas normales usan transporte controlado y PostgreSQL aislado, no la cuenta real ni la base de desarrollo.

## Archivos de la tarea 23.4

- Persistencia: `apps/api/src/database/database.service.ts`, `schema/catalog-image-operations.ts`, `schema/index.ts`, `migrations/0015_worried_triathlon.sql`, `migrations/meta/0015_snapshot.json` y `migrations/meta/_journal.json` (rutas bajo `apps/api/src/database/`).
- Almacenamiento: `apps/api/src/product-catalog/image-storage/catalog-image-recovery.service.ts`, `catalog-image-cleanup.ts`, `catalog-image-storage.service.ts`, `cloudinary-image-storage.ts`, `image-storage.module.ts` y `reconcile-catalog-images.ts` (mismo directorio).
- Mutaciones: `apps/api/src/product-catalog/product-images.repository.ts`, `product-images.service.ts`, `product-administration.repository.ts` y `product-administration.service.ts` (mismo directorio).
- Pruebas: `apps/api/test/product-catalog/product-administration.integration.spec.ts` y `catalog-image-storage-config.spec.ts` (mismo directorio).
- Operación/evidencia: `apps/api/package.json`, esta guía y `openspec/changes/build-technology-ecommerce-platform/tasks.md`.

Los archivos de configuración/contratos de 23.1–23.3 ya modificados antes de esta tarea se conservaron; no constituyen cambios nuevos de 23.4.
