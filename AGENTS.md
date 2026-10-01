# Project context

Este repositorio contiene la planificación y la implementación en curso de una plataforma e-commerce para productos tecnológicos.

Estado revisado en la tarea 21.8, el 1 de octubre de 2026:

- La planificación OpenSpec está completa.
- El cambio activo es `build-technology-ecommerce-platform`.
- Existen propuesta, diseño, siete especificaciones y 145 tareas verificables.
- Storefront, backoffice y API son funcionales: autenticación, catálogo, inventario, carrito anónimo/autenticado, checkout, órdenes, facturación, PDF, usuarios, taxonomía, wishlist, perfil empresarial con logo/snapshots y autocompletes están implementados.
- Fases 1–21 completadas: 145/145 tareas, incluidos controles editoriales administrativos, seed determinista y landing completa. No quedan tareas pendientes en este cambio activo, que todavía no está archivado. No infieras autorización para archivar, ejecutar el seed local, hacer commit/push o ampliar alcance.
- La revisión 18.5 y los informes de fases 18–20 son evidencia histórica. La consolidación final está en `e2e/VALIDATION-21.8.md`; los controles y la composición editorial se documentan en `docs/backoffice-featured-products.md`, `docs/backoffice-landing-categories.md` y `docs/landing-editorial.md`. Las pruebas automatizadas no equivalen a certificación de producción ni a auditoría manual completa de accesibilidad.
- Antes de trabajar, inspecciona el repositorio y el estado OpenSpec; no asumas que este estado sigue intacto ni reemplaces código que haya sido implementado posteriormente.

## Sources of truth

Usa estas fuentes según el tipo de información:

1. Las instrucciones actuales del usuario definen la intención inmediata.
2. `openspec/changes/build-technology-ecommerce-platform/specs/*/spec.md` define el comportamiento y los escenarios de aceptación.
3. `openspec/changes/build-technology-ecommerce-platform/design.md` define la arquitectura y las decisiones técnicas.
4. `openspec/changes/build-technology-ecommerce-platform/tasks.md` define el orden y la verificación del trabajo de implementación.
5. `openspec/changes/build-technology-ecommerce-platform/proposal.md` define motivación, alcance e impacto.
6. `README.md` es el resumen general para personas; no sustituye las especificaciones.

Cuando una solicitud cambie requisitos, arquitectura o alcance, no modifiques silenciosamente solo el código. Actualiza primero los artefactos OpenSpec mediante el workflow adecuado cuando el usuario haya pedido ese cambio de planificación.

# Product summary

Alcance total aprobado (incluye capacidades futuras, no es un checklist de implementación):

- Storefront público con landing page, hero y catálogo tecnológico.
- Identidad visual comercial propia de un e-commerce tecnológico.
- Shell reutilizable con header, navbar superior, logo SVG, footer y badge del carrito.
- Registro, login, sesión y autorización por roles.
- Búsqueda, filtros colapsables, ordenamiento, paginación backend y detalle por slug.
- Categorías administrables, etiquetas y wishlist persistente por cliente.
- Carrito persistente y checkout con pagos y envíos simulados.
- Historial de compras y gestión administrativa de órdenes.
- Control de inventario transaccional y auditable.
- Facturación manual o derivada de órdenes con autocomplete remoto.
- Perfil empresarial administrable y snapshots históricos del emisor.
- Exportación PDF de órdenes y facturas.
- Back office con navegación lateral, búsquedas superiores y filtros colapsables para usuarios, catálogo, inventario, órdenes y facturación.
- Dashboard empresarial por rol y un sistema visual completamente distinto del storefront.
- Temas claro y oscuro independientes y persistentes para cada aplicación.
- Seed no productivo con 20 productos, al menos 60 imágenes y usuarios `ADMIN` y `CUSTOMER` de ejemplo.
- Landing con 3 destacados, 9 recientes no repetidos y hasta 3 categorías importantes con 3 productos cada una.
- Portada única para tarjetas y galería accesible tipo carrusel en el detalle.

# Architecture

La arquitectura implementada es un monorepo con aplicaciones desplegables de forma independiente:

```text
+---------------------+       +---------------------+
| Next.js Storefront  |       | Next.js Backoffice  |
| catalog/cart/account|       | admin/billing       |
+----------+----------+       +----------+----------+
           |                             |
           +--------- REST / OpenAPI ----+
                         |
                 +-------v--------+
                 | NestJS API     |
                 | modular monolith|
                 +-------+--------+
                         |
                 +-------v--------+
                 | PostgreSQL     |
                 +----------------+
```

Frontend y backend comparten repositorio, pero no ejecución ni acceso a datos.

## Repository structure

```text
apps/
  storefront/       Next.js: catálogo, wishlist, carrito, checkout y cuenta
  backoffice/       Next.js: usuarios, catálogo, empresa, stock, órdenes y facturas
  api/              NestJS: API REST y lógica de negocio

packages/
  api-client/       Cliente TypeScript generado desde OpenAPI
  api-schemas/      Esquemas Zod para fronteras HTTP
  ui/               Componentes presentacionales compartidos
  config-*/         TypeScript, ESLint y Tailwind compartidos

infra/
  database/         Guía de infraestructura de PostgreSQL
  docker/           Imágenes y composición de servicios
  deployment/       Configuración de despliegue
```

El esquema Drizzle, las migraciones y el seed ejecutable están en `apps/api/src/database/`, no en `infra/database/`. Conserva las convenciones reales del repositorio y mantén los límites arquitectónicos.

## Implemented application routes

- Storefront: `/`, `/products`, `/products/[productId]`, `/login`, `/register`, `/cart`, `/checkout`, `/checkout/orders/[orderId]`, `/account`, `/account/wishlist`, `/account/orders`, `/account/orders/[orderId]`, `/account/invoices` y `/account/invoices/[invoiceId]`.
- Backoffice: `/`, `/login`, `/users`, `/products`, `/products/[productId]/inventory`, `/inventory`, `/categories`, `/tags`, `/orders`, `/orders/[orderId]`, `/invoices`, `/invoices/[invoiceId]` y `/store-profile`. Crear/editar productos usa formularios dentro de `/products`.
- `BILLING` tiene navegación hacia órdenes, facturas y consulta del perfil empresarial; el CRUD del perfil y logo sigue siendo exclusivo de `ADMIN`. La portada `/` del backoffice implementa el dashboard de 19.5–19.6 para `ADMIN` y `BILLING`, sin enlaces ni métricas de módulos prohibidos.

## Dependency boundaries

```text
storefront  --> api-client, api-schemas, ui
backoffice  --> api-client, api-schemas, ui
api         --> dominio, persistencia, infraestructura

storefront  -x-> ORM o PostgreSQL
backoffice  -x-> ORM o PostgreSQL
frontend    -x-> entidades internas del backend
```

- Solo `apps/api` accede a PostgreSQL.
- Frontend y backend comparten contratos públicos, no entidades de persistencia.
- Los controladores del API no acceden directamente a repositorios de otros módulos.
- Checkout coordina catálogo, carrito, pago simulado, órdenes e inventario mediante operaciones de módulo.
- Mantén el backend como monolito modular; no introduzcas microservicios sin un cambio OpenSpec explícito.

