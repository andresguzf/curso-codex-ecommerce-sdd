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

## Límite administrativo incorporado en 22.1

Cada producto admite como máximo cuatro imágenes totales: una portada y hasta tres adicionales. El placeholder existente también cuenta; no se exige completar los cuatro espacios. `POST /products/:productId/images` responde `409 PRODUCT_IMAGE_LIMIT_REACHED` cuando no queda espacio. El conteo y el alta se realizan bajo el bloqueo transaccional del producto: de dos cargas que compiten por el último espacio, solo una puede confirmarse. Los bytes de cargas rechazadas se limpian mediante el mecanismo compensatorio existente.

Crear un producto por el contrato de compatibilidad agrega una sola portada; editar su campo `image` reemplaza esa referencia, no agrega otra imagen. El seed aplica el mismo límite al incorporar referencias faltantes y revierte su transacción si esas altas excederían cuatro, sin eliminar archivos o imágenes administrativas para hacer espacio. Reejecutarlo sin altas puede conservar galerías antiguas mayores de cuatro: no se truncan automáticamente y pueden corregirse mediante las mutaciones administrativas existentes.

Verificación 22.1: 314 pruebas del API exitosas, incluidas integración PostgreSQL, autorización, límite, concurrencia, limpieza y seed en bases aisladas; typecheck, lint, generación y pruebas de contrato satisfactorias. No se ejecutó el seed contra la base local de desarrollo. El gestor visual administrativo sigue pendiente en la fase 22; esta tarea no incorpora carga en el formulario ni controles de calidad.

## Adaptadores administrativos incorporados en 22.2

`apps/backoffice/src/features/products/product-image-api.ts` ofrece `getAdministrativeProductGallery`, `uploadProductImage`, `updateProductImage` y `deleteProductImage`. La lectura reutiliza el detalle con `view=administrative`, ahora con `AbortSignal`, y devuelve la galería completa. PATCH/DELETE usan el cliente generado; la subida envía un `Blob` binario con MIME JPEG/PNG/WebP y query `altText`, `isPrimary` y `sortOrder` (solo cuando están definidos), sin multipart ni serialización JSON del archivo. Tipos de metadatos y respuesta provienen de OpenAPI; Zod valida entradas y respuestas.

Todas las operaciones admiten cancelación, Bearer en memoria y `credentials: include`. Los fallos muestran mensajes seguros para permisos, cuota, portada, tamaño, datos inválidos y transporte, sin exponer el texto recibido del servidor. Las cargas no se reintentan automáticamente; ante una respuesta incierta se debe recuperar el detalle antes de una nueva carga. Estos adaptadores no crean aún paneles, hooks ni controles de subida en el formulario.

Verificación 22.2: 22 pruebas nuevas de adaptadores y suite completa del backoffice de 148 pruebas exitosas; typecheck y lint satisfactorios. Las pruebas comprueban bytes, rutas, query, MIME, cancelación de las cuatro operaciones, autorización, rechazo de respuestas inválidas y una única solicitud por intento. No equivalen a una prueba de navegador del gestor visual futuro.

## Panel de consulta incorporado en 22.3

`ProductGalleryPanel` se integra dentro del formulario de productos para `ADMIN`: consume `images` del detalle, presenta miniaturas, orden, portada identificada por texto y borde y contador respecto del máximo de cuatro. No trunca galerías antiguas sobredimensionadas; advierte su exceso. Incluye carga, vacío, portada ausente, errores seguros y reintento explícito (no disponible para errores de autorización), con tokens del backoffice y fallback accesible para imágenes inválidas o no disponibles. El placeholder antiguo pertenece al storefront y se representa mediante fallback en el backoffice.

`useProductGallery` usa TanStack Query con identidad administrativa e ID de producto en la clave, cancelación y `gcTime: 0`, sin persistir respuestas privadas. Sin ID o sin permiso no consulta. Crear guarda primero el producto, conserva el formulario y los borradores durante el guardado y habilita la consulta con el ID retornado; guardar nuevamente actualiza ese mismo producto. Abrir una nueva alta reinicia la instancia del formulario. Refrescar o reintentar la galería no reinicia los campos comerciales.

La presentación es de solo lectura en 22.3. La subida con vista previa corresponde a 22.4; texto alternativo, portada y reordenamiento a 22.5; eliminación a 22.6. El campo URL de compatibilidad sigue disponible hasta integrar esas mutaciones visuales. No hay controles de calidad ni compresión.

Verificación 22.3: 162 pruebas del backoffice, 92 pruebas de frontend (incluidas cuatro nuevas vistas de galería a 375/1440 px en claro/oscuro y comprobaciones de accesibilidad), siete de tokens y ocho de regresión temática exitosas; typecheck, lint y build aislado de producción del backoffice satisfactorios. Se revisaron capturas de ambas composiciones. Las pruebas de navegador usan fixtures REST, no acreditan todavía las mutaciones del futuro gestor contra una API real. No se ejecutó el seed local ni se modificaron datos de desarrollo.

