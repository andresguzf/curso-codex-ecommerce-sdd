# Project context

Este repositorio contiene la planificación y futura implementación de una plataforma e-commerce para productos tecnológicos.

Estado actual al redactar estas instrucciones:

- La planificación OpenSpec está completa.
- El cambio activo es `build-technology-ecommerce-platform`.
- Existen propuesta, diseño, siete especificaciones y 135 tareas verificables.
- Todavía no existe una implementación funcional de las aplicaciones.
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

La solución ofrecerá:

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

La arquitectura planificada es un monorepo con aplicaciones desplegables de forma independiente:

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

## Planned repository structure

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
  database/         PostgreSQL, migraciones y entorno local
  docker/           Imágenes y composición de servicios
  deployment/       Configuración de despliegue
```

No fuerces esta estructura si ya existe una implementación equivalente. Conserva las convenciones reales del repositorio y mantén los límites arquitectónicos.

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

## Planned UI shells

```text
StorefrontShell
  Header/Navbar: logo SVG, tienda, inicio, cuenta, login/logout, badge del carrito
  Hero: fondo tecnológico semitransparente y búsqueda
  Main: catálogo con sidebar izquierdo de filtros
  Footer

BackofficeShell
  Sidebar izquierdo: navegación por rol
  Header contextual
  Main: búsqueda superior, tabla o lista paginada
  Sidebar derecho: filtros