## UI shells and implemented visual systems

Los shells separados y cuatro temas están implementados. El storefront conserva su navbar azul oscuro fijo y translúcido al desplazar y su identidad comercial; el backoffice mantiene una identidad slate/navy/azul empresarial. `ADMIN` y `BILLING` pueden elegir claro u oscuro. La galería manual y la landing editorial están implementadas: destacados, recientes deduplicados y categorías importantes ordenadas, sin filtros ni paginador en inicio.

```text
StorefrontShell
  Header/Navbar: logo SVG, tienda, inicio, cuenta, login/logout, badge del carrito
  Hero: fondo tecnológico semitransparente y búsqueda
  Main: recientes sin filtros en /; catálogo con sidebar izquierdo de filtros en /products
  Footer

BackofficeShell
  Sidebar izquierdo: navegación por rol
  Header contextual
  Main: búsqueda superior, tabla o lista paginada
  Sidebar derecho: filtros
```

- Comparte primitivas visuales mediante `packages/ui`, pero conserva shells independientes por aplicación.
- Los filtros usan drawers accesibles en pantallas pequeñas, bloqueo del fondo y restauración de foco. La navegación móvil actual del backoffice se despliega en el header; no la describas como un drawer ya implementado.
- Mantén búsqueda, filtros, orden y página en la URL; cambiar criterios reinicia `page=1`.
- Usa estado local o Zustand únicamente para apertura visual compartida de paneles, nunca para duplicar resultados del API.
- Los mensajes flash usan una región `aria-live` y se disparan desde handlers o callbacks de mutación.
- Toda eliminación lógica, desactivación o retirada de línea del carrito requiere un modal Tailwind accesible antes de enviar la operación.
- Comparte primitivas accesibles, no una apariencia completa: storefront y backoffice deben usar tokens, paletas, densidades y jerarquías diferentes.
- El storefront prioriza imágenes, productos, promociones, precio, stock y acciones de compra con patrones familiares de tienda online.
- El backoffice usa una estética minimalista y empresarial, paleta slate/navy/azul, tablas compactas, colores semánticos y tarjetas KPI.
- Mantén cuatro combinaciones verificables: storefront claro/oscuro y backoffice claro/oscuro.
- En la primera visita respeta `prefers-color-scheme`; después conserva una preferencia local independiente por aplicación.
- Aplica el tema antes de la primera presentación visible para evitar parpadeo durante la hidratación.
- Exige contraste WCAG AA, foco visible y significado no dependiente solo del color en todos los componentes y estados.

### Theme implementation and verification

- Los tokens viven en `apps/storefront/src/styles/design-tokens.css` y `apps/backoffice/src/styles/design-tokens.css`; `packages/ui/src/theme-coverage.css` adapta utilidades heredadas, no impone una apariencia única.
- `packages/ui/src/theme-bootstrap.ts` aplica `data-design-system` y `data-theme` en el head antes del body; `theme-provider.tsx` crea un store Zustand por instancia y sincroniza sistema/almacenamiento sin usar datos de sesión.
- Claves locales: `technology-ecommerce:storefront:theme` y `technology-ecommerce:backoffice:theme`, solo `light` o `dark`. Nunca almacenes tokens de autenticación o datos privados junto a esta preferencia. La elección explícita prevalece sobre el sistema y es independiente de roles/logout; sin storage funciona en memoria, sin garantizar persistencia entre recargas.
- El selector está fijo abajo a la derecha, tiene nombre accesible, `aria-pressed` y soporte de teclado. Las regiones `data-tone-region="inverse"` conservan franjas oscuras; formularios anidados usan `data-tone-region="surface"`.
- Ejecuta `pnpm test:e2e:themes`, `pnpm test:e2e:design-tokens` y `pnpm test:e2e:frontends --workers=2` ante cambios visuales. La fase 19.8 verificó 57 pruebas de frontend, siete de tokens y 16 referencias de las cuatro combinaciones a 375/1440 px; esto no equivale a una auditoría manual completa de accesibilidad.
- Las referencias PNG actuales son Chromium/macOS. En otra plataforma crea referencias propias revisadas; no actualices snapshots automáticamente para ocultar regresiones. Consulta `docs/theme-regression-testing.md` y el catálogo `docs/design-system.html`.
- No hay gráficos de analítica implementados. Los nuevos componentes deben conservar los cuatro temas y no presentar métricas ficticias. Galería y composición editorial completa están implementadas; conserva su cobertura ante cambios posteriores.

# Technology conventions

Temas, dashboard, imágenes múltiples, seed, galería, API editorial, controles administrativos y composición visual completa están implementados y verificados en 21.8.

## Monorepo

- pnpm workspaces.
- Turborepo para tareas y caché.
- Configuraciones compartidas de TypeScript, ESLint, Tailwind y testing.
- Aplicaciones con build, variables de entorno y despliegue independientes.

## Frontend

- Next.js con App Router y TypeScript.
- React estable 19.2.8 o posterior disponible al implementar; mantén `react-dom` alineado y evita canales canary o experimentales salvo petición explícita.
- Tailwind CSS para estilos.
- TanStack Query para estado remoto, caché, mutaciones e invalidación.
- Zustand con `create()` solo para estado global del cliente que no duplique datos del servidor.
- Zod para entradas y respuestas HTTP no confiables.
- React Hook Form integrado con Zod mediante `zodResolver`.
- Shells separados para storefront y backoffice compuestos desde primitivas compartidas.
- Sidebars, drawers, mensajes flash y modales accesibles con foco visible y navegación por teclado.
- Autocomplete remoto mediante un custom hook con término mínimo, espera breve, cancelación de solicitudes obsoletas y caché.
- Variables CSS semánticas y `data-theme="light|dark"` para los cuatro sistemas visuales.
- Zustand únicamente para exponer el estado visual y la acción de alternar tema; no persistas esta preferencia en PostgreSQL ni mediante Server Actions.
- Componentes pequeños, puros y con una sola responsabilidad.
- Estado inmutable y hooks llamados únicamente en el nivel superior.
- `useEffect` solo para sincronizar con sistemas externos; no para lógica derivada ni eventos de usuario.
- Dispara feedback de mutaciones desde event handlers o callbacks de TanStack Query, no observando estado mediante `useEffect`.
- Los Server Components pueden hacer lecturas REST para SSR o SEO.
- No uses Server Actions ni Route Handlers de Next.js para lógica de negocio o acceso a datos.
- No crees un backend paralelo dentro de las aplicaciones Next.js.

## Backend

- NestJS como API REST modular.
- Prefijo público `/api/v1`.
- OpenAPI como contrato de la API.
- Cliente TypeScript generado desde OpenAPI.
- Errores uniformes con código estable, mensaje seguro, detalles de campo y correlation ID.
- ORM con migraciones y transacciones; usa SQL explícito cuando el bloqueo o la concurrencia lo requieran.
- Autorización, propiedad de recursos y validación de entrada aplicadas en el API.
- Adaptadores para pago simulado, envío, almacenamiento de imágenes y generación PDF.

