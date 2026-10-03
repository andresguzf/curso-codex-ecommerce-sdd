# Operación del almacenamiento Cloudinary del catálogo

Entrega 23.8, 2026-10-02. Adaptador, persistencia, recuperación y pruebas implementados. **Tras autorización posterior a 23.8, el entorno local selecciona Cloudinary con modo dynamic y migraciones aplicadas.** La misma UI de galería envía bytes al API REST; solo ADMIN puede cargar imágenes. No hay uploads directos del navegador ni endpoints nuevos. Los informes 23.7/23.8 conservan el estado histórico anterior a esta activación.

## Configuración privada

Configurar exclusivamente en `apps/api/.env` o en el gestor de secretos del backend. Este bloque es un ejemplo con placeholders, no credenciales funcionales:

```dotenv
IMAGE_STORAGE_CATALOG_PROVIDER=local
CLOUDINARY_CLOUD_NAME=replace-with-your-cloud-name
CLOUDINARY_API_KEY=replace-with-your-api-key
CLOUDINARY_API_SECRET=replace-with-your-api-secret
CLOUDINARY_FOLDER_MODE=dynamic
IMAGE_STORAGE_MAX_BYTES=5242880
IMAGE_STORAGE_PUBLIC_BASE_URL=http://localhost:3001/api/v1/media/images
```

No pegar secretos en chat, logs, fixtures, OpenAPI, Git ni variables `NEXT_PUBLIC_*`. Los archivos `.env` privados están ignorados. El selector por defecto es local; tener credenciales no activa cargas remotas. Seleccionar cloudinary con configuración incompleta o modo inválido impide el arranque, sin fallback silencioso.

El máximo por defecto es 5 MiB; valida bytes/firma y dimensiones de JPEG/PNG/WebP. La base pública tiene ese valor por defecto y sirve archivos locales, incluidos logos; no prefija las URLs Cloudinary. No eliminar la configuración ni el volumen local al activar el proveedor.

La carpeta es siempre `codex-storefront`, no configurable por el cliente. Ver una carpeta en Assets no demuestra el modo de la cuenta:

| Modo | Parámetros de carga |
|---|---|
| dynamic | `asset_folder=codex-storefront`, `public_id=codex-storefront/<UUID>`, `use_asset_folder_as_public_id_prefix=false` |
| fixed | `folder=codex-storefront`, `public_id=<UUID>` |

El smoke autorizado de 23.7 confirmó dynamic en la cuenta de pruebas mediante Admin API; no escribió ese valor en `.env`. Confirmar nuevamente si cambia la cuenta y configurar el modo explícitamente. Cada carga usa un UUID nuevo, `overwrite=false`, etiqueta propia y URL HTTPS versionada. La clave contiene cloud, UUID y asset ID; PostgreSQL guarda referencias/metadatos, no bytes ni secretos.

## Procedimiento de activación por entorno

El entorno local ya recibió autorización y configuración. Para otro entorno o reactivación, se requiere autorización específica sobre el entorno y la base objetivo. El valor por omisión del código y el ejemplo seguro siguen siendo local; el `.env` privado local selecciona cloudinary de forma persistente:

1. Revisar configuración privada, modo, respaldo de PostgreSQL y persistencia local. Revisar el SQL aditivo `apps/api/src/database/migrations/0015_worried_triathlon.sql`; no alterar migraciones ya aplicadas.
2. Aplicar todas las migraciones antes de iniciar la nueva API. En desarrollo: `pnpm --filter @technology-ecommerce/api db:migrate`. El despliegue usa `db:migrate:deploy` antes de HTTP. Esto crea `catalog_image_operations`; no sube imágenes ni ejecuta seed.
3. Con autorización para activar, cambiar únicamente `IMAGE_STORAGE_CATALOG_PROVIDER=cloudinary` en configuración privada y reiniciar el API con la nueva configuración. Los frontends no reciben credenciales.
4. Comprobar health y una carga autorizada desde la galería existente; revisar carpeta, respuesta REST, portada y detalle. Una imagen de comprobación no se elimina sin revisar sus referencias y confirmar su retirada.
5. Vigilar errores seguros y el journal. No repetir automáticamente una carga con respuesta incierta; recuperar el detalle primero y permitir reconciliación.

Este procedimiento no ejecuta `db:seed`. El seed actual conserva 20 productos/60 referencias Picsum. Reemplazar hotlinks antes de producción sigue siendo obligatorio pero exige una migración de contenido separada y aprobada; activar este adaptador no la realiza.

## Seguimiento y recuperación

