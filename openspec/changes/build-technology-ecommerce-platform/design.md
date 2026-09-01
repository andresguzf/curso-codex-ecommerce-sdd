## Context

El repositorio es un proyecto nuevo con OpenSpec pero sin aplicaciones ni modelo de datos existentes. La solución debe desplegar frontend y backend de forma independiente dentro de un monorepo, usar Next.js con TypeScript para las interfaces, exponer toda lógica de negocio y acceso a datos mediante API REST y usar PostgreSQL como autoridad transaccional. Véase `proposal.md` para la motivación y `specs/` para los contratos observables.

El sistema tendrá un storefront y un back office, tres roles (`CUSTOMER`, `ADMIN`, `BILLING`), productos simples sin variantes y pagos y envíos simulados. Órdenes, pagos y facturas son agregados independientes; las operaciones de facturación nunca modifican inventario.

## Goals / Non-Goals

**Goals:**

- Mantener límites comprobables entre interfaces, API, módulos de negocio y persistencia.
- Garantizar consistencia transaccional entre checkout, orden e inventario y evitar stock negativo bajo concurrencia.
- Ofrecer contratos REST versionados que puedan consumir tanto Server Components como Client Components sin acceso directo a datos.
- Mantener trazabilidad histórica mediante snapshots, movimientos de inventario, estados explícitos y auditoría.
- Permitir que la primera implementación crezca por módulos sin asumir microservicios ni transacciones distribuidas.

**Non-Goals:**

- Integrar proveedores reales de pago, despacho, correo o facturación tributaria.
- Soportar variantes de producto, múltiples almacenes, promociones, cupones o múltiples listas de precios.
- Hacer que una factura manual represente una salida de inventario; una venta física administrativa deberá originarse como orden.
- Usar Server Actions, Route Handlers de Next.js como backend de negocio, acceso frontend a PostgreSQL o compartir entidades de persistencia con el frontend.
- Dividir el backend en microservicios durante esta entrega.

## Decisions

### 1. Monorepo con aplicaciones desplegables por separado

Se usará pnpm workspaces y Turborepo con esta organización base:

```text
apps/
  storefront/       Next.js para catálogo, carrito, checkout y cuenta
  backoffice/       Next.js para administración y facturación
  api/              Backend REST modular
packages/
  api-client/       Cliente TypeScript generado desde OpenAPI
  api-schemas/      Esquemas Zod de fronteras HTTP
  ui/               Componentes presentacionales compartidos
  config-*/         TypeScript, ESLint y Tailwind compartidos
infra/              PostgreSQL local, contenedores y despliegue
```

Cada aplicación tendrá su propio artefacto de construcción y configuración. `storefront` y `backoffice` podrán depender de `api-client`, `api-schemas` y `ui`, pero no del código de dominio, ORM o base de datos del API.

Alternativa considerada: una única aplicación Next.js con rutas públicas y administrativas. Se descarta porque los públicos, permisos y ciclos de despliegue son distintos; compartir `packages/ui` mantiene la reutilización sin fusionar las fronteras.

### 2. Backend independiente como monolito modular

`apps/api` se implementará con NestJS sobre un adaptador HTTP de alto rendimiento y módulos de identidad, catálogo, carrito, checkout, órdenes, inventario, facturación, documentos y auditoría. PostgreSQL se accederá exclusivamente desde el backend mediante un ORM con migraciones y soporte de transacciones, usando SQL explícito cuando el control de concurrencia lo requiera.

Los módulos publicarán operaciones internas bien definidas; ningún controlador accederá directamente a repositorios de otro módulo. Checkout actuará como coordinador de catálogo, carrito, pagos simulados, órdenes e inventario.

Alternativa considerada: microservicios por dominio. Se descarta inicialmente porque el checkout requiere consistencia fuerte y el costo de eventos distribuidos, reintentos y compensaciones no aporta valor al alcance actual.

### 3. Contrato REST y errores uniformes

El API se versionará bajo `/api/v1`, publicará OpenAPI y generará `packages/api-client`. Las respuestas no confiables se validarán en el frontend con Zod. Los errores usarán una estructura uniforme con código estable, mensaje seguro, detalles de campos y correlation ID.