## Data

- PostgreSQL es la autoridad transaccional.
- Usa importes decimales de precisión fija y conserva el código técnico de moneda, fijado globalmente en `USD`; nunca `float` para dinero ni permitas seleccionar moneda por producto u operación.
- Usa fechas con zona horaria.
- Conserva snapshots históricos en líneas de orden y factura.
- Conserva snapshots del perfil empresarial en órdenes, facturas y PDFs.
- Productos y usuarios con referencias históricas se desactivan o eliminan lógicamente.
- Categorías y etiquetas referenciadas también se desactivan o eliminan lógicamente.
- Los slugs son únicos y no se regeneran automáticamente cuando cambia un nombre publicado.
- Las imágenes viven fuera de PostgreSQL; guarda solo clave, URL y metadatos.
- Cada variación de inventario debe producir un movimiento auditable.
- `ProductImage` representa una colección ordenada con `isPrimary`, `sortOrder` y `altText`; un producto publicable tiene exactamente una portada.
- Los seed de productos y usuarios son explícitos, idempotentes, exclusivos de desarrollo/pruebas y deben fallar antes de escribir en producción.
- `Product` incorpora `isFeatured` y `featuredAt`; `Category` incorpora `showOnLanding` y `landingOrder` del 1 al 3.

# Domain modules

- `identity-access`: usuarios, sesiones, roles, propiedad y autorización.
- `product-catalog`: productos, imágenes, categorías, etiquetas, slugs, wishlist, búsqueda, filtros, detalle y paginación.
- `shopping-cart-checkout`: carrito, badge de unidades, totales, pago/envío simulado e idempotencia.
- `order-management`: órdenes, snapshots, historial y transiciones.
- `inventory-control`: balances, movimientos, ajustes y concurrencia.
- `billing-invoicing`: perfil empresarial, autocompletes, facturas manuales o desde orden, numeración y estados.
- `document-export`: PDF de órdenes y facturas con identidad empresarial histórica.
- `audit-observability`: auditoría, correlation IDs, logs y métricas.
- `dashboard`: coordinación de lecturas autorizadas mediante operaciones públicas de módulos; sin repositorios ajenos en controladores ni lógica de negocio en Next.js.

# Roles and authorization

El sistema reconoce exactamente:

- `CUSTOMER`: navega, administra wishlist y carrito, compra y consulta únicamente sus compras, facturas y documentos.
- `ADMIN`: administra usuarios, productos, categorías, etiquetas, perfil empresarial, inventario, órdenes y facturas.
- `BILLING`: administra órdenes mediante transiciones válidas, incluida su finalización y cancelación elegible; consulta clientes, productos autorizados y perfil empresarial para crear facturas manuales o desde órdenes y gestionar estados de facturación. No administra usuarios, catálogo, perfil empresarial ni ajustes directos de inventario.

Reglas obligatorias:

- El registro público siempre crea `CUSTOMER` desde el backend.
- Solo `ADMIN` asigna o modifica roles.
- No se puede desactivar al último administrador activo.
- `BILLING` puede completar y cancelar órdenes elegibles con las mismas reglas transaccionales y de auditoría de `ADMIN`, sin editar snapshots históricos.
- Un `CUSTOMER` nunca accede a recursos de otro cliente.
- La interfaz puede ocultar acciones, pero el API siempre debe volver a autorizarlas.

# Business invariants

1. El frontend consume exclusivamente el API REST.
2. Orden, pago y factura son agregados independientes.
3. El carrito no reserva ni descuenta stock.
4. Un checkout aprobado crea la orden y descuenta inventario exactamente una vez.
5. Un pago rechazado no confirma orden ni modifica inventario.
6. El stock nunca puede quedar negativo, incluso ante compras concurrentes.
7. El checkout usa una clave de idempotencia para evitar duplicados.
8. Cancelar una orden elegible restituye inventario exactamente una vez mediante un movimiento compensatorio.
9. Facturar, pagar, anular o exportar una factura nunca modifica inventario.
10. Una factura manual no modifica inventario.
11. Una venta administrativa de productos físicos debe originarse como orden antes de facturarse.
12. Una orden no puede producir dos facturas activas.
13. Factura y cambio de la orden a `INVOICED` deben confirmarse atómicamente.
14. Cambios posteriores de productos, clientes o direcciones no alteran órdenes, facturas ni PDFs históricos.
15. Toda colección potencialmente grande se busca, filtra, ordena y pagina en el backend.
16. La wishlist no reserva ni descuenta stock y cada cliente accede solo a la propia.
17. Una combinación cliente-producto no puede duplicarse dentro de la wishlist.
18. Los productos usan un slug único, una categoría principal y cero o más etiquetas.
19. Categorías, etiquetas y productos referenciados históricamente no se destruyen físicamente.
20. Solo `ADMIN` modifica el perfil empresarial; `BILLING` puede consultarlo para facturación.
21. Cada orden y factura conserva un snapshot empresarial, y los PDFs nunca mezclan ese snapshot con el perfil vigente.
22. Storefront y backoffice deben ser visualmente distinguibles aunque compartan primitivas accesibles.
23. Cada aplicación conserva de manera independiente la selección explícita entre tema claro y oscuro.
24. El dashboard devuelve únicamente indicadores autorizados para `ADMIN` o `BILLING`; `CUSTOMER` no accede al resumen.
25. Las tarjetas usan únicamente la portada; el detalle devuelve y presenta la galería ordenada.
26. La galería no usa autoplay y soporta miniaturas, teclado, controles anterior/siguiente y gestos táctiles.
27. La sección de recientes de la landing muestra como máximo 9 productos activos y no tiene paginador.
28. El catálogo completo es una página separada con búsqueda, filtros, orden y paginación backend.
29. El seed crea exactamente 20 productos y usuarios `ADMIN` y `CUSTOMER` sin duplicados y nunca se ejecuta automáticamente en producción.
30. Solo `ADMIN` administra destaques y categorías importantes.
31. La landing presenta primero hasta 3 destacados, luego hasta 9 recientes sin repetirlos y después entre 2 y 3 categorías importantes.
32. Cada categoría importante presenta hasta 3 productos recientes y puede repetir productos de secciones anteriores.
33. Productos o categorías inactivos nunca aparecen en la composición pública.
34. `GET /api/v1/catalog/landing` compone todas las secciones y no expone campos editoriales administrativos.

## State machines

```text
Order:   PROCESSING --> INVOICED --> COMPLETED
              |
              +--> CANCELLED, cuando la transición sea válida

Payment: PENDING --> APPROVED | REJECTED

Invoice: DRAFT --> PENDING_PAYMENT --> PAID
             |
             +--> VOID, cuando la transición sea válida
```

# REST API and OpenAPI status