```

- Comparte primitivas visuales mediante `packages/ui`, pero conserva shells independientes por aplicación.
- En pantallas pequeñas, transforma los sidebars en drawers accesibles.
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

# Technology conventions

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
- Usa importes decimales de precisión fija y código de moneda; nunca `float` para dinero.
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

# Roles and authorization

El sistema reconoce exactamente:

- `CUSTOMER`: navega, administra wishlist y carrito, compra y consulta únicamente sus compras, facturas y documentos.
- `ADMIN`: administra usuarios, productos, categorías, etiquetas, perfil empresarial, inventario, órdenes y facturas.
- `BILLING`: consulta clientes, productos autorizados, perfil empresarial y órdenes, crea facturas manuales o desde órdenes y gestiona estados de facturación; no administra usuarios, catálogo, perfil empresarial ni inventario.

Reglas obligatorias:

- El registro público siempre crea `CUSTOMER` desde el backend.
- Solo `ADMIN` asigna o modifica roles.
- No se puede desactivar al último administrador activo.
- `BILLING` no puede cancelar ni completar órdenes fuera del flujo de facturación.
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

El contrato OpenAPI base está implementado en `apps/api/openapi/openapi.json`, se sirve en `/api/v1/openapi.json` y expone Swagger UI en `/api/v1/docs`. `packages/api-client` se genera desde ese archivo y `packages/api-schemas` valida respuestas HTTP con Zod. Por ahora solo el health check está implementado; el resto de este mapa continúa planificado. Mantén `/api/v1`, nombres REST coherentes, validación, autorización, paginación y errores uniformes, y ejecuta `pnpm openapi:generate` seguido de `pnpm openapi:check` al cambiar el contrato.

## Health

- `GET /api/v1/health`: salud y readiness del API.

## Authentication

- `POST /api/v1/auth/register`: registro público como `CUSTOMER`.
- `POST /api/v1/auth/login`: autenticación.
- `POST /api/v1/auth/refresh`: renovación protegida de sesión.
- `POST /api/v1/auth/logout`: revocación de sesión.
- `GET /api/v1/auth/me`: identidad y rol actuales.

## User administration

- `GET /api/v1/users`: listado administrativo paginado; también alimenta autocomplete autorizado de clientes con `search` y `pageSize` limitado.
- `POST /api/v1/users`: creación por `ADMIN`.
- `GET /api/v1/users/:userId`: detalle autorizado.
- `PATCH /api/v1/users/:userId`: datos, rol o estado según permisos.
- `DELETE /api/v1/users/:userId`: eliminación lógica o desactivación, nunca destrucción de historial.

## Products and catalog

- `GET /api/v1/catalog/landing`: composición pública agregada de destacados, recientes y categorías importantes.
- `GET /api/v1/products`: catálogo, listado administrativo o autocomplete autorizado con `page`, `pageSize`, `search`, categoría, etiquetas, disponibilidad, precio, filtros y orden.
- `POST /api/v1/products`: creación por `ADMIN`.
- `GET /api/v1/products/:productId`: detalle autorizado.
- `PATCH /api/v1/products/:productId`: edición por `ADMIN`.
- `DELETE /api/v1/products/:productId`: eliminación lógica por `ADMIN`.
- `PATCH /api/v1/products/:productId/status`: activar o desactivar.
- `POST /api/v1/products/:productId/images`: agregar una imagen mediante el adaptador de almacenamiento.
- `PATCH /api/v1/products/:productId/images/:imageId`: editar texto alternativo, orden o portada.
- `DELETE /api/v1/products/:productId/images/:imageId`: eliminar una imagen sin dejar un producto activo sin portada.

Los listados devuelven `coverImage`; el detalle devuelve `images` ordenadas. El detalle público deberá resolverse también mediante slug conforme al contrato OpenAPI definitivo; no inventes una ruta paralela antes de definirla en OpenAPI y specs.

`PATCH /products/:productId` administra `isFeatured` y actualiza `featuredAt` únicamente al destacar. `PATCH /categories/:categoryId` administra `showOnLanding` y `landingOrder`; rechaza una cuarta categoría importante. Ambos requieren `ADMIN` y auditoría.

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

- `GET /api/v1/cart`: carrito activo del cliente.
- `POST /api/v1/cart/items`: agregar producto.
- `PATCH /api/v1/cart/items/:itemId`: cambiar cantidad.
- `DELETE /api/v1/cart/items/:itemId`: eliminar línea.
- `POST /api/v1/checkout`: validar, simular pago/envío y confirmar compra; requiere `Idempotency-Key`.

## Orders

- `GET /api/v1/orders`: listado administrativo para `ADMIN` y `BILLING` con permisos diferentes.
- `GET /api/v1/orders/mine`: historial del cliente autenticado.
- `GET /api/v1/orders/:orderId`: detalle con comprobación de propiedad o rol.
- `PATCH /api/v1/orders/:orderId/status`: transición administrativa permitida.
- `POST /api/v1/orders/:orderId/cancel`: cancelación con motivo e inventario compensatorio.
- `POST /api/v1/orders/:orderId/invoice`: generar factura desde una orden elegible.
- `GET /api/v1/orders/:orderId/pdf`: descargar PDF autorizado.

## Invoices

- `GET /api/v1/invoices`: listado paginado y filtrado.
- `POST /api/v1/invoices`: factura manual sin impacto en inventario.
- `GET /api/v1/invoices/:invoiceId`: detalle autorizado.
- `PATCH /api/v1/invoices/:invoiceId/status`: transición de estado autorizada.
- `GET /api/v1/invoices/:invoiceId/pdf`: descargar PDF autorizado.

## Store profile

- `GET /api/v1/store-profile`: consulta autorizada para `ADMIN` y `BILLING`.
- `PATCH /api/v1/store-profile`: modificación exclusiva de `ADMIN` con auditoría.

El perfil contiene al menos nombre comercial, razón social, identificador fiscal, dirección física y referencia de logo. La identidad visual pública del storefront debe obtenerse mediante una proyección pública o configuración que se defina explícitamente en OpenAPI; no expongas por defecto todos los datos fiscales. Las facturas manuales reutilizan `GET /users` y `GET /products` para autocomplete remoto paginado; el backend vuelve a validar todos los identificadores seleccionados.

## Dashboard

- `GET /api/v1/dashboard/summary`: resumen agregado autorizado por rol.

Para `ADMIN`, devuelve clientes totales, productos activos, stock bajo o agotado, órdenes `PROCESSING` y facturas `PENDING_PAYMENT`. Para `BILLING`, devuelve órdenes elegibles o pendientes de facturar y facturas `PENDING_PAYMENT` o `PAID` según el período resumido. Incluye período o fecha de actualización, rechaza `CUSTOMER` y nunca devuelve campos de módulos no autorizados.

El controlador del dashboard no accede directamente a repositorios ajenos; compone operaciones públicas de lectura de identidad, catálogo, inventario, órdenes y facturación. Los indicadores son informativos y deben enlazar a listas filtradas autoritativas.

## Pagination contract

Todas las colecciones no acotadas responden con `items`, `page`, `pageSize`, `totalItems` y `totalPages` después de aplicar búsqueda, filtros autorizados y ordenamiento. Esto incluye usuarios, productos, categorías, etiquetas, wishlist, balances, movimientos, órdenes y facturas.

La UI muestra primera, anterior, hasta cuatro páginas a cada lado de la actual, siguiente, última y elipsis sin duplicar extremos. Nunca descargues todos los resultados para paginar o filtrar en memoria.

Antes de introducir o cambiar rutas, confirma si el contrato OpenAPI ya existe. Si una ruta difiere de OpenAPI o de las specs, actualiza el artefacto correcto en vez de crear contratos paralelos.

# Catalog and pagination behavior

Cada producto incluye al menos ID, SKU, slug, nombre, descripción, precio, moneda, portada, galería ordenada, categoría principal, etiquetas, fechas, estado y disponibilidad proyectada.

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
- La landing consume una única respuesta agregada: hasta 3 destacados por `featuredAt`, hasta 9 recientes por `createdAt` excluyendo destacados y entre 2 y 3 categorías por `landingOrder`.
- Cada categoría importante muestra hasta 3 productos activos recientes; puede repetir productos anteriores por su contexto editorial.
- Una categoría vacía o inactiva se omite sin modificar el orden persistido de las restantes.
- “Ver todos los productos” navega al catálogo completo, donde búsqueda, filtros, orden y página viven en la URL.
- Las tarjetas usan `coverImage`; el detalle usa una galería sin autoplay con lazy loading de imágenes no visibles.
- El seed incluye exactamente 20 productos, mínimo 3 imágenes por producto, categorías, etiquetas, precios y movimientos de inventario de apertura.
- Las imágenes seed pueden usar temporalmente IDs fijos de Lorem Picsum revisados visualmente solo en desarrollo y pruebas; conserva asociaciones deterministas y futuras claves de Cloudinary, y reemplaza los hotlinks por assets gestionados antes de producción.
- El seed incluye usuarios `ADMIN` y `CUSTOMER` no productivos, hashea contraseñas, no registra credenciales y rechaza producción.
- El seed marca 3 productos activos como destacados y 3 categorías activas como importantes con orden determinista.

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
- El plan contiene 135 tareas distribuidas en 21 grupos; las tareas 12 a 21 incorporan layouts, catálogo ampliado, temas, dashboard, seed, imágenes y composición editorial.
- Marca una tarea como completada solo después de verificarla.
- No marques bloques completos por inferencia.
- Ejecuta `openspec validate build-technology-ecommerce-platform --strict` antes de considerar completa la implementación.
- No archives el cambio mientras queden tareas o escenarios sin cumplir.

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