Las listas numeradas usarán paginación por página y tamaño, no cursor, porque deben conocer `totalItems`, `totalPages`, primera y última página. La búsqueda, filtros, orden y página viajarán como query parameters. El servidor mantendrá una lista explícita de campos ordenables para evitar consultas arbitrarias.

Alternativa considerada: compartir DTO y entidades TypeScript directamente. Se descarta para preservar la independencia del backend y evitar que detalles internos se conviertan accidentalmente en contrato público.

### 4. Next.js consume exclusivamente REST

Las aplicaciones usarán App Router. Los Server Components podrán consultar endpoints REST de lectura para renderizado inicial y SEO; los Client Components usarán el mismo cliente REST para interacción. No habrá Server Actions ni Route Handlers que ejecuten lógica de negocio o accedan a la base de datos.

El frontend seguirá estas responsabilidades:

- TanStack Query para estado remoto, caché, mutaciones e invalidación.
- Zustand con `create()` solo para estado global del cliente que no duplique datos autoritativos del servidor.
- React Hook Form con `zodResolver` para formularios y Zod para entradas y respuestas HTTP.
- Tailwind para estilos y componentes pequeños organizados por funcionalidad.
- React estable `19.2.8` o posterior disponible al implementar, manteniendo `react-dom` alineado y evitando canales experimentales.

Los criterios de búsqueda, filtro, orden y paginación vivirán en la URL. El control paginado renderizará una ventana de cuatro páginas a cada lado de la actual, con extremos y elipsis sin duplicados.

### 5. Sesión y autorización en el API

El API será propietario de registro, login, renovación y logout. Las contraseñas se almacenarán únicamente como hashes resistentes y las sesiones usarán credenciales de corta duración con renovación protegida. Los secretos persistentes del navegador se transportarán mediante cookies `HttpOnly`, `Secure` y una política `SameSite` acorde al despliegue; CORS, CSRF y orígenes permitidos se configurarán explícitamente.

Cada endpoint protegido aplicará guards de rol y comprobaciones de propiedad. El registro público asignará `CUSTOMER` del lado servidor. Solo `ADMIN` podrá crear o cambiar roles, y una restricción de dominio impedirá desactivar al último administrador activo.

Alternativa considerada: confiar en protección de rutas del frontend. Se descarta porque el navegador no es una frontera de seguridad.

### 6. Modelo relacional y datos históricos

El modelo PostgreSQL incluirá, como mínimo:

```text
User, Session, RoleAssignment
Product, ProductImage
InventoryBalance, InventoryMovement
Cart, CartItem
Order, OrderItem, Payment
Invoice, InvoiceLine
AuditEntry, IdempotencyRecord
```

Los importes se guardarán como valores decimales de precisión fija junto con código de moneda. Fechas usarán zona horaria. Productos y usuarios se desactivarán o eliminarán lógicamente para conservar referencias.

`OrderItem` y `InvoiceLine` almacenarán snapshots de nombres, SKU, cantidades, precios, impuestos y moneda. La orden también conservará snapshots de cliente, dirección, envío y pago relevantes. Las modificaciones posteriores de datos maestros no reescribirán documentos históricos.

### 7. Producto simple con inventario separado

La primera versión tendrá un SKU por producto y un único balance de inventario. El API podrá proyectar `stockAvailable` junto al producto, pero el stock no será una columna editable mediante el CRUD comercial. Los cambios se ejecutarán como movimientos de inventario con cantidad, motivo, referencia y autor.

Las imágenes se almacenarán fuera de PostgreSQL; la base conservará la clave, URL y metadatos. En desarrollo podrá usarse almacenamiento local compatible con el adaptador y en despliegue un servicio de objetos.

Alternativa considerada: guardar la cantidad directamente en `Product`. Se descarta porque impide explicar ajustes, ventas y cancelaciones y facilita sobrescrituras no auditadas.

### 8. Checkout transaccional e idempotente

El pago simulado se resolverá sin llamadas externas. Para un resultado aprobado, una transacción PostgreSQL realizará:

1. Reclamar o recuperar la clave de idempotencia.
2. Bloquear balances de inventario en un orden estable por identificador.
3. Revalidar productos activos, precios y cantidades.
4. Crear orden, líneas y pago aprobado.
5. Descontar balances y registrar movimientos de salida vinculados a la orden.
6. Cerrar el carrito y guardar el resultado idempotente.

Si el pago simulado es rechazado no se confirmará la orden ni se modificará inventario. Errores de concurrencia o deadlocks recuperables tendrán reintentos limitados en la capa de aplicación; una disponibilidad insuficiente se devolverá como conflicto de negocio.

Alternativa considerada: reservar stock al agregar al carrito. Se descarta para el MVP porque permitiría que carritos abandonados bloqueen ventas y requeriría expiraciones. Si posteriormente se incorporan pagos pendientes reales, se añadirá una reserva con vencimiento como cambio separado.

### 9. Estados independientes y facturación sin stock

Las máquinas de estado iniciales serán:

```text
Order:   PROCESSING --> INVOICED --> COMPLETED
              |             |
              +-----------> CANCELLED, cuando la transición sea elegible

Payment: PENDING --> APPROVED | REJECTED

Invoice: DRAFT --> PENDING_PAYMENT --> PAID
             |             |
             +-----------> VOID, cuando la transición sea elegible
```

Facturar desde una orden creará la factura y cambiará la orden a `INVOICED` en una sola transacción, protegido por una restricción que impida dos facturas activas para la misma orden. El estado inicial de la factura reflejará el pago registrado sin modificarlo.

Una factura manual tendrá origen `MANUAL`, cliente y líneas propias, no requerirá orden y nunca invocará inventario. Facturar, pagar, anular o exportar tampoco generará movimientos de stock. Cancelar una orden que consumió inventario creará movimientos compensatorios idempotentes.

### 10. Documentos PDF desde snapshots

El backend generará PDFs de órdenes y facturas desde sus snapshots y comprobará propiedad o rol antes de entregar el archivo. Los borradores se marcarán visiblemente y las facturas emitidas recibirán un número único dentro de una transacción.

La primera versión generará el documento bajo demanda mediante un adaptador de renderizado. Si el costo o volumen lo exige, el mismo adaptador permitirá persistir archivos en almacenamiento de objetos y generarlos mediante un worker sin cambiar el contrato REST.

### 11. Auditoría, observabilidad y pruebas

Las operaciones sensibles crearán entradas de auditoría con actor, acción, entidad, referencia, fecha y cambios relevantes sin almacenar secretos. El API propagará correlation IDs y emitirá logs estructurados y métricas para autenticación, checkout, stock, órdenes y facturación.

La estrategia de pruebas incluirá:

- Unitarias para permisos, cálculos y máquinas de estado.
- Integración con PostgreSQL para transacciones, idempotencia y bloqueos concurrentes.
- Contrato para OpenAPI y cliente generado.
- Componentes para formularios, catálogo, carrito y paginación.
- End-to-end para registro, compra, administración, facturación y autorización negativa.

### 12. Shells reutilizables y navegación responsive

`packages/ui` expondrá primitivas presentacionales reutilizables y cada aplicación compondrá un shell propio para no mezclar permisos ni navegación:

- `StorefrontShell`: header con navbar superior, logo SVG, nombre de la tienda, inicio, cuenta, login/logout según sesión y carrito con badge de unidades; área principal y footer.
- `BackofficeShell`: navegación lateral izquierda colapsable según rol, header contextual, área principal y slots para búsqueda y filtros.
- `CatalogFilterSidebar`: panel izquierdo colapsable en escritorio y drawer accesible en pantallas pequeñas.
- `BackofficeFilterSidebar`: panel derecho colapsable para evitar competir con la navegación administrativa izquierda; se convertirá en drawer en pantallas pequeñas.

El estado persistible de búsqueda, filtros, orden y página residirá en la URL. El estado puramente visual de apertura de paneles podrá vivir localmente o en un store Zustand pequeño cuando deba compartirse entre componentes. Los shells mantendrán regiones semánticas, foco visible, navegación por teclado y nombres accesibles.

Alternativa considerada: un único shell compartido entre storefront y backoffice. Se descarta porque las jerarquías, permisos y comportamiento responsive son distintos; se comparten primitivas, no la estructura completa.