El contrato implementado en `apps/api/openapi/openapi.json` contiene 48 paths; se sirve en `/api/v1/openapi.json` y expone Swagger UI interactivo en `/api/v1/docs`. `packages/api-client` se genera desde ese archivo y `packages/api-schemas` valida respuestas HTTP con Zod. Incluye las rutas existentes y `/catalog/landing` y las mutaciones de imágenes de producto ya implementadas. Mantén `/api/v1`, nombres REST coherentes, validación, autorización, paginación y errores uniformes, y ejecuta `pnpm openapi:generate` seguido de `pnpm openapi:check` al cambiar el contrato.

## Health

- `GET /api/v1/health`: salud y readiness del API.

## Authentication

- `POST /api/v1/auth/register`: registro público como `CUSTOMER`.
- `POST /api/v1/auth/login`: autenticación.
- `GET /api/v1/auth/csrf`: obtiene la protección para refresh/logout.
- `POST /api/v1/auth/refresh`: renovación protegida de sesión.
- `POST /api/v1/auth/logout`: revocación de sesión.
- `GET /api/v1/auth/me`: identidad y rol actuales.

Los access tokens viajan como Bearer y se conservan solo en memoria. La cookie de refresh es `HttpOnly`; la sesión se recupera mediante refresh y no persistiendo tokens en localStorage. Las contraseñas nuevas usan Argon2id; se verifican hashes scrypt anteriores y se actualizan al autenticar cuando corresponde.

## User administration

- `GET /api/v1/users`: listado administrativo paginado; también alimenta autocomplete autorizado de clientes con `search` y `pageSize` limitado.
- `POST /api/v1/users`: creación por `ADMIN`.
- `GET /api/v1/users/:userId`: detalle autorizado.
- `PATCH /api/v1/users/:userId`: datos, rol o estado según permisos.
- `DELETE /api/v1/users/:userId`: eliminación lógica o desactivación, nunca destrucción de historial.

## Products and catalog

- `GET /api/v1/catalog/landing`: composición pública fija de destacados, recientes deduplicados y categorías importantes; límites 3/9/3, sin parámetros de filtros/paginación ni campos editoriales administrativos. La UI consume las tres secciones en ese orden mediante una sola consulta.
- `GET /api/v1/products`: catálogo, listado administrativo o autocomplete autorizado con `page`, `pageSize`, `search`, categoría, etiquetas, disponibilidad, precio, filtros y orden.
- `POST /api/v1/products`: creación por `ADMIN`.
- `GET /api/v1/products/:productId`: detalle autorizado.
- `GET /api/v1/products/slug/:slug`: detalle público por slug único.
- `PATCH /api/v1/products/:productId`: edición por `ADMIN`.
- `DELETE /api/v1/products/:productId`: eliminación lógica por `ADMIN`.
- `PATCH /api/v1/products/:productId/status`: activar o desactivar.
- `POST /api/v1/products/:productId/images`: agregar bytes de imagen y metadatos mediante el adaptador de almacenamiento, solo `ADMIN`.
- `PATCH /api/v1/products/:productId/images/:imageId`: editar texto alternativo, orden o portada, solo `ADMIN`.
- `DELETE /api/v1/products/:productId/images/:imageId`: eliminar una imagen sin dejar un producto activo sin portada, solo `ADMIN`.

El contrato conserva `image` por compatibilidad, devuelve `coverImage` en listados y agrega `images` ordenadas en detalle. Las tarjetas presentan únicamente la portada; `ProductGallery` consume la colección del detalle, empieza en la portada y nunca modifica la portada persistida al navegar. No inventes rutas paralelas a `/products/slug/:slug`. Los filtros administrativos incluyen precio, categoría, etiquetas y `createdFrom`/`createdTo` como fechas ISO `YYYY-MM-DD`; los rangos de órdenes/facturas usan fecha-hora ISO. El formulario permite crear/asignar etiquetas por nombre y slug opcional; las categorías se administran aparte y se seleccionan.

Implementado en 21.1–21.5: `PATCH /products/:productId` admite `isFeatured` y el servidor calcula `featuredAt`; `PATCH /categories/:categoryId` admite `showOnLanding` y `landingOrder`, rechazando una cuarta categoría importante. Ambas mutaciones requieren `ADMIN` y auditoría. No envíes `featuredAt` como entrada editable. El backoffice ofrece estrellas en listado/formulario, selección de categorías, arrastre y controles alternativos de teclado; confirma las retiradas, advierte configuraciones incompletas e invalida consultas tras mutaciones exitosas. `GET /categories?showOnLanding=true|false` es administrativo; el panel consulta una página de tres seleccionadas, incluidas inactivas, sin descargar todas las categorías.

## Categories and tags

- `GET /api/v1/categories`: listado paginado, búsqueda y filtros.
- `POST /api/v1/categories`: creación por `ADMIN`.
- `GET /api/v1/categories/:categoryId`: detalle autorizado.
- `PATCH /api/v1/categories/:categoryId`: edición o cambio de estado por `ADMIN`.
- `DELETE /api/v1/categories/:categoryId`: eliminación lógica por `ADMIN`.
- `GET /api/v1/tags`: listado paginado, búsqueda y filtros.
- `POST /api/v1/tags`: creación por `ADMIN`.
- `GET /api/v1/tags/:tagId`: detalle autorizado.
- `PATCH /api/v1/tags/:tagId`: edición o cambio de estado por `ADMIN`.
- `DELETE /api/v1/tags/:tagId`: eliminación lógica por `ADMIN`.

## Wishlist

- `GET /api/v1/wishlist`: wishlist paginada del cliente autenticado.
- `POST /api/v1/wishlist/items`: agregar un producto sin duplicarlo.
- `DELETE /api/v1/wishlist/items/:productId`: retirar un producto propio.

La wishlist no reserva stock. Agregar uno de sus productos al carrito usa el endpoint normal del carrito, revalida disponibilidad y no elimina automáticamente el deseo.

## Inventory

- `GET /api/v1/inventory`: balances paginados para `ADMIN`.
- `GET /api/v1/inventory/:productId/movements`: historial de movimientos.
- `POST /api/v1/inventory/:productId/adjustments`: ajuste con cantidad y motivo.

No expongas una actualización genérica de `stock` dentro del `PATCH` de producto. El catálogo puede proyectar `stockAvailable`, pero los cambios deben pasar por movimientos de inventario.

## Cart and checkout

- `GET /api/v1/cart`: carrito activo del visitante o cliente; no exige login al visitante.
- `POST /api/v1/cart/items`: agregar producto.
- `PATCH /api/v1/cart/items/:itemId`: cambiar cantidad.
- `DELETE /api/v1/cart/items/:itemId`: eliminar línea.
- `POST /api/v1/cart/claim`: reclama el carrito del visitante para el cliente autenticado. La cookie anónima opaca es `HttpOnly`; el carrito no reserva stock y el checkout exige `CUSTOMER`.
- `POST /api/v1/checkout`: validar, simular pago/envío y confirmar compra; requiere `Idempotency-Key`.
- `GET /api/v1/checkout/shipping-methods`: costos configurados del envío simulado en USD; requiere `CUSTOMER`.
- `GET /api/v1/checkout/orders/:orderId`: confirmación histórica del checkout propio desde su resultado idempotente; requiere `CUSTOMER` y comprueba propiedad. No representa el estado operativo vigente de la orden.