`catalog_image_operations`: `UPLOADING` antes del upload; `CONFIRMED` junto con referencia/portada/orden/auditoría; retirada o reemplazo encola `PENDING` atómicamente. `DONE` indica reconciliación terminada; `BLOCKED` necesita revisión. Consulta de diagnóstico solo lectura en la base autorizada:

```sql
SELECT id, state, attempts, next_attempt_at, updated_at
FROM catalog_image_operations
WHERE state IN ('UPLOADING', 'PENDING', 'BLOCKED')
ORDER BY updated_at;
```

El worker procesa hasta 20 trabajos cada 30 segundos cuando tiene configuración Cloudinary completa, incluso con nuevas cargas locales. Tiene dos minutos de gracia para uploads inciertos, exclusión advisory entre ejecutores y confirmaciones, y ocho intentos con backoff desde 60 segundos hasta una hora. No mantiene transacciones/bloqueos de filas durante red. No garantiza transacción distribuida ni eliminación física instantánea.

Los comandos siguientes **pueden borrar assets remotos propios no referenciados**, no son diagnósticos de solo lectura. Requieren autorización operativa y revisión de base/cloud/UUID:

```sh
pnpm --filter @technology-ecommerce/api images:reconcile
pnpm --filter @technology-ecommerce/api images:reconcile --requeue=UUID-DE-LA-OPERACION
```

El segundo reabre solo una operación elegible BLOCKED/DONE, pero luego también procesa trabajos vencidos; no limita toda la pasada a ese UUID. No reabre CONFIRMED ni uploads activos. Corregir la causa antes; no forzar estados SQL. Se comprueba identidad, carpeta, etiqueta y ausencia de referencias de productos/logos antes de eliminar un único asset ID con invalidación. Nunca borrar carpetas ni assets ajenos. Véase [recuperación y límites](catalog-image-recovery.md).

Errores públicos: `502 IMAGE_STORAGE_UPSTREAM_ERROR`, `503 IMAGE_STORAGE_UNAVAILABLE`, `504 IMAGE_STORAGE_TIMEOUT`; cuota concurrente `409 PRODUCT_IMAGE_LIMIT_REACHED`. Investigar con correlation ID, sin publicar cuerpos SDK o secretos. Una limpieza fallida no revierte la eliminación lógica confirmada.

## Rollback del proveedor

Con autorización, volver a `IMAGE_STORAGE_CATALOG_PROVIDER=local` y reiniciar el API. Solo las altas posteriores vuelven a local. No reescribir URLs/IDs, descargar imágenes Cloudinary, borrar journal ni revertir la migración aditiva para cambiar proveedor. Conservar credenciales y modo de la cuenta original para gestionar/reconciliar assets Cloudinary anteriores, además del volumen y base pública local.

Las galerías mixtas preservan portada, orden y texto alternativo; el router usa el origen de cada asset, no el selector actual. Picsum continúa como referencia externa, sin eliminación gestionada. Logos empresariales siguen locales, y órdenes/facturas/PDFs conservan snapshots. Volver a una versión anterior del código es un rollback de despliegue distinto: evaluar compatibilidad de esquema/referencias; no prometer que el código anterior a fase 23 administra assets Cloudinary.

## Pruebas y límites

`pnpm test:e2e:cloudinary` verifica seis escenarios REST/PostgreSQL reales con SDK y entrega visual controlados. `pnpm test:e2e:gallery` conserva cinco recorridos locales. La evidencia de [23.5](VALIDATION-23.5.md), [23.6](VALIDATION-23.6.md) y [23.7](VALIDATION-23.7.md) distingue aislamiento, intermitencias y prueba real.

El smoke real `test:cloudinary:live` queda fuera de suites normales. Cada nueva ejecución exige autorización propia, cuenta no productiva y flags explícitos `CLOUDINARY_LIVE_TEST_AUTHORIZED=yes` y `CLOUDINARY_LIVE_TEST_NONPRODUCTION=yes`; carga/verifica/elimina un único asset temporal, sin productos ni base de desarrollo. La autorización anterior no es reutilizable.

La entrega Next.js admite únicamente HTTPS de `res.cloudinary.com` en rutas versionadas bajo `codex-storefront`; producción no habilita IP privadas. El smoke real verificó un asset dynamic, no una cuenta fixed ni el optimizador productivo. No es certificación de producción ni auditoría manual completa de accesibilidad. No incluye calidad/compresión, transformaciones, migración masiva, logos remotos, rediseño del formulario, seed local, activación, commit/push ni archivo de OpenSpec.