### 13. Mensajes flash y confirmación destructiva centralizados

Las aplicaciones usarán un sistema compartido de mensajes flash o toast con variantes de éxito, error, advertencia e información, región `aria-live` y contenido breve. Las mutaciones de TanStack Query emitirán feedback desde sus callbacks o desde los event handlers que originan la acción; no se observarán cambios de estado mediante `useEffect` para inferir mensajes.

Toda eliminación lógica, desactivación o eliminación de una línea del carrito abrirá primero un diálogo modal reutilizable construido con Tailwind y primitivas accesibles. El diálogo administrará foco inicial y retorno, cierre con teclado, bloqueo de interacción de fondo y estado pendiente para evitar envíos duplicados.

Alternativa considerada: incorporar SweetAlert2. Se pospone para evitar una dependencia y un lenguaje visual adicionales; podrá evaluarse si el diálogo propio no satisface accesibilidad o mantenimiento.

### 14. Catálogo extendido, slugs y lista de deseos

El modelo relacional añadirá:

```text
Category(id, name, slug, description, status, createdAt, updatedAt, deletedAt)
Tag(id, name, slug, status, createdAt, updatedAt, deletedAt)
Product.categoryId
Product.slug
ProductTag(productId, tagId)
Wishlist(id, customerId, createdAt, updatedAt)
WishlistItem(wishlistId, productId, createdAt)
```

Cada producto tendrá una categoría principal opcional durante una migración inicial y obligatoria antes de activar nuevos productos; podrá tener múltiples etiquetas. Los slugs serán únicos mediante restricciones de base de datos, se normalizarán en el API y tendrán resolución determinista de colisiones. Cambiar un nombre no cambiará automáticamente un slug publicado; cualquier edición explícita deberá verificar unicidad.

Categorías y etiquetas con referencias se desactivarán o eliminarán lógicamente. La relación de wishlist tendrá unicidad por cliente y producto, no reservará stock y conservará productos que pasen a inactivos o agotados para mostrarlos como no disponibles.

Alternativa considerada: guardar categorías y etiquetas como texto o arrays dentro de `Product`. Se descarta porque impide administración consistente, integridad referencial, filtros eficientes y slugs únicos.

### 15. Perfil único de tienda y snapshots empresariales

Se añadirá un agregado `StoreProfile` único con nombre comercial, razón social, identificador fiscal, dirección física estructurada, datos de contacto opcionales y referencia al logo. Solo `ADMIN` podrá modificarlo; `ADMIN` y `BILLING` podrán consultarlo dentro de sus flujos autorizados.

Al confirmar una orden se copiará un `issuerSnapshot` del perfil vigente. Una factura derivada de orden tomará el snapshot de la orden; una factura manual tomará el perfil vigente al crearse o emitirse según su estado. Los PDFs leerán únicamente el snapshot del documento. De este modo, editar la empresa no reescribe órdenes, facturas ni PDFs históricos.

Alternativa considerada: consultar siempre el perfil vigente al renderizar. Se descarta porque produciría documentos históricos distintos después de una modificación empresarial.

### 16. Consultas paginadas y autocomplete remoto

Toda colección potencialmente no acotada se resolverá en el backend y devolverá la forma común:

```text
items, page, pageSize, totalItems, totalPages
```

Esto incluye usuarios, productos, categorías, etiquetas, wishlist, balances y movimientos, órdenes y facturas. El API aplicará búsqueda, filtros autorizados y orden antes de contar y paginar. Las interfaces colocarán la búsqueda sobre la lista; el storefront usará filtros a la izquierda y el backoffice filtros a la derecha. Cualquier cambio de criterios reiniciará `page=1`.

Los selectores de cliente y producto para factura manual reutilizarán consultas REST paginadas con un tamaño reducido. Un custom hook controlará término, espera breve, cancelación de solicitudes obsoletas, caché y estados de carga; el formulario guardará el identificador seleccionado, no el texto visible. Los resultados serán navegables por teclado y el API revalidará toda selección al guardar.

Alternativa considerada: descargar clientes y productos completos para filtrar en memoria. Se descarta por exposición innecesaria, consumo creciente y resultados desactualizados.