El formulario `/checkout` recupera el carrito del cliente, valida dirección con React Hook Form y Zod y usa costos del API. Conserva la misma clave y petición ante resultados inciertos, bloquea envíos duplicados y navega a `/checkout/orders/:orderId` al confirmar. La confirmación se recupera por REST tras una recarga; no persistas tokens ni respuestas de compras en localStorage.

## Orders

Implementado en 7.2: `GET /orders/mine` admite `page` (1–1000000), `pageSize` (1–100, por defecto 20) y `status` opcional, ordena por `createdAt DESC, id DESC` y cuenta/pagina exclusivamente las órdenes del cliente autenticado. `GET /orders/:orderId` devuelve snapshots históricos y estado operativo vigente; para `CUSTOMER`, una orden ajena responde `404 ORDER_NOT_FOUND`, igual que una inexistente. No confundir el detalle operativo con la confirmación inmutable `/checkout/orders/:orderId`. Las consultas usan transacciones de lectura repeatable-read y no hacen joins a datos maestros para reconstruir snapshots.

Implementado en 7.3: `ADMIN` y `BILLING` consultan cualquier detalle y `GET /orders` con búsqueda literal sobre número, nombre o email históricos, filtros `customerId`, `status`, `createdFrom`, `createdTo` (fecha-hora ISO inclusiva), `invoicing=ACTIVE_INVOICE|NO_ACTIVE_INVOICE`, paginación y orden `sortBy=createdAt|number|total|status`, `sortOrder=asc|desc`. Una factura no anulada cuenta como activa. La autorización inicial de las mutaciones de órdenes fue ampliada en 7.7; `/orders/mine` sigue siendo exclusivo de `CUSTOMER`.

Implementado en 7.5: el storefront ofrece `/account/orders` y `/account/orders/:orderId` exclusivamente a sesiones `CUSTOMER`. El historial solicita una sola página al API, conserva `page` y `status` en la URL y usa la paginación compartida. El detalle consume el endpoint operativo `/orders/:orderId`, no la confirmación inmutable del checkout, y renderiza únicamente campos reconocidos de los snapshots históricos de cliente, líneas, dirección, envío y pago. La caché de TanStack Query incluye el identificador del cliente, no persiste datos privados y se descarta al quedar sin observadores; un cambio de cuenta nunca muestra temporalmente el detalle anterior. Las respuestas `401`, `403` y `404` no exponen datos de la orden ni mensajes internos del servidor. La navegación de clientes y la confirmación del checkout enlazan a estas vistas.

Implementado en 7.6: el back office ofrece `/orders` y `/orders/:orderId` a sesiones `ADMIN` y `BILLING`. El listado solicita una sola página al API, conserva búsqueda, estado, facturación, rango de fechas, cliente, orden y página en la URL, y presenta filtros colapsables a la derecha. El detalle reconstruye exclusivamente snapshots históricos reconocidos y separa el estado operativo actual. Las consultas y mutaciones usan TanStack Query, validación Zod y errores seguros sin persistir respuestas privadas.

Implementado en 7.7: `ADMIN` y `BILLING` pueden completar una orden `INVOICED` mediante `PATCH /orders/:orderId/status` con `{ "status": "COMPLETED" }`, o cancelar una orden `PROCESSING` o `INVOICED` elegible mediante el comando dedicado. Ambas operaciones conservan las mismas reglas de bloqueo, auditoría e idempotencia; la cancelación restituye inventario exactamente una vez sin conceder a `BILLING` acceso a ajustes manuales. El back office muestra las acciones según el estado para ambos roles. `CUSTOMER` sigue rechazado y `BILLING` continúa sin permisos sobre usuarios, catálogo, perfil empresarial ni inventario directo. La conversión a factura está implementada en 8.2.

- `GET /api/v1/orders`: listado administrativo para `ADMIN` y `BILLING`.
- `GET /api/v1/orders/mine`: historial del cliente autenticado.
- `GET /api/v1/orders/:orderId`: detalle con comprobación de propiedad o rol.
- `PATCH /api/v1/orders/:orderId/status`: transición administrativa permitida.
- `POST /api/v1/orders/:orderId/cancel`: implementado en 7.4 y extendido a `BILLING` en 7.7, recibe `reason` obligatorio de 1–500 caracteres tras trim. Cancela `PROCESSING` o `INVOICED` únicamente sin facturas distintas de `VOID`; responde `409 ORDER_ACTIVE_INVOICE` si debe anularse primero una factura. Bloquea la orden antes de los balances y restituye las cantidades de sus movimientos `SALE`, con movimientos `CANCELLATION` y auditoría atómicos. Reintentos sobre `CANCELLED` devuelven el resultado existente, sin duplicar movimientos ni sobrescribir el primer motivo y actor. No modifica pagos ni facturas. El futuro flujo de emisión debe bloquear la misma orden y revalidar su estado para coordinarse con la cancelación.
- `POST /api/v1/orders/:orderId/invoice`: implementado en 8.2 para `ADMIN` y `BILLING`; bloquea una orden `PROCESSING`, comprueba que tenga pago y no exista otra factura activa, crea y emite la factura desde los snapshots históricos y cambia la orden a `INVOICED` en una sola transacción. Un pago `APPROVED` deja la factura `PAID`; otro pago registrado la deja `PENDING_PAYMENT`. La operación audita ambos agregados y no modifica inventario. Desde 15.4 conserva el snapshot empresarial histórico capturado en la orden.
- `GET /api/v1/orders/:orderId/pdf`: descargar PDF autorizado.

## Invoices

Implementado en 8.1: `InvoiceAggregate` crea borradores `DRAFT` sin número, valida origen, referencias, líneas, importes de precisión fija, impuestos, moneda `USD`, snapshots y fechas, y copia los datos en sus fronteras para mantenerlos inmutables. Al emitir a `PENDING_PAYMENT` asigna el número determinista y único `INV-<UUID>`; después admite `PAID` y permite anular desde `DRAFT`, `PENDING_PAYMENT` o `PAID`. `InvoiceLifecycleService` bloquea la factura, persiste exclusivamente los campos de ciclo de vida y registra `INVOICE_STATUS_CHANGED` en la misma transacción para `ADMIN` o `BILLING`. Un fallo de auditoría revierte la transición.

Implementado en 8.2: `InvoiceFromOrderService` coordina orden y factura dentro de una transacción PostgreSQL. Bloquea primero la orden igual que el flujo de cancelación, rechaza estados no elegibles, pagos ausentes y facturas activas, y conserva líneas, precios, impuestos, totales y cliente desde la orden sin consultar producto o usuario vigente. Persiste factura, líneas, estado `INVOICED` y dos entradas de auditoría de forma atómica. La restricción parcial `invoices_active_order_unique` sirve como defensa adicional contra duplicados. No importa ni invoca operaciones de inventario. El snapshot empresarial completo está implementado desde 15.4.

