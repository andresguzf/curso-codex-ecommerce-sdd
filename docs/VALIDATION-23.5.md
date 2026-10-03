# Verificación 23.5 — compatibilidad de imágenes por origen

Fecha: 2026-10-02. Cambio: `build-technology-ecommerce-platform`. Alcance: solo tarea 23.5, sin cambios funcionales de UI ni configuración de entrega Next.js (23.6).

## Evidencia

- REST real con NestJS, PostgreSQL aleatorio y archivos temporales: galería con Picsum, archivo local y Cloudinary controlado. La respuesta de detalle y las tarjetas conservan URL, ID, texto alternativo, posición y portada después del cambio cloudinary → local. La siguiente carga llega al almacenamiento local; la limpieza de un asset Cloudinary anterior sigue su origen, sin eliminar el archivo local vecino.
- Reconstrucción de la fábrica con selección cloudinary → local → cloudinary y credenciales ficticias: construir/cambiar proveedor no hace I/O ni migra assets; lectura y eliminación se resuelven por clave. Quitar configuración remota impide gestionar ese asset, sin fallback ni reescritura, y conserva la gestión local.
- Logos: la subida empresarial utiliza el servicio local separado incluso mientras el catálogo usa Cloudinary. Se comprueban bytes locales y ausencia de llamadas remotas para el logo.
- PDFs y snapshots: órdenes y facturas históricas conservan datos e imágenes empresariales; se regeneran bytes idénticos durante cambios del router del catálogo. Se mantiene la verificación de persistencia histórica del perfil empresarial.
- Seed: el arranque sobre una base vacía migrada no la puebla. El seed se ejecuta explícitamente dos veces solo contra la base aleatoria de prueba, con selector de catálogo `cloudinary`; las sesenta imágenes del manifiesto continúan en Picsum, sin upload ni descarga. Se conservan además las imágenes no pertenecientes al seed. Ningún seed de desarrollo se ejecutó.
- Las pruebas normales no consultan la cuenta Cloudinary: el transporte/SDK se sustituye por respuestas controladas. No se cambiaron `.env`, productos del usuario, logos reales, snapshots reales ni referencias seed del repositorio.

Se ajustó la aserción del nuevo caso seed para distinguir sus sesenta imágenes de una imagen adicional que otros casos conservan deliberadamente. También se fijó `nextAttemptAt` en el pasado para fixtures de limpieza manuales, evitando depender de diferencias de precisión de fecha entre PostgreSQL y JavaScript; no se modificó lógica de recuperación.

## Comandos

```sh
IMAGE_STORAGE_CATALOG_PROVIDER=local CLOUDINARY_FOLDER_MODE= pnpm --filter @technology-ecommerce/api test
pnpm --filter @technology-ecommerce/api typecheck
pnpm --filter @technology-ecommerce/api lint
openspec validate build-technology-ecommerce-platform --strict
git diff --check
```

Resultado: 395 pruebas del API en 43 archivos; suite focalizada de compatibilidad, seed, PDFs y snapshots: 84 pruebas en cinco archivos. Tipos, lint y OpenSpec válidos. No equivalen a una prueba real Cloudinary ni a la verificación visual de 23.6/23.7.

## Archivos de esta tarea

- `apps/api/test/product-catalog/product-administration.integration.spec.ts`: caso de galería mixta/rollback, subida de logo local y fixtures de limpieza con fechas deterministas.
- `apps/api/test/product-catalog/catalog-image-storage-config.spec.ts`: reconstrucción de fábricas, routing de referencias anteriores y configuración remota ausente.
- `apps/api/test/database/development-seed.integration.spec.ts`: ausencia de seed al arrancar e idempotencia Picsum con selector remoto.
- `apps/api/src/document-export/document-export.spec.ts`: preservación de snapshots y PDFs empresariales durante cambios de proveedor de catálogo.
- `apps/api/src/product-catalog/image-storage/catalog-image-storage-router.ts`: comentario actualizado, sin cambio de comportamiento.
- `openspec/changes/build-technology-ecommerce-platform/tasks.md`: estado/evidencia de 23.5.
- `docs/VALIDATION-23.5.md`: este informe.

Se conservaron los cambios previos no confirmados en Git de 23.1–23.4. No se hizo commit/push ni se activó Cloudinary. La 23.6 permanece pendiente.