## Subida visual incorporada en 22.4

El panel administrativo incorpora selección JPEG/PNG/WebP, una vista previa local claramente marcada como no guardada y texto alternativo obligatorio con React Hook Form/Zod. La vista previa no se añade a la colección del servidor ni consume cuota; sus object URLs se liberan al reemplazar, descartar, completar o desmontar. El API conserva la validación autoritativa de contenido y tamaño.

`useProductImageUpload` envía bytes mediante el adaptador REST existente, con cancelación y sin reintentos automáticos. Bloquea envíos duplicados y el guardado/cancelación del formulario mientras finalizan la carga y la recuperación del detalle. El borrador comercial se conserva. Tras éxito o fallo se invalidan la galería y el listado; un intento nuevo es manual y no crea nuevamente el producto. Al alcanzar cuatro imágenes, incluso tras un conflicto concurrente, se bloquea la selección/subida.

Las pruebas cubren los tres formatos, archivo vacío/no admitido, texto alternativo, tamaño rechazado por el servidor, conflicto de cuota, fallo de red, recuperación del detalle, doble clic, cancelación al desmontar y liberación de recursos. Las pruebas de navegador verifican una subida REST simulada en claro/oscuro a 375/1440 px, ausencia de guardados comerciales y conservación del borrador; no sustituyen la integración con API real prevista en 22.7. Editar metadatos existentes, portada y orden queda para 22.5; eliminar, para 22.6. No hay compresión ni ajustes de calidad, y no se ejecutó el seed local.

Verificación 22.4: 174 pruebas del backoffice, 96 pruebas de frontend, siete de tokens y ocho de regresión temática exitosas; typecheck, lint, build aislado del backoffice y validación estricta de OpenSpec satisfactorios. Se revisaron las capturas en claro/oscuro y no se actualizaron referencias visuales. Las suites de navegador se ejecutaron por separado tras detectar un conflicto de archivos temporales entre ejecuciones simultáneas.

Archivos creados o modificados en 22.4 (sin atribuir cambios previos del árbol de trabajo):

- UI: `apps/backoffice/src/features/products/product-image-upload.tsx`, `use-product-image-upload.ts`, `product-gallery-panel.tsx`, `product-form.tsx` y `product-management.tsx` en el mismo directorio.
- Pruebas: `apps/backoffice/test/product-image-upload.spec.tsx`, `product-gallery-panel.spec.tsx` y `product-management.spec.tsx` en el mismo directorio.
- Navegador: `e2e/frontend/backoffice-catalog.spec.ts` y `e2e/frontend/catalog-api-fixture.ts`.
- Documentación y seguimiento: `README.md`, `AGENTS.md`, `docs/catalog-image-contract.md` y `openspec/changes/build-technology-ecommerce-platform/tasks.md`.

## Edición, portada y orden incorporados en 22.5

Cada miniatura incorpora iconos con nombre accesible para editar texto alternativo y elegir portada; el asa permite arrastrar hacia otra posición y los botones Subir/Bajar ofrecen la misma operación mediante teclado o interacción táctil. La edición usa React Hook Form/Zod, permite confirmar con Enter sin enviar el formulario comercial y cancelar sin solicitud. Tras completar o rechazar una mutación se recupera foco en el asa de la imagen; si falla la lectura del detalle, en Reintentar galería. Se conserva el estado autoritativo sin reordenamientos optimistas ni portadas locales ficticias.

`useProductImageMutations` reemplaza `useProductImageUpload` y reúne POST/PATCH bajo un único bloqueo inmediato, mantenido hasta finalizar la recuperación del detalle/listado. No hay reintentos automáticos; se cancela la solicitud al desmontar o cambiar de identidad/producto y no se muestra feedback privado para otra cuenta. Las imágenes anteriores sobredimensionadas siguen editables y ordenables, sin truncado ni nuevas cargas.

El formulario comercial conserva los borradores de nombre, precio, etiquetas y otros datos durante las mutaciones. URL/clave de compatibilidad se ofrecen solo en creación; el PATCH de un producto existente omite siempre `image`, evitando que una referencia vieja sobrescriba la portada recién elegida. No se agregan endpoints, cambios de inventario, eliminación visual ni ajustes de calidad. La eliminación confirmada corresponde a 22.6 y la validación del flujo completo con API real, a 22.7.

Verificación 22.5: 184 pruebas del backoffice, 100 pruebas de frontend, siete de tokens y ocho de regresión temática exitosas; typecheck, lint y build aislado del backoffice satisfactorios. Las cuatro vistas nuevas verifican edición, portada, orden persistido tras recarga, borrador y ausencia de `image` en el guardado comercial; en escritorio se prueba arrastre y en móvil botones equivalentes. Se revisaron capturas claro/oscuro a 375/1440 px, sin actualizar referencias visuales. Los escenarios de error comprueban recuperación autoritativa y foco, incluido el caso de imagen eliminada concurrentemente. Las pruebas de navegador usan fixtures REST; no acreditan todavía el flujo completo con API real. No se ejecutó el seed local.