Implementado en 8.3: `POST /api/v1/invoices` crea un borrador manual `MANUAL` sin orden para `ADMIN` o `BILLING`. Valida un cliente activo con rol `CUSTOMER`, líneas personalizadas o referencias a productos activos, cantidades, importes y tasas; cuando existe `productId`, captura SKU, nombre y descripción vigentes del backend en vez de confiar en esos textos del cliente. Calcula subtotal, impuesto por línea con redondeo a centavos y total en `USD`, y persiste factura, líneas y `MANUAL_INVOICE_CREATED` atómicamente. No importa ni invoca orden, pago o inventario. El snapshot empresarial completo está implementado desde 15.4.

Implementado en 8.4: `InvoiceQueryService` y `InvoiceController` exponen `GET /api/v1/invoices` con búsqueda, filtros por cliente/estado/origen/fechas, ordenamiento explícito y paginación backend; `GET /api/v1/invoices/:invoiceId` reconstruye el detalle desde snapshots y líneas históricas. `CUSTOMER` queda limitado por API a sus propias facturas, mientras `ADMIN` y `BILLING` consultan el ámbito administrativo. `PATCH /api/v1/invoices/:invoiceId/status` delega en el agregado y `InvoiceLifecycleService` para aplicar transiciones válidas, bloqueo y auditoría atómica únicamente a `ADMIN`/`BILLING`; las operaciones no tocan inventario.

Implementado en 8.5: el back office ofrece `/invoices` y `/invoices/:invoiceId` con tabla paginada, búsqueda superior, filtros colapsables, detalle histórico y acciones de transición para `ADMIN` y `BILLING`. `ManualInvoiceForm` usa React Hook Form con `zodResolver` y Zod, permite líneas manuales y envía solo identificadores/valores validados al API; la conversión desde una orden usa `POST /api/v1/orders/:orderId/invoice`. Los clientes no tienen acceso al workspace administrativo. El autocomplete remoto está implementado desde 17.3.

El listado y el detalle de órdenes también exponen `Facturar orden` para órdenes `PROCESSING` en ambos roles administrativos. La acción usa confirmación, llama al endpoint de conversión atómica y actualiza las consultas de órdenes y facturas, sin mostrar avisos de una fase futura.

Implementado en 8.6: el storefront ofrece `/account/invoices` y `/account/invoices/:invoiceId` exclusivamente a `CUSTOMER`. El listado consulta una sola página con `GET /api/v1/invoices`, conserva `page` en la URL y presenta paginación; el detalle usa `GET /api/v1/invoices/:invoiceId` y muestra únicamente líneas, totales, estado, origen y snapshots históricos reconocidos. Las consultas privadas incluyen el identificador del cliente en la clave de TanStack Query, no persisten respuestas y no exponen acciones de cambio de estado. La autorización sigue siendo del API: `CUSTOMER` solo recibe sus facturas y una factura ajena responde como no encontrada, sin renderizar sus datos.

Implementado en 9.1: `apps/api/src/document-export` define un puerto de renderizado, un adaptador PDF autocontenido y plantillas independientes para órdenes y facturas. Ambos documentos se generan bajo demanda exclusivamente desde snapshots históricos, con importes `USD`, campos reconocidos y marca visible de borrador; no consultan el catálogo, usuarios ni perfil vigente. El módulo permite sustituir el adaptador por almacenamiento de objetos o un worker sin cambiar el contrato interno. Los endpoints de descarga y su autorización están implementados desde 9.2.

Implementado en 9.2: `GET /api/v1/orders/:orderId/pdf` y `GET /api/v1/invoices/:invoiceId/pdf` descargan PDFs como adjuntos `application/pdf` después de autenticar al actor. `ADMIN` y `BILLING` pueden consultar cualquier documento; `CUSTOMER` solo el propio y una referencia ajena se responde como `404` sin contenido histórico. Los controladores cargan el snapshot mediante los servicios de consulta existentes y delegan el renderizado en `DocumentExportService`, sin consultar datos maestros.

Implementado en 9.3: las facturas `DRAFT` muestran una marca visible de borrador sin número definitivo. La regeneración de órdenes y facturas se prueba con los mismos snapshots antes y después de cambios simulados en productos, clientes o precios, garantizando una salida PDF idéntica y sin lectura del catálogo, usuarios o perfil vigente.

Implementado en 9.4: los detalles de órdenes y facturas de storefront y backoffice incluyen `Descargar PDF`. Las funciones REST solicitan la respuesta como `Blob`, validan el MIME `application/pdf`, sanitizan el nombre recibido con fallback por identificador y usan un botón accesible con estados de carga, éxito y error. `CUSTOMER` solo puede descargar desde sus vistas propias; `ADMIN` y `BILLING` usan las vistas administrativas protegidas por el API.

- `GET /api/v1/invoices`: implementado en 8.4; listado paginado y filtrado para los tres roles, forzando la propiedad del cliente.
- `POST /api/v1/invoices`: implementado en 8.3; crea un borrador manual para un cliente activo con líneas válidas, importes calculados por el servidor y cero impacto en orden, pago e inventario.
- `GET /api/v1/invoices/:invoiceId`: implementado en 8.4; detalle autorizado con líneas y snapshots históricos.
- `PATCH /api/v1/invoices/:invoiceId/status`: implementado en 8.4; transición de estado autorizada para `ADMIN` y `BILLING`.
- `GET /api/v1/invoices/:invoiceId/pdf`: descargar PDF autorizado.

## Store profile

- `GET /api/v1/store-profile`: consulta autorizada para `ADMIN` y `BILLING`.
- `PATCH /api/v1/store-profile`: modificación exclusiva de `ADMIN` con auditoría.
- `POST /api/v1/store-profile/logo`: carga validada por `ADMIN`; persiste el asset mediante el adaptador y su referencia `StoreLogoAsset`.
- `GET /api/v1/media/images/:storageKey`: entrega de imágenes conforme al contrato de medios.

El perfil contiene al menos nombre comercial, razón social, identificador fiscal, dirección física y referencia de logo. Su snapshot está implementado desde 15.4 para órdenes, facturas y PDF. La identidad visual pública del storefront debe obtenerse mediante una proyección pública o configuración que se defina explícitamente en OpenAPI; no expongas por defecto todos los datos fiscales. Los autocompletes usan `purpose=autocomplete`, `search` mínimo de tres caracteres, `page=1` y `pageSize` máximo 20; usuarios se limita a clientes activos y productos usa `view=public`. El backend vuelve a validar todos los identificadores seleccionados.

## Dashboard (implemented in 19.5–19.6)

- `GET /api/v1/dashboard/summary`: resumen agregado autorizado por rol.