### 17. Extensiones del contrato REST

OpenAPI incorporará, además de los endpoints ya planificados, las siguientes rutas bajo `/api/v1`:

```text
GET    /categories
POST   /categories
GET    /categories/:categoryId
PATCH  /categories/:categoryId
DELETE /categories/:categoryId

GET    /tags
POST   /tags
GET    /tags/:tagId
PATCH  /tags/:tagId
DELETE /tags/:tagId

GET    /wishlist
POST   /wishlist/items
DELETE /wishlist/items/:productId

GET    /store-profile
PATCH  /store-profile
```

Los endpoints existentes `GET /products` y `GET /users` admitirán consultas limitadas para autocomplete mediante `search`, `page`, `pageSize` y filtros autorizados; no se crearán endpoints que devuelvan catálogos o clientes completos. `GET /products` añadirá filtros por categoría, etiquetas, disponibilidad y rango de precio, y el detalle público podrá resolverse por slug sin eliminar el acceso administrativo por identificador. Todas las rutas conservarán validación Zod en la frontera frontend, validación autoritativa en NestJS, autorización, errores uniformes y cliente generado.

Alternativa considerada: exponer el autocomplete mediante rutas especiales sin paginación. Se descarta porque duplicaría reglas de consulta y contratos.

### 18. Sistemas visuales independientes y temas por aplicación

`packages/ui` compartirá primitivas sin apariencia cerrada, comportamiento accesible y contratos de composición, pero no impondrá una identidad visual única. Cada aplicación definirá su propio conjunto de tokens semánticos para superficie, texto, borde, acento, estados, elevación, radio, espaciado y densidad:

- El storefront usará una identidad comercial tecnológica, mayor protagonismo de imágenes, tarjetas de producto amplias, espacios más generosos, acentos de marca y jerarquías orientadas a descubrir, comparar y comprar.
- El back office usará una identidad empresarial diferenciada, paleta neutral basada en slate, navy y azul, densidad operativa mayor, tablas compactas, tarjetas KPI, navegación sobria y colores semánticos para estados.

Tailwind consumirá variables CSS separadas por aplicación y tema bajo un atributo `data-theme="light|dark"`. No se copiará una única paleta invirtiendo colores: cada combinación storefront-claro, storefront-oscuro, backoffice-claro y backoffice-oscuro tendrá tokens propios y contrastes verificados.

La primera visita tomará `prefers-color-scheme`. Después de una selección explícita, cada aplicación persistirá su preferencia con una clave local independiente. Un bootstrap temprano aplicará el atributo antes de la primera presentación visible para evitar parpadeo del tema contrario; un store Zustand pequeño expondrá el estado visual y la acción de alternar sin introducir Server Actions ni persistencia de negocio. El control mostrará nombre accesible, estado actual y soporte de teclado.

Las pruebas cubrirán contraste WCAG AA, foco, hover, active, disabled, error, success, warning, gráficos, tablas, formularios, modales, mensajes, sidebars y drawers. El color nunca será el único medio para comunicar estado.

Alternativa considerada: compartir un único tema y cambiar solo el logo. Se descarta porque no cumple la separación de experiencias solicitada. También se descarta persistir el tema en PostgreSQL para la primera versión porque es una preferencia visual local que no necesita coordinación transaccional ni una API adicional.

### 19. Dashboard administrativo agregado y autorizado

El back office tendrá una ruta inicial de dashboard dentro de su shell. Sus tarjetas y accesos se compondrán por rol:

```text
ADMIN
  clientes totales
  productos activos
  productos con stock bajo o agotado
  órdenes PROCESSING
  facturas PENDING_PAYMENT

BILLING
  órdenes PROCESSING elegibles para facturación
  órdenes pendientes de facturar
  facturas PENDING_PAYMENT
  facturas PAID en el período resumido
```

El API expondrá `GET /api/v1/dashboard/summary`. Un servicio de lectura agregado consultará proyecciones de identidad, catálogo, inventario, órdenes y facturación mediante las operaciones públicas de cada módulo, sin acceder desde el controlador a repositorios ajenos. El contrato devolverá únicamente métricas autorizadas al rol y metadatos del período o criterio usado; `CUSTOMER` no podrá invocarlo.