Archivos de 22.5, sin atribuir cambios previos presentes en el árbol de trabajo:

- UI: `apps/backoffice/src/features/products/product-image-controls.tsx` (nuevo), `use-product-image-mutations.ts` (renombra/amplía `use-product-image-upload.ts`), `product-gallery-panel.tsx`, `product-image-upload.tsx`, `product-form.tsx` y `product-management.tsx`.
- Pruebas: `apps/backoffice/test/product-image-editing.spec.tsx` (nuevo), `product-gallery-panel.spec.tsx` y `product-management.spec.tsx`.
- Navegador: `e2e/frontend/catalog-api-fixture.ts` y `e2e/frontend/backoffice-catalog.spec.ts`.
- Documentación y seguimiento: `README.md`, `AGENTS.md`, `docs/catalog-image-contract.md` y `openspec/changes/build-technology-ecommerce-platform/tasks.md`.

## Eliminación confirmada incorporada en 22.6

Cada miniatura ofrece un icono de basurero con nombre accesible. Abre el `ConfirmationDialog` compartido, centrado en la ventana, con foco inicial en Cancelar, navegación de teclado, bloqueo del fondo y restauración de foco. Cancelar, pulsar Escape o cerrar el fondo antes de confirmar no envía DELETE. Durante la solicitud y recuperación del detalle se bloquean confirmaciones repetidas, cierre del modal, otras mutaciones y guardado/cancelación comercial.

La portada de un producto activo no puede eliminarse: la interfaz explica que primero debe seleccionarse otra y el API mantiene su protección autoritativa ante cambios concurrentes. Un producto inactivo puede perder su última imagen. Las galerías anteriores con más de cuatro imágenes permiten retiradas individuales confirmadas sin truncado automático; solo se habilitan cargas nuevas cuando quedan menos de cuatro.

`useProductImageMutations` amplía el mismo bloqueo de POST/PATCH a DELETE. Tras éxito o error se invalidan detalle y listado, el contador procede de la respuesta autoritativa y se mantiene el borrador comercial. Se muestran mensajes flash seguros; una respuesta perdida se recupera mediante GET sin repetir DELETE automáticamente. Al finalizar, el foco pasa al asa de la imagen original si permanece, a una vecina, a Reintentar galería o al panel vacío. El modal privado se oculta cuando la identidad deja de estar autorizada.

Verificación 22.6: 197 pruebas del backoffice; los 13 escenarios nuevos incluyen cancelación, portada activa, producto inactivo vacío, regularización de cinco imágenes, doble confirmación, errores 401/403/404/409, respuesta perdida y logout. Las cuatro pruebas nuevas de navegador usan fixtures REST para verificar modal, foco, contador, borrador, permisos visuales y accesibilidad en claro/oscuro a 375/1440 px; no sustituyen el flujo completo con API real reservado a 22.7. Se mantienen tokens y el lenguaje visual empresarial existente, usando las primitivas compartidas de confirmación. No se ejecuta el seed ni se modifican datos locales de desarrollo.

Archivos creados o modificados en 22.6 (sin atribuir cambios previos del árbol de trabajo):

La ejecución final completa obtuvo 104 pruebas de frontend, siete de tokens y ocho de regresión temática exitosas, además de las 197 del backoffice. Typecheck, lint, build aislado de producción, comprobación de diferencias y validación estricta de OpenSpec satisfactorios. Se revisaron las capturas claro/oscuro sin actualizar snapshots. Durante la verificación se corrigió un selector de prueba y la fixture genérica de eliminación de productos, que interceptaba indebidamente DELETE de imágenes; la repetición completa pasó.

- UI: `apps/backoffice/src/features/products/product-gallery-panel.tsx` y `use-product-image-mutations.ts`.
- Pruebas: `apps/backoffice/test/product-image-deletion.spec.tsx` (nuevo) y `product-gallery-panel.spec.tsx`.
- Navegador: `e2e/frontend/catalog-api-fixture.ts` y `e2e/frontend/backoffice-catalog.spec.ts`.
- Documentación y seguimiento: `README.md`, `AGENTS.md`, `docs/catalog-image-contract.md` y `openspec/changes/build-technology-ecommerce-platform/tasks.md`.

## Contratos y pruebas

La fase 22 se cierra con la validación integral 22.7: cinco escenarios Playwright con REST/PostgreSQL reales y almacenamiento temporal, nueva integración del ciclo de galería y protección de sesión durante DELETE. La evidencia reproducible, controles, archivos modificados y límites están en `e2e/VALIDATION-22.7.md`. El gestor ya permite subir, editar, elegir portada, ordenar y eliminar con confirmación; no incluye compresión ni calidad. No se ejecutó el seed local ni se archivó el cambio.

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