La respuesta estricta se discrimina por `role` e incluye `updatedAt` y `metrics`. Para `ADMIN`, cuenta clientes `CUSTOMER` no eliminados (también inactivos/bloqueados), productos activos no eliminados, productos activos con hasta cinco unidades (también sin balance), órdenes `PROCESSING` y facturas `PENDING_PAYMENT`; incluye `lowStockThreshold: 5`. Para `BILLING`, cuenta órdenes `PROCESSING` sin factura distinta de `VOID`, el subconjunto elegible con pago registrado, facturas `PENDING_PAYMENT` sin límite de antigüedad y facturas actualmente `PAID` cuyo `paidAt` esté en los últimos 30 días. Incluye `period: { from, to, basis: "paidAt" }`, con extremos inclusivos y `to = updatedAt`, no configurable. Sin sesión responde 401; `CUSTOMER` recibe 403 sin métricas ni campos prohibidos. El contrato existe en OpenAPI, cliente generado y esquemas Zod.

`DashboardSummaryService` compone operaciones públicas de lectura de identidad, catálogo, inventario, órdenes y facturación sobre una sola transacción PostgreSQL `REPEATABLE READ`, `READ ONLY`. BILLING no invoca identidad, catálogo ni inventario. Los conteos se calculan en PostgreSQL sin descargar colecciones; la respuesta HTTP usa `Cache-Control: private, no-store`. El controlador no accede directamente a repositorios ajenos.

La UI `/` usa TanStack Query y Zod, claves de caché ligadas al actor/rol, estados de carga/error/reintento/cero y actualización manual. Los indicadores son informativos y enlazan a listas filtradas autoritativas; no autorizan mutaciones ni sustituyen la revalidación transaccional al facturar. Consulta `docs/dashboard-summary.md` y `docs/backoffice-dashboard.md` para criterios y verificación.

## Pagination contract

Todas las colecciones no acotadas responden con `items`, `page`, `pageSize`, `totalItems` y `totalPages` después de aplicar búsqueda, filtros autorizados y ordenamiento. Esto incluye usuarios, productos, categorías, etiquetas, wishlist, balances, movimientos, órdenes y facturas.

La UI muestra primera, anterior, hasta cuatro páginas a cada lado de la actual, siguiente, última y elipsis sin duplicar extremos. Nunca descargues todos los resultados para paginar o filtrar en memoria.

Antes de introducir o cambiar rutas, confirma si el contrato OpenAPI ya existe. Si una ruta difiere de OpenAPI o de las specs, actualiza el artefacto correcto en vez de crear contratos paralelos.

# Catalog and pagination behavior

El seed administra 20 SKU demo (18 activos: 3 destacados y 15 adicionales; 2 inactivos), 60 imágenes, cuatro categorías, dos etiquetas, inventario de apertura, cuentas `ADMIN`/`BILLING`/`CUSTOMER` y perfil ficticio. Configura laptops, monitores y teléfonos como categorías importantes con posiciones y fechas deterministas. Requiere `NODE_ENV=development|test`, `DATABASE_URL` no productiva y credenciales privadas; rechaza producción y no se ejecuta automáticamente. Conserva datos ajenos, IDs, perfil editado y stock consumido; restablece solo su selección editorial demo y aborta atómicamente ante posiciones ocupadas por categorías ajenas. Véanse `docs/development-catalog-seed.md` y `docs/development-user-seed.md`. La validación usa bases aisladas, no puebla la base local de demostración.

Cada producto implementado incluye ID, SKU, slug, nombre, descripción, precio y moneda fija `USD`, `image`, `coverImage`, categoría principal, etiquetas, fechas, estado y disponibilidad proyectada; el detalle incluye `images` ordenadas. Dashboard, cuatro temas, galería y landing editorial completa están implementados. Una futura multimoneda deberá configurarse globalmente mediante un cambio OpenSpec explícito, nunca por producto.

- El storefront solo muestra productos activos.
- Un producto agotado puede mostrarse, pero no agregarse al carrito.
- La búsqueda cubre nombre, descripción y SKU.
- El detalle público usa un slug único y estable; cambiar el nombre no regenera el slug automáticamente.
- Las categorías son administrables y los productos pueden asociar cero o más etiquetas.
- Los filtros y campos ordenables están permitidos explícitamente por el API.
- Búsqueda, filtros, orden y página viven en la URL.
- Cambiar cualquier criterio reinicia la página a 1.
- La paginación se calcula en el backend; no descargues todos los resultados para paginar en memoria.
- El catálogo usa filtros en sidebar izquierdo colapsable; el backoffice usa navegación izquierda y filtros derechos colapsables.
- Las búsquedas del backoffice aparecen sobre cada lista.
- Las mutaciones muestran mensajes flash y toda acción destructiva requiere confirmación modal accesible.
- La landing y el catálogo mantienen un look and feel comercial sin patrones visuales propios de administración.
- El backoffice abre en un dashboard minimalista con indicadores y accesos permitidos por rol.
- Todos los componentes, incluidos gráficos y estados interactivos, soportan las cuatro combinaciones visuales.
- El API de landing devuelve una única respuesta agregada: hasta 3 destacados por `featuredAt`, hasta 9 recientes por `createdAt` excluyendo destacados y hasta 3 categorías por `landingOrder`. La UI presenta las tres secciones en ese orden y admite configuración parcial o vacía; nunca reconstruye la selección desde consultas al catálogo completo.
- Cada categoría importante muestra hasta 3 productos activos recientes; puede repetir productos anteriores por su contexto editorial.
- Una categoría vacía o inactiva se omite sin modificar el orden persistido de las restantes.
- “Ver todos los productos” navega al catálogo completo, donde búsqueda, filtros, orden y página viven en la URL.
- Las tarjetas usan `coverImage`; el detalle usa una galería sin autoplay con lazy loading de imágenes no visibles.
- El seed incluye exactamente 20 productos, mínimo 3 imágenes por producto, categorías, etiquetas, precios y movimientos de inventario de apertura.
- Las imágenes seed pueden usar temporalmente IDs fijos de Lorem Picsum revisados visualmente solo en desarrollo y pruebas; conserva asociaciones deterministas y futuras claves de Cloudinary, y reemplaza los hotlinks por assets gestionados antes de producción.
- El seed incluye usuarios `ADMIN` y `CUSTOMER` no productivos, hashea contraseñas, no registra credenciales y rechaza producción.
- El seed marca 3 productos activos como destacados y 3 categorías activas como importantes con orden determinista; las pruebas de idempotencia verifican composición completa, conservación de datos ajenos y rechazo de producción.

# Transactional flows

## Approved checkout

Dentro de una transacción corta:

1. Reclamar o recuperar la clave de idempotencia.
2. Bloquear balances en un orden estable.
3. Revalidar productos activos, precios y cantidades.
4. Crear orden, líneas y pago aprobado.
5. Copiar el snapshot vigente del perfil empresarial en la orden.
6. Descontar inventario y crear movimientos vinculados a la orden.
7. Cerrar el carrito.
8. Guardar el resultado idempotente.

Si cualquier paso falla, revierte todo. No mantengas una transacción abierta esperando interacción del usuario o un proveedor externo.

## Invoice from order

En una sola transacción:

1. Verificar rol `ADMIN` o `BILLING`.
2. Verificar que la orden sea elegible y no tenga otra factura activa.
3. Crear la factura desde snapshots de la orden.
4. Reutilizar el snapshot empresarial histórico de la orden.
5. Establecer el estado de factura según el pago registrado.
6. Cambiar la orden a `INVOICED`.
7. No invocar ninguna operación de inventario.