Los indicadores son informativos y enlazan a listas filtradas que continúan siendo la fuente operativa. No permiten mutaciones directas ni sustituyen los controles de permisos de cada módulo. Se podrán cachear por un período breve si el volumen lo exige, dejando visible la fecha de actualización y evitando presentar el resumen como balance transaccional en tiempo real.

Alternativa considerada: realizar una solicitud frontend independiente por cada tarjeta. Se descarta porque duplica reglas, aumenta latencia y puede producir un dashboard formado por conteos tomados en momentos diferentes. También se descarta incorporar analítica histórica avanzada, gráficos configurables o un data warehouse en este alcance.

### 20. Modelo de imágenes y galería de producto

`ProductImage` representará una colección ordenada y no una única imagen:

```text
ProductImage(
  id,
  productId,
  storageKey,
  url,
  altText,
  isPrimary,
  sortOrder,
  width,
  height,
  mimeType,
  createdAt,
  updatedAt
)
```

Una restricción única parcial garantizará como máximo una imagen `isPrimary=true` por producto. La regla de activación exigirá exactamente una portada para cualquier producto publicable. `sortOrder` será único dentro del producto o se normalizará transaccionalmente al reordenar. El API devolverá `coverImage` en listados y tarjetas, mientras que el detalle devolverá la colección `images` completa y ordenada.

El contrato REST ampliará la gestión de imágenes bajo `/api/v1`:

```text
POST   /products/:productId/images
PATCH  /products/:productId/images/:imageId
DELETE /products/:productId/images/:imageId
```

La mutación permitirá actualizar texto alternativo, orden o portada con autorización `ADMIN`. El almacenamiento seguirá detrás del adaptador existente y la base guardará únicamente claves, URL y metadatos. Eliminar una imagen deberá coordinar referencia y archivo sin dejar un producto activo sin portada.

La galería del storefront no tendrá autoplay. Mantendrá una imagen grande, miniaturas y controles anterior/siguiente, responderá a teclado y gestos táctiles y anunciará posición y texto alternativo. La portada se cargará con prioridad apropiada; las imágenes no activas usarán carga diferida, dimensiones reservadas y formatos optimizados para evitar desplazamientos de layout.

Alternativa considerada: almacenar un array de URLs en `Product`. Se descarta porque dificulta ordenar, definir portada, editar texto alternativo, aplicar integridad y gestionar archivos individuales. También se descarta un carrusel automático porque perjudica control, legibilidad y accesibilidad.

### 21. Seed demostrativo y separación landing-catálogo

El seed será una operación explícita, determinista, idempotente y bloqueada por configuración en producción. Usará identificadores naturales estables para crear o actualizar:

- Exactamente veinte productos tecnológicos de distintas categorías.
- Categorías, etiquetas, slugs, precios y estados válidos.
- Un mínimo de tres imágenes por producto: una portada y al menos dos imágenes de galería.
- Balances iniciales y movimientos auditables de apertura, sin escribir stock directamente fuera de inventario.
- Un usuario de ejemplo `ADMIN` y uno `CUSTOMER`, con credenciales solo de desarrollo o pruebas almacenadas como hashes y nunca impresas en logs.

Las imágenes serán fixtures propias o generadas y aprobadas para uso en el proyecto, sin hotlinks a terceros. Un manifiesto estable asociará cada asset con producto, texto alternativo, orden y condición de portada. El adaptador de almacenamiento comprobará la clave antes de cargar para que una reejecución no duplique archivos. La documentación indicará cómo configurar las credenciales no productivas sin convertirlas en secretos reales.

La landing reutilizará el listado existente con una consulta equivalente a:

```text
GET /api/v1/products?page=1&pageSize=9&sort=createdAt:desc&status=ACTIVE
```

Renderizará solo `items`, sin control paginado, y mostrará un enlace a la ruta de catálogo completo. La página de catálogo utilizará el mismo endpoint con búsqueda, filtros, orden y página reflejados en la URL y con los controles numéricos existentes. No se introducirá un endpoint `/latest` ni se descargarán todos los productos para recortarlos en el frontend.

