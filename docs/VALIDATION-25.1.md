# 25.1 — Preparación Vercel Hobby, logo fijo y PDF tabular

Fecha: 2026-10-05. Estado: completada tras autorización de entrega de solo
lectura de la imagen histórica local. Despliegue real pendiente de 25.3.

## Cambios implementados

- Se conserva `src/main.ts` como entrada NestJS/Fastify compatible con el
  [soporte nativo de Vercel](https://vercel.com/docs/frameworks/backend/nestjs).
  No se introducen Server Actions, otro backend ni migraciones en el arranque.
- Con `VERCEL=1`, los pools reutilizables tienen como máximo dos conexiones
  de consulta y dos de coordinación por instancia. El mutex diario y el mutex
  por operación necesitan conexiones separadas. Se mantiene la conexión
  activa; la URI Session pooler y configuración de proyectos pertenecen a 25.2.
- No se inician los timers de recuperación ni limpieza en Vercel. El endpoint
  `GET /api/v1/internal/jobs/daily`, excluido del contrato comercial, exige
  `Authorization: Bearer <CRON_SECRET>` y rechaza previews. El secreto privado
  tiene al menos 32 caracteres en Vercel production y se compara por digest
  constante. Invocaciones simultáneas se coordinan mediante advisory try-lock.
- El usuario confirmó ejecución diaria para Hobby. No se ha programado el
  cron ni cortado el worker local: eso corresponde al despliegue 25.3.
  Recuperación conserva gracia, backoff y máximo de 20 operaciones; deja de
  iniciar operaciones al superar 150 segundos. Limpieza limita cada pasada a
  500 carritos vencidos; la expiración de sesión sigue siendo autoritativa.
- El API limita cargas a 4 MiB en Vercel. El formulario de imágenes limita
  archivos a 4 MiB en builds production y a 5 MiB en desarrollo, informa el
  límite y rechaza archivos grandes antes de previsualizar o enviar REST.
- Logo SVG empresarial fijo `company-logo-v1.svg`, incluido como bytes en
  código, servido por el endpoint de media existente. Incluye SHA-256 y no
  necesita filesystem mutable ni Cloudinary. El API lo devuelve en el perfil;
  solo nuevas órdenes/facturas manuales lo capturan. Facturar una orden copia
  su snapshot; los logos anteriores y documentos sin logo siguen admitidos.
- Retirados POST de carga de logo, controles editables y esquema Zod de carga;
  el formulario muestra el SVG. PATCH de logo se rechaza. No se reescriben
  columnas históricas ni documentos existentes.
- PDFs A4 con cabecera navy y logo, emisor/cliente, tabla de cinco columnas,
  cantidades/importes alineados, filas alternadas, totales USD y envío.
  Texto largo se ajusta; filas sobredimensionadas continúan, sin recortes.
  Encabezados de tabla se repiten y páginas se numeran. Se conserva el texto
  español y los importes de snapshots, sin consultar datos maestros vigentes.

## Verificación

- API: typecheck y lint correctos; build ejecutado al regenerar OpenAPI.
- OpenAPI: `pnpm openapi:generate` y `pnpm openapi:check` correctos.
- Pruebas focalizadas API: 34 correctas (documentos, entorno, cron y arranque
  sin timers). Incluyen 120 filas y una fila con texto muy largo.
- REST/perfil y snapshots: siete pruebas correctas con PostgreSQL
  local en bases aleatorias, independientes de la base de desarrollo. Se
  verificó además el rechazo REST del cron sin autenticación.
- Contrato API: 17 pruebas correctas con PostgreSQL local aislado. Un primer
  intento heredó la URL remota del entorno y agotó el tiempo de conexión;
  se corrigió el entorno de ejecución y se repitió localmente. Consulta
  posterior confirmó cero bases `ecommerce_contract_*` en Supabase.
- Backoffice: typecheck/lint correctos; 18 pruebas de formulario empresarial
  y carga de imágenes correctas, incluido rechazo temprano de archivo grande.
- Storefront: typecheck correcto.
- Regresión visual: ocho pruebas de temas, siete de tokens y 114 de frontend
  correctas. No se actualizaron snapshots para ocultar cambios.
- Cuatro muestras sintéticas en `tmp/pdf-25.1/`: orden/factura de tres ítems
  (una página cada una) y de 90 ítems (nueve páginas cada una). Las 20 páginas
  se renderizaron e inspeccionaron; extracción con pypdf confirmó todos los
  SKU, total y texto español. Las muestras grandes pesan menos de 100 KiB,
  por debajo del límite de respuesta de Vercel; no representan órdenes reales.
- OpenSpec estricto correcto; `git diff --check` correcto.

## Inventario histórico y entrega autorizada

Consulta de solo lectura a Supabase: 71 imágenes, 7 de Cloudinary y 60 Picsum.
Las cuatro restantes son:

| Producto | Estado | Referencia |
| --- | --- | --- |
| Notebook Pro 15 | INACTIVE | URL de ejemplo cdn.example.com |
| teclado mecanico corsair rgb | INACTIVE | URL ficticia imshrnfdjg |
| test | INACTIVE | Placeholder relativo /images/product-placeholder.svg |
| Smartphone Pro 256 | ACTIVE | localhost con clave a1bad9a3-59e8-491c-a0cd-ffa76c3ec8ef.png |

El placeholder existe en las aplicaciones. Las dos URLs ficticias mantienen
su fallback, sin fingir disponibilidad remota. La imagen local activa sí existe
en `apps/api/.local-storage/images/` (1.007.288 bytes).
No hay registros en `store_logo_assets`; la lectura de logos históricos se
verificó con fixtures aislados.

Tras confirmación, se incluyó **solo ese archivo existente** en
`src/product-catalog/image-storage/bundled-assets/`; Nest lo copia al build.
La lectura comprueba SHA-256 y no depende del almacenamiento mutable. En
Vercel, respuestas de catálogo, detalle, wishlist, carrito y edición de galería
resuelven exclusivamente esa clave/URL a `/api/v1/media/images/<clave>`.
No se modifican registros, claves, orden, portada ni referencias Cloudinary/Picsum.
Dos pruebas adicionales verifican bytes idénticos entre instancias, hash,
ausencia de mutación y preservación de otras referencias. Build y typecheck
correctos; el original local se conserva. No seed ni limpieza real Cloudinary.

## Archivos afectados

- API: `.env.example`, `src/app.module.ts`, `src/config/environment.ts`,
  `src/database/database.service.ts`; `src/internal-jobs/` (controller/módulo
  y dos pruebas); `src/shopping-cart-checkout/{anonymous-cart-cleanup.service,
  cart.repository}.ts`.
- Identidad empresarial: `src/billing-invoicing/{company-logo,issuer-snapshot,
  store-profile.controller,store-profile.domain,store-profile.service,
  billing-invoicing.module}.ts`.
- Documentos: `src/document-export/{document-export.service,document-templates,
  pdf-renderer.port,simple-pdf.adapter,document-export.spec,structured-pdf.spec}.ts`.
- Media: `src/product-catalog/image-storage/{image-media.controller,
  catalog-image-recovery.service,local-image-storage,bundled-catalog-image,
  bundled-catalog-image.spec}.ts`, `bundled-assets/`, `nest-cli.json`,
  `src/product-catalog/{product-administration.repository,wishlist.repository,
  product-images.service}.ts` y `product-gallery-panel.tsx` del backoffice.
- Pruebas API: `test/config/environment.spec.ts`,
  `test/e2e/store-profile.e2e.spec.ts`,
  `test/billing-invoicing/issuer-snapshot.integration.spec.ts`.
- Backoffice: `src/features/store-profile/{store-profile-api,
  store-profile-form,store-profile-management}`; `src/features/products/
  product-image-upload.tsx`; `test/{store-profile-management,
  product-image-upload}.spec.tsx`.
- Contratos: `apps/api/openapi/openapi.json`,
  `packages/api-client/src/generated/openapi.ts`,
  `packages/api-schemas/src/{store-profile,index}.ts`.
- OpenSpec: revisión aprobada de proposal, design, tasks y especificaciones de
  billing-invoicing, document-export, order-management y product-catalog.

No commit/push, publicación ni cambios de `.env` en esta entrega. README/AGENTS
globales y verificación en dominios finales están planificados en 25.4.