## Manual invoice

- Selecciona un cliente y define líneas válidas.
- Usa autocomplete remoto paginado para clientes y productos y revalida los IDs en el API.
- Captura el perfil empresarial vigente como snapshot del emisor.
- Usa origen `MANUAL` y no referencia orden.
- No reserva, descuenta ni repone stock.
- Si se necesita vender físicamente desde back office, crea una orden administrativa mediante una capacidad explícita; no uses la factura para evadir inventario.

# Quality and verification

Todo cambio debe verificarse en proporción a su alcance:

- Lint y typecheck.
- Pruebas unitarias para permisos, cálculos y estados.
- Pruebas de integración con PostgreSQL para restricciones y transacciones.
- Pruebas concurrentes para stock.
- Pruebas de idempotencia de checkout y cancelación.
- Pruebas de contrato entre OpenAPI, API y cliente generado.
- Pruebas de componentes para formularios, catálogo, carrito y paginación.
- Pruebas de componentes y accesibilidad para shells, navbar, sidebars, drawers, mensajes, modales y autocomplete.
- Pruebas de contraste WCAG AA, teclado, foco, preferencia del sistema, persistencia, hidratación y regresión visual para las cuatro combinaciones.
- Pruebas de contrato y autorización para el dashboard, incluyendo ausencia de campos prohibidos y rechazo de `CUSTOMER`.
- Pruebas de integración, contrato, componentes y end-to-end para seed, portada, orden de imágenes, galería, landing y catálogo completo.
- Pruebas de permisos, límites, orden, estados vacíos, deduplicación y contrato para destacados, categorías importantes y `GET /catalog/landing`.
- Pruebas end-to-end para registro, compra, wishlist, administración, perfil empresarial, autocomplete y facturación.
- Pruebas negativas para elevación de rol y acceso a recursos ajenos.
- Builds de producción independientes.

Al implementar el cambio activo:

- Sigue `tasks.md` en orden de dependencias.
- El plan contiene 145 tareas distribuidas en 21 grupos; las tareas 12 a 21 incorporan layouts, catálogo ampliado, temas, dashboard, seed, imágenes y composición editorial.
- Marca una tarea como completada solo después de verificarla.
- No marques bloques completos por inferencia.
- Ejecuta `openspec validate build-technology-ecommerce-platform --strict` antes de considerar completa la implementación.
- No archives el cambio mientras queden tareas o escenarios sin cumplir.
- La fase 19 entrega: 19.1 tokens, 19.2 runtime de temas, 19.3 storefront, 19.4 backoffice, 19.5 resumen REST, 19.6 dashboard, 19.7 cobertura de componentes, 19.8 contraste/regresión y 19.9 documentación. No marques tareas de 20–21 por reutilizar estos componentes.

# Available skills

- `openspec-explore`: Analiza ideas, decisiones, problemas o requisitos sin implementar. Fuente: `.agents/skills/openspec-explore/SKILL.md`.
- `openspec-propose`: Crea un nuevo cambio con propuesta, specs, diseño y tareas. Fuente: `.agents/skills/openspec-propose/SKILL.md`.
- `openspec-update-change`: Revisa artefactos de planificación existentes sin editar código. Fuente: `.agents/skills/openspec-update-change/SKILL.md`.
- `openspec-apply-change`: Implementa o continúa las tareas de un cambio OpenSpec. Fuente: `.agents/skills/openspec-apply-change/SKILL.md`.
- `openspec-sync-specs`: Sincroniza specs delta con las specs principales sin archivar el cambio. Fuente: `.agents/skills/openspec-sync-specs/SKILL.md`.
- `openspec-archive-change`: Archiva un cambio después de que su implementación esté completa y validada. Fuente: `.agents/skills/openspec-archive-change/SKILL.md`.
- `react-rules`: Aplica las convenciones React, Next.js, TypeScript, Tailwind, Zustand, Zod, React Hook Form y REST del proyecto. Fuente: `.agents/skills/react-rules/SKILL.md`.
- `frontend-design`: Dirige el diseño visual intencional de interfaces, incluyendo HTML/JSX, CSS/Tailwind, UI/UX, look and feel, paletas, tipografía, composición, responsive, movimiento y revisión crítica para evitar resultados genéricos. Fuente: `.agents/skills/frontend-design/SKILL.md`.

# Skill trigger rules

- Antes de usar un skill, lee completamente su `SKILL.md` y sigue sus límites.
- Usa `openspec-explore` cuando el usuario quiera analizar o aclarar antes de planificar o implementar. En explore no escribas código.
- Usa `openspec-propose` cuando el usuario pida crear una propuesta nueva y todos sus artefactos. En propose crea planificación, no implementación.
- Usa `openspec-update-change` cuando el usuario cambie decisiones, alcance, arquitectura o requisitos del cambio existente. No edites código con este skill.
- Usa `openspec-apply-change` cuando el usuario pida comenzar, continuar o completar la implementación del cambio `build-technology-ecommerce-platform`.
- Usa `react-rules` junto con `openspec-apply-change` cuando una tarea implemente o modifique aplicaciones, componentes, hooks, estado, formularios o UI React/Next.js.
- Usa `frontend-design` cuando una solicitud cree o reformule HTML/JSX, CSS o Tailwind, layouts, componentes visuales, temas, tokens, tipografía, paletas, motion, responsive, accesibilidad visual, UI/UX o el look and feel de storefront o backoffice.
- Combina `frontend-design`, `react-rules` y `openspec-apply-change` cuando una tarea OpenSpec implemente o modifique la presentación visual React/Next.js. Para cambios React exclusivamente lógicos y sin impacto visual, aplica `react-rules` sin forzar `frontend-design`.
- Usa `openspec-sync-specs` solo cuando el usuario pida llevar deltas aprobados a las specs principales sin archivar.
- Usa `openspec-archive-change` solo después de completar y verificar implementación, tareas y especificaciones.
- No combines explore o propose con implementación en el mismo turno.
- Si el usuario solicita un cambio funcional durante apply que contradice los artefactos, detén esa parte y usa primero `openspec-update-change` cuando el usuario autorice actualizar la planificación.

# Working rules for agents

- Preserva cambios existentes del usuario y revisa `git status` antes de editar.
- Prefiere `rg` y `rg --files` para búsquedas.
- Usa `apply_patch` para editar archivos manualmente.
- No modifiques archivos no relacionados con la tarea actual.
- No introduzcas funcionalidades fuera del alcance sin autorización.
- Mantén secretos fuera del repositorio, logs, fixtures y respuestas.
- Actualiza OpenAPI, cliente generado, pruebas y documentación cuando cambie un contrato REST.
- Actualiza specs y diseño cuando cambien comportamientos o decisiones, usando el workflow OpenSpec correspondiente.
- Trata `README.md` como resumen y mantenlo alineado cuando haya cambios sustanciales de alcance o arquitectura.