Alternativa considerada: mantener landing y catálogo como una misma vista paginada. Se descarta porque la landing necesita una selección breve y comercial, mientras que el catálogo necesita exploración exhaustiva y estado navegable. También se descarta cargar imágenes remotas durante cada seed porque vuelve el entorno frágil y no reproducible.

### 22. Destaques y composición agregada de la landing

El modelo de catálogo añadirá metadatos comerciales explícitos:

```text
Product.isFeatured       boolean default false
Product.featuredAt       timestamptz nullable
Category.showOnLanding   boolean default false
Category.landingOrder    smallint nullable
```

Al pasar `isFeatured` de falso a verdadero, el backend establecerá `featuredAt` con la fecha de la operación; editar otros campos no alterará esa fecha. Retirar el destaque limpiará su elegibilidad pública. Las categorías seleccionadas usarán posiciones únicas del 1 al 3 y una restricción de dominio impedirá más de tres selecciones activas. El formulario administrativo mostrará el límite y permitirá ordenar o retirar categorías mediante los `PATCH` existentes de producto y categoría.

El catálogo expondrá `GET /api/v1/catalog/landing` con una respuesta conceptual:

```text
featuredProducts: ProductCard[]            // hasta 3, featuredAt desc
latestProducts: ProductCard[]              // hasta 9, createdAt desc
highlightedCategories: [
  {
    category: CategorySummary,
    products: ProductCard[]                // hasta 3, createdAt desc
  }
]
```

El servicio de aplicación construirá la respuesta usando solo productos activos y no eliminados. Resolverá primero los tres destacados, luego excluirá esos identificadores al obtener los nueve recientes. Después cargará entre dos y tres categorías activas por `landingOrder`; sus productos se calculan independientemente y pueden repetirse respecto de las secciones anteriores porque representan contexto de categoría. Las categorías sin productos activos se omiten de la respuesta final sin reordenar persistentemente las demás.

La composición se resolverá dentro del módulo de catálogo mediante consultas acotadas, índices sobre `isFeatured`, `featuredAt`, `showOnLanding`, `landingOrder`, `categoryId`, `status` y `createdAt`, y una lectura suficientemente consistente para que todas las secciones correspondan al mismo instante lógico. El DTO incluirá solo campos públicos y `coverImage`; nunca expondrá banderas administrativas, costes internos o datos de inventario no públicos.

El seed marcará tres productos activos con fechas de destaque deterministas y tres categorías activas con posiciones 1, 2 y 3. Deberá conservar al menos nueve productos activos adicionales para que la sección de recientes se complete sin repetir destacados.

Alternativa considerada: ejecutar una consulta REST independiente para destacados, recientes y cada categoría. Se descarta porque requeriría entre cuatro y cinco solicitudes, duplicaría reglas de exclusión y podría mezclar estados tomados en momentos diferentes. También se descarta inferir categorías importantes por cantidad de productos o ventas, ya que el administrador necesita control editorial explícito.

## Risks / Trade-offs

- [El alcance inicial abarca varios dominios] → Implementar en incrementos verticales y mantener cada módulo utilizable antes de avanzar al siguiente.
- [Bloqueos concurrentes pueden causar espera o deadlocks] → Bloquear productos en orden estable, mantener transacciones cortas, limitar reintentos y probar compras simultáneas.
- [Dos aplicaciones Next.js duplican configuración] → Centralizar UI y configuración, pero conservar fronteras de despliegue y permisos.
- [Un monolito modular puede degradarse en acoplamiento] → Aplicar reglas de dependencias, contratos de módulo y pruebas de arquitectura.
- [Los PDFs pueden consumir CPU o memoria] → Usar un adaptador, límites de tamaño y posibilidad futura de generación asíncrona.
- [Los pagos simulados no representan fallos reales] → Aislarlos detrás de un puerto de pago para reemplazarlos posteriormente sin alterar checkout.
- [La facturación no cumple normativa tributaria real] → Etiquetarla como facturación interna y tratar cualquier integración fiscal como cambio posterior.
- [Dos sidebars y múltiples estados responsive pueden degradar la usabilidad] → Separar navegación izquierda de filtros derechos, usar drawers en pantallas pequeñas y validar accesibilidad y navegación por teclado.
- [Mensajes flash excesivos pueden producir ruido o anuncios repetidos] → Deduplicar eventos, limitar duración, conservar errores accionables y probar regiones `aria-live`.
- [Cambiar slugs publicados puede romper enlaces externos] → No regenerarlos automáticamente y validar cualquier cambio explícito con una estrategia de redirección futura fuera del alcance inicial.
- [El perfil de tienda puede estar incompleto al emitir documentos] → Validar campos obligatorios antes de habilitar checkout o emisión y conservar snapshots inmutables.
- [Autocompletes con muchas solicitudes pueden aumentar carga] → Exigir término mínimo, aplicar espera breve, cancelar solicitudes obsoletas, limitar `pageSize` e indexar campos de búsqueda.
- [Dos sistemas visuales aumentan el costo de diseño y mantenimiento] → Compartir primitivas accesibles y contratos, pero probar por separado los tokens y variantes de cada aplicación.
- [El tema puede parpadear o discrepar durante hidratación] → Aplicar la preferencia antes de la primera presentación, usar claves locales independientes y probar SSR, navegación y recarga.
- [Un modo oscuro incompleto puede dejar componentes ilegibles] → Mantener una matriz obligatoria de estados y componentes y ejecutar pruebas de contraste y regresión visual en ambos temas.
- [El resumen del dashboard puede quedar momentáneamente desactualizado] → Mostrar fecha de actualización, limitar cualquier caché y enlazar siempre a las listas autoritativas.
- [Los indicadores agregados pueden filtrar información entre roles] → Construir respuestas específicas por rol y verificar permisos y ausencia de campos prohibidos con pruebas de contrato y autorización negativa.
- [Sesenta o más imágenes seed pueden aumentar tamaño y tiempo de preparación] → Usar assets optimizados, un manifiesto estable y cargas idempotentes mediante el adaptador.
- [Reordenar imágenes concurrentemente puede duplicar posiciones o portadas] → Aplicar restricciones, transacción y normalización de orden en el backend.
- [Un seed con credenciales conocidas sería peligroso en producción] → Bloquearlo por entorno, separar configuración no productiva, almacenar hashes y probar explícitamente el rechazo.
- [El carrusel puede degradar accesibilidad o rendimiento] → Evitar autoplay, soportar teclado y gestos, reservar dimensiones y cargar diferidamente imágenes no visibles.
- [Landing y catálogo podrían divergir en reglas de visibilidad] → Reutilizar el mismo endpoint, filtros de producto activo y cliente generado, cambiando solo tamaño, orden y presentación.
- [La sección de recientes puede quedarse corta al excluir destacados] → Consultar suficientes candidatos y aplicar el límite de nueve después de la exclusión.
- [Una configuración parcial puede dejar menos de dos categorías visibles] → Tolerar estados transitorios, omitir secciones vacías y advertir al administrador antes de guardar una configuración incompleta.
- [Productos repetidos en categorías pueden parecer redundantes] → Permitir repetición solo en secciones contextuales de categoría y evitarla estrictamente entre destacados y recientes.
- [El endpoint agregado puede volverse costoso] → Mantener límites pequeños, índices dedicados, consultas acotadas y caché pública breve con invalidación tras cambios editoriales.

## Migration Plan

1. Crear el workspace, configuración compartida, aplicaciones vacías, PostgreSQL local y pipeline de calidad.
2. Incorporar esquema inicial, migraciones, seed mínimo y módulos base del API.
3. Implementar identidad y autorización antes de exponer back office.
4. Entregar catálogo e inventario con interfaces públicas y administrativas.
5. Entregar carrito, checkout, pagos/envíos simulados y órdenes bajo pruebas transaccionales.
6. Entregar facturación, PDF, auditoría y flujos end-to-end.
7. Desplegar cada aplicación de manera independiente, ejecutar migraciones antes del API y habilitar storefront/backoffice después de verificaciones de salud.

Al ser un proyecto nuevo no existe migración de datos productivos. El rollback de cada despliegue volverá a la imagen anterior y solo revertirá migraciones cuando sean explícitamente reversibles; los cambios destructivos de esquema usarán expansión y contracción en entregas futuras.
