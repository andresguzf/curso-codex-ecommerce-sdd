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
- Soportar conversión de divisas o monedas distintas por producto; una eventual multimoneda se diseñará como configuración global mediante un cambio separado.
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

`ADMIN` podrá operar todos los módulos administrativos. `BILLING` podrá administrar órdenes y facturas, incluidas las transiciones válidas, la cancelación elegible, la conversión atómica de orden a factura y la factura manual, pero no podrá administrar usuarios, catálogo, perfil empresarial ni realizar ajustes directos de inventario. Las restituciones de stock causadas por una cancelación serán una consecuencia interna y transaccional del módulo de órdenes, no un permiso de inventario para `BILLING`.

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

Los importes se guardarán como valores decimales de precisión fija junto con el código de moneda fijo `USD`. Las restricciones de persistencia y los contratos rechazarán cualquier otro código. Fechas usarán zona horaria. Productos y usuarios se desactivarán o eliminarán lógicamente para conservar referencias.

`OrderItem` y `InvoiceLine` almacenarán snapshots de nombres, SKU, cantidades, precios, impuestos y moneda. La orden también conservará snapshots de cliente, dirección, envío y pago relevantes. Las modificaciones posteriores de datos maestros no reescribirán documentos históricos.

### 7. Producto simple, moneda única e inventario separado

La primera versión tendrá un SKU por producto, precios exclusivamente en `USD` y un único balance de inventario. El API asignará la moneda del sistema al crear productos, rechazará cualquier moneda diferente y no expondrá un selector de moneda en el CRUD comercial. El API podrá proyectar `stockAvailable` junto al producto, pero el stock no será una columna editable mediante el CRUD comercial. Los cambios se ejecutarán como movimientos de inventario con cantidad, motivo, referencia y autor.

El código de moneda continuará presente en respuestas y snapshots monetarios para que cada importe sea inequívoco, pero tendrá el valor literal `USD`. No se implementarán conversiones ni configuración por producto; una futura multimoneda deberá ser global y revisar de forma explícita precios, redondeos, checkout, documentos y datos históricos.

Las imágenes se almacenarán fuera de PostgreSQL; la base conservará la clave, URL y metadatos. En desarrollo podrá usarse almacenamiento local compatible con el adaptador y en despliegue un servicio de objetos.

Alternativa considerada: guardar la cantidad directamente en `Product`. Se descarta porque impide explicar ajustes, ventas y cancelaciones y facilita sobrescrituras no auditadas.

### 8. Carrito público persistente y checkout autenticado

`Cart` admitirá exactamente uno de dos propietarios: un `customerId` para clientes autenticados o el hash de un identificador anónimo para visitantes. Una restricción comprobará que nunca existan ambos ni falten ambos, y los índices parciales mantendrán como máximo un carrito activo por cliente o por identificador anónimo. Los carritos anónimos incluirán `expiresAt` y se eliminarán mediante una limpieza periódica; nunca reservarán inventario.

El API entregará al visitante un identificador aleatorio y no adivinable mediante una cookie `HttpOnly`, `SameSite=Lax`, con `Secure` en producción y vigencia alineada con la retención del carrito. PostgreSQL almacenará únicamente su hash. Las rutas `GET /cart`, `POST /cart/items`, `PATCH /cart/items/:itemId` y `DELETE /cart/items/:itemId` aceptarán tanto la cookie anónima como la sesión `CUSTOMER`; CORS permitirá credenciales solo desde los orígenes configurados y las mutaciones basadas en cookie mantendrán las comprobaciones de origen y protección CSRF. La cookie identifica un carrito, pero no autoriza checkout, órdenes, facturas, wishlist ni datos personales.

Al iniciar sesión, el backend reclamará el carrito anónimo cuando el cliente no tenga otro activo o fusionará ambos dentro de una transacción. Las líneas coincidentes sumarán cantidades hasta el stock vigente y la respuesta señalará ajustes por disponibilidad. La operación dejará un único carrito activo del cliente e invalidará el identificador anónimo anterior. El storefront conservará el destino solicitado para que registro o login puedan devolver al cliente al checkout.

`POST /checkout` continuará protegido y rechazará una sesión ausente o un rol distinto de `CUSTOMER`. La interfaz permitirá navegar, agregar y administrar el carrito sin autenticación, y solicitará registro o login únicamente al continuar a checkout.

El formulario consulta `GET /checkout/shipping-methods` para mostrar los costos fijos configurados del simulador. Ante una respuesta incierta mantiene la petición y clave de idempotencia del intento, bloqueando su edición hasta recuperarlo. Al confirmar navega a `/checkout/orders/:orderId`; `GET /checkout/orders/:orderId` devuelve exclusivamente el resultado histórico del checkout del cliente autenticado, permitiendo recargar la confirmación sin adelantar el historial ni la gestión operativa de órdenes.

El pago simulado se resolverá sin llamadas externas. Para un resultado aprobado, una transacción PostgreSQL realizará:

1. Verificar la sesión `CUSTOMER`, reclamar o recuperar la clave de idempotencia y resolver su único carrito activo.
2. Bloquear balances de inventario en un orden estable por identificador.
3. Revalidar productos activos, precios y cantidades.
4. Crear orden, líneas y pago aprobado.
5. Descontar balances y registrar movimientos de salida vinculados a la orden.
6. Cerrar el carrito y guardar el resultado idempotente.

Si el pago simulado es rechazado no se confirmará la orden ni se modificará inventario. Errores de concurrencia o deadlocks recuperables tendrán reintentos limitados en la capa de aplicación; una disponibilidad insuficiente se devolverá como conflicto de negocio.

Alternativa considerada: reservar stock al agregar al carrito. Se descarta para el MVP porque permitiría que carritos abandonados bloqueen ventas y requeriría expiraciones. Si posteriormente se incorporan pagos pendientes reales, se añadirá una reserva con vencimiento como cambio separado.

Alternativa considerada: mantener el carrito anónimo únicamente en `localStorage`. Se descarta porque duplicaría reglas y totales autoritativos en el navegador, dificultaría su recuperación y permitiría manipular la propiedad enviada al API. La cookie opaca y el registro persistido conservan el carrito sin exponer su identificador a JavaScript.

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

La cancelación requiere `ADMIN` o `BILLING`, motivo y una orden `PROCESSING` o `INVOICED` sin facturas activas. Cualquier factura distinta de `VOID` bloquea la operación: debe anularse primero mediante el flujo de facturación. La cancelación no modifica automáticamente facturas ni pagos, ni simula un reembolso. La orden, la restitución de inventario y la auditoría se confirman en una sola transacción; se bloquea primero la orden y después los balances en orden estable. Los flujos de facturación deben coordinarse sobre el mismo bloqueo de orden para evitar emitir una factura mientras se cancela. Una repetición de la cancelación conserva el primer motivo y autor y no produce movimientos ni auditoría duplicados. Ni `ADMIN` ni `BILLING` pueden editar los snapshots históricos de una orden confirmada: “modificar una orden” significa ejecutar comandos y transiciones de dominio explícitos.

### 10. Documentos PDF desde snapshots

El backend generará PDFs de órdenes y facturas desde sus snapshots y comprobará propiedad o rol antes de entregar el archivo. Los borradores se marcarán visiblemente y las facturas emitidas recibirán un número único dentro de una transacción.

La revisión confirmada de fase 25 sustituye nuevas cargas manuales por un SVG empresarial fijo generado, confiable y versionado con SHA-256, incluido en el artefacto del API y entregado para su vista previa. No tendrá scripts ni referencias externas. La identidad de la versión será estable y no sobrescribible; versiones futuras conservarán los recursos de versiones históricas. No requiere Cloudinary, uploads ni escrituras en el disco de Functions. El formulario mostrará el logo sin controles de carga, sustitución o eliminación; los demás datos empresariales seguirán editables por ADMIN. El contrato REST retirará la carga manual y no aceptará SVG, URL o clave arbitrarios para cambiar la referencia fija. Regenerar OpenAPI, cliente y Zod cuando se ajuste el contrato. La implementación raster anterior se mantiene sólo como compatibilidad de lectura histórica; no borrar sus assets ni registros.

Los nuevos `issuerSnapshot` de órdenes y facturas manuales conservarán identidad y huella del SVG fijo determinadas por el API. La factura derivada copiará ambos datos de la orden, incluso cuando contenga un raster anterior o no tenga logo. Al generar un PDF, `document-export` leerá únicamente el snapshot y resolverá la versión inmutable incluida o el asset histórico por su clave, verificará su huella y entregará los bytes al adaptador PDF para incrustarlo visualmente. La conversión interna de un SVG confiable a raster para incrustación es válida, sin guardar una carga local ni descargar URLs. No consultar el perfil actual. Un logo ausente se omite sin invalidar el documento; un asset declarado pero perdido o alterado produce un error explícito y nunca se sustituye por el logo vigente. No asignar el SVG retroactivamente a documentos antiguos ni ejecutar seed/backfill al desplegar.

Las plantillas entregarán datos estructurados al puerto PDF, no frases concatenadas como representación exclusiva de líneas. Órdenes y facturas compartirán un sistema visual de fondo claro, acentos azul oscuro, tipografía legible y márgenes constantes: cabecera de empresa/logo y metadatos; bloque de cliente/dirección disponible; tabla producto/SKU, cantidad, unitario, impuestos e importe; totales alineados a la derecha y pie numerado. Incluir pago/envío en órdenes y origen/borrador en facturas. Usar importes USD guardados y envío donde corresponda, sin inventar campos ausentes ni recalcular impuestos o totales comerciales.

El renderer medirá/anclará columnas y altura del texto, ajustará nombres/direcciones largos y soportará caracteres españoles. Paginará en función del espacio, repetirá cabeceras de tabla y numerará páginas; eliminar los recortes silenciosos de filas/textos del renderer actual. Totales y pie nunca se superpondrán con la tabla; textos mayores que una página continuarán sin pérdida. Conservar autorización y endpoints de descarga. Verificar extracción de todas las líneas/importes y renderizar muestras de orden/factura cortas, largas, borrador y texto extenso para inspección visual. Mejorar la presentación de documentos existentes no altera sus snapshots ni exige reproducir bytes del renderer anterior; la regeneración será estable con los mismos datos y versión de renderer/assets.

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

El formulario administrativo de producto mostrará `slug` como campo opcional editable; vacío en creación delega la generación al API y vacío en edición conserva el slug publicado. La categoría se elegirá únicamente entre categorías activas existentes, mediante un desplegable, y se seguirá creando o editando en su CRUD independiente. Las etiquetas podrán seleccionarse entre las activas existentes o introducirse por nombre mediante chips removibles, coma o Enter; el slug de cada etiqueta creada en línea se generará automáticamente con la misma normalización y resolución de colisiones del CRUD de etiquetas. El formulario usará React Hook Form y Zod y enviará una sola mutación REST de producto.

`POST /products` y `PATCH /products/:productId` aceptarán `tagNames?: string[]` además de `tagIds?: string[]`. Si cualquiera de los dos campos está presente, la unión de identificadores y nombres resueltos reemplazará el conjunto de etiquetas del producto; si ambos se omiten en `PATCH`, las asociaciones existentes permanecen intactas. El API limpiará espacios, eliminará duplicados de nombres sin distinguir mayúsculas, reutilizará etiquetas activas existentes, rechazará nombres inválidos o correspondientes a etiquetas inactivas y aplicará el límite de veinte a la unión final. La resolución o creación de etiquetas, su auditoría y el guardado del producto y sus asociaciones se ejecutarán en una sola transacción PostgreSQL; los fallos revertirán todo el conjunto. Las restricciones de unicidad y el manejo de conflictos concurrentes impedirán duplicados. La autorización seguirá siendo exclusiva de `ADMIN`.

Categorías y etiquetas con referencias se desactivarán o eliminarán lógicamente. La relación de wishlist tendrá unicidad por cliente y producto, no reservará stock y conservará productos que pasen a inactivos o agotados para mostrarlos como no disponibles.

Alternativa considerada: guardar categorías y etiquetas como texto o arrays dentro de `Product`. Se descarta porque impide administración consistente, integridad referencial, filtros eficientes y slugs únicos.

### 15. Perfil único de tienda y snapshots empresariales

Se añadirá un agregado `StoreProfile` único con nombre comercial, razón social, identificador fiscal, dirección física estructurada y datos de contacto opcionales. Solo `ADMIN` podrá modificar esos datos; `ADMIN` y `BILLING` podrán consultarlo dentro de sus flujos autorizados. Desde fase 25, la referencia del logo es el SVG fijo versionado determinado por el servidor, no un campo editable ni una carga. Conservar campos/registros de logos anteriores para lectura de documentos históricos, sin migración destructiva.

El seed explícito podrá crear un perfil inicial con valores visiblemente ficticios marcados `DEMO` en desarrollo y pruebas. Lo insertará solo si el perfil único está ausente; las reejecuciones conservarán cualquier perfil existente, incluidos los cambios administrativos. El perfil DEMO no incluirá un logo ni identificadores fiscales reales, y el seed deberá detenerse antes de escribir en producción para que estos datos no lleguen a órdenes o facturas productivas.

Al confirmar una orden se copiará un `issuerSnapshot` del perfil vigente, incluida la identidad y huella del SVG fijo desde fase 25. Una factura derivada de orden tomará el snapshot de la orden; una factura manual tomará el perfil vigente al crearse o emitirse según su estado. Los PDFs leerán únicamente el snapshot del documento y la versión inmutable referenciada. De este modo, editar la empresa no reescribe órdenes, facturas ni la identidad empresarial de los PDFs históricos.

Alternativa considerada: consultar siempre el perfil vigente al renderizar. Se descarta porque produciría documentos históricos distintos después de una modificación empresarial.

### 16. Consultas paginadas y autocomplete remoto

Toda colección potencialmente no acotada se resolverá en el backend y devolverá la forma común:

```text
items, page, pageSize, totalItems, totalPages
```

Esto incluye usuarios, productos, categorías, etiquetas, wishlist, balances y movimientos, órdenes y facturas. El API aplicará búsqueda, filtros autorizados y orden antes de contar y paginar. Las interfaces colocarán la búsqueda sobre la lista; la página de catálogo completo del storefront usará filtros a la izquierda y el backoffice filtros a la derecha. La landing editorial no tendrá filtros ni paginación. Cualquier cambio de criterios en listas paginadas reiniciará `page=1`. El listado administrativo de productos combinará `minPrice`, `maxPrice`, `categoryId`, `tagIds`, `createdFrom` y `createdTo`; las fechas serán `YYYY-MM-DD`, inclusivas en UTC, y el API convertirá el límite superior al inicio del día siguiente para incluir el día completo.

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
POST   /store-profile/logo
```

La ruta de carga `POST /store-profile/logo` corresponde a la entrega histórica de fase 15. La revisión de fase 25 la retira del contrato de carga manual; no crea una alternativa para uploads de logo. La lectura del SVG fijo incluido y su referencia determinada por el API siguen independientes de Cloudinary y preservan la compatibilidad de snapshots anteriores.

Los endpoints existentes `GET /products` y `GET /users` admitirán consultas limitadas para autocomplete mediante `search`, `page`, `pageSize` y filtros autorizados; no se crearán endpoints que devuelvan catálogos o clientes completos. `GET /products` añadirá filtros por categoría, etiquetas, disponibilidad y rango de precio. Para `view=admin`, también aceptará `createdFrom` y `createdTo` con formato `YYYY-MM-DD`, inclusivos en UTC; validará que sean fechas reales y que el inicio no sea posterior al fin, y aplicará el intervalo antes del conteo y la paginación. Estos parámetros de creación no se admitirán en consultas públicas. El detalle público podrá resolverse por slug sin eliminar el acceso administrativo por identificador. Todas las rutas conservarán validación Zod en la frontera frontend, validación autoritativa en NestJS, autorización, errores uniformes y cliente generado.

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
- Un mínimo de tres imágenes por producto: una portada y al menos dos imágenes de galería, representadas temporalmente en desarrollo y pruebas por URLs de Lorem Picsum con IDs fijos seleccionados tras revisión visual para aproximarse al tipo de producto.
- Balances iniciales y movimientos auditables de apertura, sin escribir stock directamente fuera de inventario.
- Un usuario de ejemplo `ADMIN` y uno `CUSTOMER`, con credenciales solo de desarrollo o pruebas almacenadas como hashes y nunca impresas en logs.
- Un `StoreProfile` inicial con valores claramente ficticios marcados `DEMO`, solo cuando no exista un perfil, sin sobrescribir datos administrativos y sin incluir logos ni identificadores fiscales reales.

Durante desarrollo y pruebas, las imágenes podrán ser hotlinks temporales de Lorem Picsum elegidos por ID fijo y no mediante respuestas aleatorias. Como Picsum no ofrece búsqueda semántica por producto, cada ID deberá revisarse visualmente y asociarse de forma explícita en un manifiesto estable con producto, texto alternativo, orden, condición de portada y futura clave de Cloudinary. Antes de producción, esas referencias deberán reemplazarse por assets propios o aprobados cargados mediante el adaptador de Cloudinary; producción no dependerá de hotlinks de Picsum. El adaptador comprobará la clave antes de cargar para que una reejecución no duplique archivos. La documentación indicará cómo configurar las credenciales no productivas sin convertirlas en secretos reales.

La landing consumirá una sola vez `GET /api/v1/catalog/landing`, que devuelve la composición editorial completa definida en la sección siguiente: destacados, hasta nueve productos recientes y categorías importantes. La página no presentará filtros ni paginación; el buscador del hero navegará al catálogo completo con el término aplicado. El catálogo completo utilizará `GET /api/v1/products` con búsqueda, filtros, orden y página reflejados en la URL y controles numéricos backend. No se introducirá un endpoint `/latest` ni se descargarán todos los productos para recortarlos en el frontend.

Alternativa considerada: mantener landing y catálogo como una misma vista paginada. Se descarta porque la landing necesita una selección breve y comercial, mientras que el catálogo necesita exploración exhaustiva y estado navegable. También se descartan URLs aleatorias o búsquedas remotas durante cada ejecución del seed: el seed persistirá un manifiesto de URLs de Picsum con IDs fijos para conservar resultados deterministas, aceptando la dependencia externa únicamente en entornos no productivos hasta migrar los assets a Cloudinary.

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

### 23. Gestor administrativo de imágenes y límite de cuatro

La fase 22 integra la galería en el flujo de productos del backoffice, exclusivamente para `ADMIN`. El máximo es cuatro imágenes totales, una portada y hasta tres adicionales; no se exige llenar los cuatro espacios. Se reutilizan el detalle administrativo y `POST/PATCH/DELETE /products/:productId/images` sin crear un backend Next.js ni rutas paralelas. El `POST` recibe bytes con `Content-Type` JPEG, PNG o WebP y metadatos por query según el contrato existente, no multipart ni base64. Texto alternativo, firma y tamaño siguen validados en el API; no se agregan compresión, recorte ni controles de calidad.

El límite se comprobará en la misma transacción y bajo el mismo bloqueo por producto que inserta y normaliza imágenes. Se revisarán todos los caminos de alta, incluida la compatibilidad `image` de creación/edición y el seed, para impedir bypass. El quinto archivo responde `409 PRODUCT_IMAGE_LIMIT_REACHED`; si el adaptador ya almacenó bytes, se aplica la limpieza compensatoria existente sin modificar la galería confirmada. Dos altas para el último espacio no pueden confirmar ambas. OpenAPI documentará la regla y el error, manteniendo coherentes cliente generado y esquemas Zod. No se añade una migración destructiva ni se ejecuta el seed como parte de esta revisión.

Los productos anteriores con más de cuatro imágenes no se truncarán automáticamente: el gestor mostrará el exceso, conservará toda la colección y permitirá editar, reordenar o eliminar con confirmación, pero bloqueará altas mientras haya cuatro o más. La restricción de portada activa sigue vigente durante la regularización. El seed actual de tres imágenes por producto es compatible y no necesita aumentar a cuatro.

El gestor carga `images` desde el detalle, no desde la referencia única del listado. TanStack Query mantiene el estado remoto bajo claves de producto e identidad administrativa; el estado local contiene solo selección de archivos, vista previa, borradores y apertura del modal. Las respuestas se validan con Zod. Las vistas previas usan URLs temporales que se revocan al sustituir el archivo o desmontar el componente, sin persistir archivos, tokens ni datos privados en almacenamiento del navegador.

Crear producto y subir imágenes son operaciones independientes: primero se guarda el producto y se obtiene el ID; después se habilita el gestor sin crear otro producto al reintentar una carga. Una carga fallida no revierte ni oculta la creación exitosa. Se conserva el comportamiento de imagen genérica existente hasta elegir una portada real y se evita que un guardado genérico de datos del producto sobrescriba la galería o la portada recién elegida mediante un campo URL obsoleto.

Las acciones incluyen subir un archivo por operación, editar texto alternativo, seleccionar portada, ordenar con arrastre o botones de teclado y eliminar con el modal compartido. El gestor muestra contador y bloquea nuevas altas al llegar a cuatro, pero el backend sigue siendo la autoridad ante concurrencia. Se serializan mutaciones del mismo gestor, se deshabilitan duplicados y se recupera el detalle tras conflictos sin asumir que una respuesta perdida equivale a fracaso; las cargas no se reintentan automáticamente. Las mutaciones de galería no descartan cambios no guardados en otros campos del formulario.

Después de éxito se actualizan o invalidan las consultas del backoffice de detalle y listado; las siguientes consultas REST del storefront reflejan portada y orden. No se promete invalidación instantánea de cachés entre aplicaciones independientes. Los mensajes flash nacen de handlers/callbacks de mutación. Se conservan tokens claro/oscuro, foco visible, nombres accesibles para iconos, miniaturas con fallback y controles utilizables en móvil. Las acciones no alteran stock, publicación del producto ni documentos históricos.

### 24. Nuevas cargas de catálogo en Cloudinary (fase 23)

Esta fase amplía las fases 1–22 ya implementadas; la numeración de decisiones de este documento es independiente de la numeración de tareas. Solo cambia el destino de las nuevas cargas de archivos del catálogo. El formulario, el gestor administrativo de galería, los temas, los controles de portada/orden/texto alternativo, el máximo de cuatro imágenes y los endpoints REST conservan su comportamiento. No se migrarán imágenes locales o de Picsum, no se ejecutará el seed ni se cambiarán productos existentes durante la activación.

#### Configuración y frontera de seguridad

`apps/api` usará el SDK oficial de Cloudinary con cargas autenticadas desde el servidor. El navegador continuará enviando bytes JPEG/PNG/WebP y metadatos al `POST /api/v1/products/:productId/images` existente; no se introducirán uploads directos, presets unsigned, Server Actions, multipart en ese contrato ni endpoints paralelos.

La configuración propuesta es `IMAGE_STORAGE_CATALOG_PROVIDER=local|cloudinary`, con `local` por defecto, y las variables privadas `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` y `CLOUDINARY_API_SECRET`. `CLOUDINARY_FOLDER_MODE=dynamic|fixed` se configurará explícitamente al seleccionar Cloudinary. Las cargas usarán siempre la carpeta de assets `codex-storefront`, sin aceptar un destino enviado por el cliente. En modo dinámico se usará `asset_folder`; en modo fijo se usará `folder`, teniendo en cuenta que el public ID y la carpeta no son conceptos equivalentes en modo dinámico. No se inferirá el modo solo por ver una carpeta en la consola.

Los ejemplos de entorno incluirán placeholders, nunca secretos. Ninguna credencial se expondrá mediante `NEXT_PUBLIC_*`, OpenAPI, respuestas, logs o bundles frontend. Seleccionar Cloudinary con configuración incompleta o inválida impedirá el arranque; un fallo del servicio remoto no cambiará silenciosamente el destino a local. La preparación de configuración no equivale a activar el proveedor. Las credenciales se solicitarán al iniciar la tarea de configuración para que el usuario las coloque privadamente en `apps/api/.env`, no en el chat.

El almacenamiento de logos empresariales se separará explícitamente del proveedor seleccionable de catálogo, manteniendo sus lecturas locales, huellas y referencias inmutables. Ni los logos ni la regeneración de PDFs dependerán de Cloudinary por esta fase.

#### Adaptador y referencias compatibles

Antes de una carga remota se validarán permisos, producto, metadatos, firma, MIME, tamaño y dimensiones; la comprobación inicial de capacidad no sustituye el bloqueo transaccional final. Se conservará el límite configurable existente de bytes. Se generará una identidad única por operación y se deshabilitará sobrescritura. El adaptador validará la identidad, el tipo de recurso imagen y la URL HTTPS retornados; persistirá solo referencias y metadatos, no los bytes en PostgreSQL ni una copia local de nuevas cargas Cloudinary.

La clave interna deberá identificar inequívocamente el proveedor y la identidad remota necesaria para su gestión (public ID y asset ID cuando corresponda). Se mantendrá el shape público existente de `ProductImage`, `coverImage` e `images`; cualquier persistencia adicional será interna y aditiva. Las claves locales anteriores conservarán su resolución sin requerir backfill destructivo. Las referencias externas de Picsum seguirán siendo referencias de lectura, no assets propios eliminables. No se decidirá el proveedor de eliminación solo a partir del hostname de una URL.

El router de almacenamiento resolverá lectura y eliminación según el origen del asset, independientemente del proveedor seleccionado para nuevas cargas. Volver a `local` no reescribirá referencias Cloudinary existentes ni las convertirá en archivos locales; su visualización continuará mediante la URL guardada y su gestión remota requerirá conservar la configuración necesaria. No se implementará descarga de URLs arbitrarias, migración automática ni transformación de imágenes.

#### Consistencia y recuperación

Una llamada HTTP externa no forma parte de una transacción PostgreSQL. Se registrará duraderamente la operación y su identidad prevista antes del upload, se subirán los bytes fuera de bloqueos SQL y se confirmarán referencia, orden, portada y auditoría en una transacción corta bajo el bloqueo de producto existente. Si dos uploads compiten por el último espacio, solo uno confirmará su referencia; el otro conservará `409 PRODUCT_IMAGE_LIMIT_REACHED` y compensará su asset remoto.

Un registro persistente de operaciones permitirá resolver cargas aceptadas por Cloudinary pero no confirmadas en PostgreSQL, respuestas perdidas, errores de validación de la respuesta y reinicios del API. La limpieza tendrá reintentos acotados, backoff, exclusión entre ejecutores y una vía operativa de reconciliación documentada. Antes de borrar se comprobarán identidad propia, carpeta y ausencia de referencias, evitando carreras entre la confirmación del upload y la limpieza; solo las operaciones terminales o reconciliadas serán elegibles. No se prometerá una transacción distribuida ni eliminación física instantánea durante una caída remota.

La eliminación de galería confirmará primero la retirada autorizada de la referencia y un trabajo persistente de limpieza en la misma transacción, respetando la portada activa. Después se eliminará únicamente el asset propio no referenciado mediante el SDK, con invalidación de entrega cuando corresponda; no se borrarán carpetas ni colecciones completas. Una limpieza fallida no revertirá ni duplicará una eliminación lógica ya confirmada. Logos, Picsum y assets ajenos quedarán excluidos. Las tareas repetidas serán seguras ante assets ya ausentes y no volverán a subir bytes automáticamente.

Los errores del proveedor se traducirán al envelope REST existente con códigos estables y mensajes seguros: `502 IMAGE_STORAGE_UPSTREAM_ERROR` para respuestas remotas inválidas, `503 IMAGE_STORAGE_UNAVAILABLE` para indisponibilidad y `504 IMAGE_STORAGE_TIMEOUT` para timeout. Se conservarán los errores existentes de validación, autorización, tamaño y límite. Una respuesta incierta no anunciará éxito ni causará reintentos automáticos de carga desde la UI; se recuperará el detalle autoritativo y se reconciliará el asset sin asumir que un timeout implica que Cloudinary no escribió.

#### Visualización, verificación y entrega

Las aplicaciones seguirán usando las URLs REST devueltas por el API. La configuración de imágenes Next.js admitirá únicamente los orígenes/rutas necesarios de entrega Cloudinary, manteniendo las restricciones actuales y fallbacks. No se habilitarán hosts arbitrarios, IP locales en producción ni URLs de API firmadas en el frontend. Se verificarán tarjetas, galería, temas y borradores sin rediseñar componentes ni añadir controles de calidad.

Las pruebas normales usarán un proveedor controlado y PostgreSQL/almacenamiento temporal aislados; cubrirán carpeta dynamic/fixed, secretos, carga inválida, permisos negativos, límite concurrente, respuesta incierta, compensación, reinicio, limpieza repetida, referencias mixtas y preservación de logos/PDFs. Las pruebas end-to-end deberán consumir los contratos REST reales. Una prueba real Cloudinary será opt-in, con autorización específica, cuenta no productiva, asset temporal identificado en `codex-storefront` y limpieza de ese único asset, sin modificar la base de desarrollo ni productos del usuario.

La entrega documentará configuración, migraciones aditivas, seguimiento/reconciliación, selección de proveedor y rollback operativo. No activará Cloudinary, ejecutará seed, hará commit/push ni certificará producción por completar pruebas automáticamente. El reemplazo de Picsum exigido antes de producción por requisitos anteriores sigue vigente, pero su migración queda fuera de esta fase.

Referencias técnicas: [SDK Node.js](https://cloudinary.com/documentation/node_integration), [cargas Node.js](https://cloudinary.com/documentation/node_image_and_video_upload), [modos de carpeta](https://cloudinary.com/documentation/folder_modes) y [Upload API y destroy](https://cloudinary.com/documentation/image_upload_api_reference).

Alternativas descartadas: sustituir globalmente el proveedor compartido con logos (arriesga documentos históricos), upload directo desde el navegador (cambia la frontera REST y la UI), migrar automáticamente imágenes demo (fuera del alcance confirmado), y mantener bloqueos SQL durante uploads (aumenta contención sin aportar atomicidad remota).

### 25. Migración simplificada a Supabase — fase 24 del curso

Se cambia únicamente el alojamiento PostgreSQL. Next.js sigue consumiendo REST NestJS, con Drizzle, autenticación propia y los requisitos de fases 1–23. No se introducen Supabase Auth, Storage, Realtime, SDK frontend ni un segundo sistema de migraciones. Vercel es contexto de una demo futura, no autorización para trasladar o rediseñar el backend.

La fase se reduce a cuatro tareas: conexión/preflight básico; configuración privada; respaldo/copia; activación/prueba básica y documentación. No exige ensayos de corte/rollback, harness de exportación/restauración, pruebas exhaustivas de concurrencia ni comparación criptográfica de todas las tablas. El inventario ya obtenido se reutiliza. La simplificación cambia el esfuerzo de esta migración, no las reglas de negocio ni sus pruebas existentes.

**Conexión.** Usar URI real de Connect, directa o Session pooler. Los dos pools runtime y el migrador usan advisory locks de sesión, por lo que Transaction pooler queda excluido. Credenciales solo en backend. TLS verifica por defecto; para el curso, también con NODE_ENV=production de la demo, opt-in privado `DATABASE_TLS_VERIFY_SERVER=false` permite cifrado sin CA ni verificación de identidad del servidor. Emitir advertencia segura del riesgo de suplantación. No aplicar fallback automático, texto plano ni `NODE_TLS_REJECT_UNAUTHORIZED=0` global; Cloudinary/HTTPS conservan su verificación. Verificar configuración con pruebas focalizadas, no certificar producción. Mantener Data API habilitada, sin consumirla: RLS sin políticas públicas y revocación de permisos anon/authenticated/PUBLIC en tablas, secuencias y funciones de aplicación, incluidos privilegios por defecto para nuevas tablas. No forzar RLS contra el propietario del backend ni crear políticas Supabase Auth; NestJS sigue autorizando roles propios. Preparar protección en 24.2 y aplicarla a tablas creadas en 24.3 antes de importar datos. No alterar esquemas gestionados Supabase.

**Copia.** Comprobar versión/pg_trgm y que no existan tablas conflictivas; origen es PostgreSQL 18.6. No asumir que un dump de esquema de una versión mayor se restaura en otra menor. Usar herramientas PostgreSQL disponibles; si DDL no es compatible, crear esquema mediante migraciones Drizzle compatibles e importar datos con tratamiento explícito del historial, sin duplicar DDL. No implementar un framework genérico. Respaldo privado ignorado por Git, copia de esquemas de aplicación public/drizzle y dependencias, sin roles ni esquemas auth/storage de Supabase. Preservar IDs, hashes, sesiones, decimales USD, snapshots, numeración, relaciones, secuencias, historial y journal de imágenes. Comparar conteos y registros representativos, sin imprimir secretos ni ejecutar seed o limpieza amplia.

**Activación e imágenes.** Pausar escrituras y workers de origen durante copia final y activar una sola autoridad. Los locks en bases distintas no coordinan; nunca arrancar un clon con recuperación Cloudinary real. Conservar assets/referencias Picsum/Cloudinary y archivos/volúmenes locales sin migrarlos. Cambiar conexión privada, reiniciar y comprobar salud, login, catálogo, carrito y consultas de órdenes/facturas. Antes de nuevas escrituras, retorno simple a conexión local conservada; después no volver ciegamente a datos viejos sin recuperar cambios. No ensayar rollback industrial ni prometer cero interrupción.

Referencias: [conexiones](https://supabase.com/docs/guides/database/connecting-to-postgres), [migración PostgreSQL](https://supabase.com/docs/guides/platform/migrating-to-supabase/postgres) y [Data API](https://supabase.com/docs/guides/api/securing-your-api). El informe previo 24.1 es evidencia histórica; no demuestra conexión ni copia completadas.

### 26. Tres aplicaciones en Vercel — fase 25 del curso

Tres proyectos asociados al mismo repositorio, con Root Directory
apps/storefront, apps/backoffice y apps/api; mantener acceso a paquetes del
workspace fuera de esas raíces y builds pnpm/Turborepo reproducibles. Next.js
permanece frontend; NestJS mantiene Fastify, /api/v1 y Swagger como una Function
Node.js mediante soporte oficial Vercel. No crear backend comercial dentro de
Next.js, microservicios, otro ORM o Supabase Auth/Storage. La fase 24 no autorizó
este despliegue: la fase 25 es la revisión posterior confirmada.

**Formato del API.** La implementación usa ESM nativo (`type: module`,
TypeScript NodeNext e imports relativos con extensión `.js`). Esto permite cargar
NestJS/config 12 sin depender del puente CommonJS `require(ESM)`, rechazado por
el runtime Vercel observado en 25.3. Los recursos inmutables se resuelven con
`new URL(..., import.meta.url)` y deben conservar su rastreo en el bundle.
La comprobación offline del arranque no sustituye el health del dominio publicado.

**Conexión/entornos.** En Vercel usar URI real de Session pooler 5432 copiada
de Connect; nunca inferir host/usuario de aws-0-us-east-1. 6543 es Transaction
pooler e incompatible con los locks de sesión actuales. Reutilizar pools por
instancia, reducir su presupuesto para serverless y verificar exclusión/liberación
de locks. Migraciones Drizzle como paso controlado antes de activar, no por
petición ni por cold start; no seed ni nuevas copias de datos. Mantener TLS
por defecto y opt-in privado del curso explícito, sin desactivar HTTPS global.
Elegir región disponible próxima a Supabase us-east-1 y verificar límites reales.

Secrets PostgreSQL/JWT/Cloudinary/cron sólo en API. Frontends reciben únicamente
URLs públicas; las URLs finales y dominios permitidos se configuran explícitamente.
No habilitar previews que escriban en la base o ejecuten recuperación contra
assets activos sin autorización. La prueba local sigue funcionando; el corte
remoto debe dejar un solo ejecutor programado de recuperación.

**Sesión.** Preferir rewrites de infraestructura /api/v1 hacia el proyecto API
desde cada frontend, usando REST bajo su propio origen para evitar depender de
cookies de terceros entre dominios vercel.app. No usar Route Handlers/Server
Actions para lógica comercial. Mantener HttpOnly, Secure, CSRF, Bearer en memoria
y allowlist CORS exacta, sin wildcard con credenciales. Probar login, refresh/F5
y logout en ambos frontends; no debilitar cookies ni sustituirlas por localStorage.

**Trabajos.** Desactivar timers permanentes en Vercel y exponer ejecución acotada
de los servicios existentes mediante endpoint interno protegido y cron compatible
con el plan confirmado. Mantener journal, gracia, backoff, límites y coordinación;
no depender del tráfico ni de timers en instancias que pueden pausarse. Rechazar
invocación no autenticada y tolerar concurrencia. El usuario confirmó ejecución
diaria para esta demo en Hobby: recuperación y limpieza comparten una invocación
protegida, sin prometer 30 s en serverless ni contratar Pro. Se desactivan timers
solo cuando VERCEL=1; el corte del ejecutor local y la programación remota
pertenecen al despliegue 25.3, no a la preparación 25.1.

**Archivos/cargas.** Cloudinary continúa para nuevas imágenes del catálogo,
Picsum y referencias externas existentes no se sustituyen. Vercel no será un
almacén durable de archivos locales. El usuario confirmó sustituir nuevas cargas
de logo por el SVG fijo versionado incluido en el despliegue, sin Cloudinary ni
almacenamiento mutable. Conservar lectura histórica, bytes/huellas y snapshots:
el SVG fijo no resuelve ni oculta assets locales anteriores. Inventariar sólo
referencias locales históricas y acordar entrega durable antes de trasladarlas;
no mover imágenes Cloudinary, ejecutar seed ni borrar originales. La portabilidad
histórica sigue siendo condición de la exportación funcional, no una excusa para
sustituir identidades. El diseño PDF tabular multipágina de la decisión 10 se
implementará dentro de 25.1 y verificará visualmente antes de cerrar la entrega.

Mantener las cargas pasando por REST NestJS; configurar en Vercel un máximo
de 4194304 bytes (4 MiB), inferior al límite de payload de 4,5 MB, con validación
backend y feedback coherente del formulario existente. No cambiar estética,
número de imágenes ni añadir upload directo del navegador. Verificar también
PDFs/respuestas frente a límites de Function, sin truncar documentos.

**Entrega.** Cuatro tareas: adaptación API/decisiones mínimas; configuración de
proyectos/variables; despliegue API y frontends; smoke/documentación. Conservar
datos activos y backups privados. Publicación real requiere sesión Vercel y
equipo/proyectos identificados por el usuario; no asumir acceso o gasto. Smoke
de login, sesión, catálogo/galería, carrito, órdenes/facturas/PDF y trabajo
programado acotado; no compras, seed ni nuevos smoke destructivos Cloudinary
sin autorización específica. README/AGENTS se actualizarán en la entrega,
sin commit/push ni archivo automático.

Fuentes verificadas al planificar: [NestJS Vercel](https://vercel.com/docs/frameworks/backend/nestjs),
[conexiones Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres),
[límites Functions](https://vercel.com/docs/functions/limitations) y
[cron por plan](https://vercel.com/docs/cron-jobs/usage-and-pricing).

### 27. Rediseño exclusivo del storefront — fase 26

Revisión aprobada el 2026-10-07. Modernizar toda la aplicación pública, incluida
cuenta/checkout, sin alterar el backoffice ni la arquitectura REST. La referencia
es Tailwind Animations y las capturas aportadas: superficies coherentes, espacio
en blanco, bordes discretos y acentos tecnológicos. No copiar marca/assets ni
introducir obligatoriamente la biblioteca de animaciones. Esta decisión sustituye
solo la presentación anterior del hero y las franjas inversas del storefront;
preserva requisitos funcionales, snapshots y diseño PDF.

**Tokens y tipografía.** Paleta base clara: canvas `#FFFFFF`, superficie suave
`#FAF9FE`, texto `#252737`, secundario `#656777`, azul `#336FE3` y violeta
`#6554AE`, con lavanda casi blanca `#F3F0FC` para superficies de acento.
Paleta oscura confirmada tras la vista previa: canvas carbón `#0D0D12`,
superficie violeta oscuro `#1C1726`, texto `#F3F1F7`, secundario `#B5ACBF`,
azul `#85AEFF` y lavanda `#BCA7EF`. El carbón domina y el violeta aporta
profundidad; bordes decorativos `#342B43`, distintos del borde de control
que requiere contraste suficiente. En claro no hay grandes superficies de
acento oscuro: reservar esos tonos para texto legible y acciones pequeñas.
Derivar bordes, hover y colores semánticos verificando contraste WCAG AA por
combinación real; la paleta no acredita contraste por sí misma. Reservar violeta
para acentos puntuales, no gradientes decorativos en cada sección. Dirección
tipográfica: Space Grotesk para títulos con moderación, Source Sans 3 para lectura
y controles, monospace de sistema para SKU/datos auxiliares. Integrar fuentes
con licencia y entrega local, sin dependencia de CDN durante build/render.

**Layout.** Contenedor de contenido cercano a 1200 px, ritmo consistente,
tarjetas de producto de una a tres columnas según ancho, detalle con galería y
compra en dos columnas que se apilan en móvil. Header, footer, formularios,
paneles y estados comparten el tema activo; el tema claro no conserva franjas
navy obligatorias. Fotografías oscuras y pequeños estados semánticos no son
franjas de UI y pueden mantener su color natural. Navbar fijo, más translúcido
al desplazar, adapta color al tema y mantiene legibilidad, foco, enlaces activos,
sesión y badge del carrito.

**Firma visual: hero panorámico de hardware.** Dar a la fotografía un marco
amplio, cercano al ancho útil de pantalla, no un panel lateral pequeño. Usar
proporción panorámica aproximada 21:9 en escritorio, adaptable en móvil sin
deformar el hardware ni generar scroll horizontal. Título, búsqueda y CTA viven
en una superficie legible independiente o con protección de contraste estable;
no dependen de los píxeles de la imagen ni fuerzan una franja oscura en tema claro.
Preparar dos fotografías hiperrealistas: teclado mecánico RGB y tarjeta gráfica
NVIDIA, sin personas, en escenografía oscura elegante, iluminando el hardware.
Una tercera fotografía opcional puede mostrar un setup de escritorio con monitor
y hardware, también sin personas. No usar estadísticas, descuentos ni claims
técnicos inventados; no presentar el hero como una fotografía de un SKU concreto.
Los assets son estáticos, versionados del storefront, no cargas de producto ni
una migración de Cloudinary/Picsum. Generarlos o seleccionarlos e integrarlos
durante 26.2, no durante planificación.

**Movimiento del hero.** Desplazamiento lateral muy lento de derecha a izquierda
con recorrido de retorno suave, usando transform y un sobreencuadre acotado;
orientación inicial: ciclo de unos 30–45 segundos, sin zoom agresivo. Alternar
fotografías aproximadamente cada 12–15 segundos con fundido cercano a un segundo,
sin video y sin desplazar texto/controles. El tiempo y el encuadre se ajustan tras
revisión visual. Mostrar controles accesibles para pausar/reanudar todo el
movimiento y seleccionar imagen. Revisión confirmada posterior a 26.5: el hover
sobre la fotografía no pausa el movimiento. Seleccionar una imagen limpia la
pausa manual y del foco del control para iniciar su desplazamiento sin exigir
reanudar. El formulario de búsqueda y la página oculta conservan su pausa;
el foco en controles puede pausar hasta activarlos o salir de ellos. La
corrección visual usa pan de ±8% con escala 1.22 y 20 segundos por sentido,
manteniendo el marco responsive y la alternancia cada 14 segundos. El paneo
de la foto visible no espera las cargas secundarias; la alternancia espera
las tres escenas: teclado RGB, gráfica NVIDIA y audífonos premium. El nuevo
asset panorámico local mantiene la estética, sin subirlo a Cloudinary.
Con `prefers-reduced-motion: reduce`, iniciar
estático, sin desplazamiento, autoplay ni fundidos; selección manual inmediata.
Si JavaScript, animación o una imagen fallan, título/buscador y un respaldo
estático siguen disponibles. Evitar anuncios aria-live continuos y cargar con
prioridad solo la primera imagen; diferir las siguientes sin salto de layout.
Esta alternancia ambiental no se aplica a ProductGallery, que sigue sin autoplay.
Fuera del hero usar únicamente microinteracciones discretas, sin revelar contenido
solo mediante scroll ni añadir retrasos de acceso/navegación.

**Aislamiento.** Tokens/estilos/fuentes se restringen a
`[data-design-system="storefront"]`, incluidos portales y modales; no cambiar
resets globales o primitivas compartidas de modo que afecten al backoffice.
Conservar bootstrap, claves independientes de tema, preferencia del sistema y
persistencia explícita sin parpadeo. Mantener datos remotos en TanStack Query,
sin duplicarlos para rediseñar; no cambiar sesión, permisos ni contratos.
Conservar landing 3 destacados / 9 recientes deduplicados / hasta 3 categorías
con 3 productos, sin filtros/paginador en inicio; catálogo completo conserva
criterios en URL y paginación backend. Aplicar la dirección visual también a
login/registro, carrito, checkout, wishlist y consultas de órdenes/facturas del
cliente, sin rediseñar documentos exportados ni pantallas ADMIN/BILLING.

**Verificación y entrega.** Cinco tareas incrementales (26.1–26.5), una por turno.
Verificar móvil 375 px y escritorio 1440 px, ambos temas, contraste, foco/teclado,
movimiento reducido, pausa del hero, fallos de imágenes, navegación y estados de
carga/error/vacío. Ejecutar suites de temas, tokens y frontends con fixtures
aisladas; revisar nuevos snapshots solamente del storefront y comprobar que las
referencias del backoffice permanecen intactas. No reemplazar snapshots
automáticamente para ocultar fallos. Sin seeds, cambios de datos/infraestructura,
smoke remoto ni commit/push implícitos. La fase 25 pendiente conserva su estado.

## Risks / Trade-offs

- Fase 26: estilos compartidos o portales sin ámbito pueden modificar el backoffice; verificar ambas aplicaciones y no actualizar sus referencias visuales como parte del rediseño.
- Fase 26: fotografías panorámicas grandes y movimiento permanente pueden afectar carga, contraste y accesibilidad; limitar assets/transformaciones, priorizar solo la portada del hero y proporcionar pausa y modo estático.

- [Pool transaccional pierde estado de sesión] → Usar conexión directa/sesión y probar exclusión advisory entre procesos antes del corte.
- [Data API elude autorización NestJS] → Mantenerla habilitada, pero proteger tablas de aplicación con RLS y permisos restringidos actuales/futuros sin consumirla desde los frontends.
- [Clones del journal pueden borrar imágenes reales] → Inhibir recuperación remota en ensayos y mantener una sola base/proceso operativo al cambiar conexión.
- [Diferencias de versión o escrituras nuevas hacen inseguro el rollback] → Preflight, respaldo, validación y reconciliación antes de reabrir; no volver a datos obsoletos.

- [El alcance inicial abarca varios dominios] → Implementar en incrementos verticales y mantener cada módulo utilizable antes de avanzar al siguiente.
- [Bloqueos concurrentes pueden causar espera o deadlocks] → Bloquear productos en orden estable, mantener transacciones cortas, limitar reintentos y probar compras simultáneas.
- [Dos aplicaciones Next.js duplican configuración] → Centralizar UI y configuración, pero conservar fronteras de despliegue y permisos.
- [Un monolito modular puede degradarse en acoplamiento] → Aplicar reglas de dependencias, contratos de módulo y pruebas de arquitectura.
- [Los PDFs pueden consumir CPU o memoria] → Usar un adaptador, límites de tamaño y posibilidad futura de generación asíncrona.
- [Los pagos simulados no representan fallos reales] → Aislarlos detrás de un puerto de pago para reemplazarlos posteriormente sin alterar checkout.
- [El identificador de un carrito anónimo puede ser robado o fijado] → Usar alta entropía, cookie `HttpOnly` y `Secure`, guardar solo el hash, rotarlo al autenticar, aplicar expiración y no tratarlo como autorización para ningún recurso protegido.
- [Los carritos abandonados pueden crecer sin límite] → Configurar retención, actualizar actividad de forma acotada y ejecutar limpieza periódica indexada por `expiresAt`.
- [La fusión al iniciar sesión puede superar el stock] → Fusionar transaccionalmente, limitar la suma a la disponibilidad vigente e informar cada ajuste antes de checkout.
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
- [Los hotlinks temporales de Picsum pueden fallar, cambiar de disponibilidad o no representar fielmente el producto] → Usar IDs fijos revisados visualmente solo en desarrollo y pruebas, conservar fallbacks accesibles y reemplazarlos por assets gestionados en Cloudinary antes de producción.
- [Reordenar imágenes concurrentemente puede duplicar posiciones o portadas] → Aplicar restricciones, transacción y normalización de orden en el backend.
- [Un seed con credenciales conocidas sería peligroso en producción] → Bloquearlo por entorno, separar configuración no productiva, almacenar hashes y probar explícitamente el rechazo.
- [Un perfil empresarial ficticio podría terminar en documentos emitidos] → Marcar cada valor como `DEMO`, crear el perfil solo en desarrollo/pruebas y solo si está ausente, preservar ediciones administrativas y fallar antes de escrituras de seed en producción.
- [El carrusel puede degradar accesibilidad o rendimiento] → Evitar autoplay, soportar teclado y gestos, reservar dimensiones y cargar diferidamente imágenes no visibles.
- [Landing y catálogo podrían divergir en reglas de visibilidad] → Mantener endpoints de lectura distintos —composición agregada para landing y listado paginado para catálogo— que compartan las mismas reglas backend de producto activo, proyecciones públicas y cliente generado.
- [La sección de recientes puede quedarse corta al excluir destacados] → Consultar suficientes candidatos y aplicar el límite de nueve después de la exclusión.
- [Una configuración parcial puede dejar menos de dos categorías visibles] → Tolerar estados transitorios, omitir secciones vacías y advertir al administrador antes de guardar una configuración incompleta.
- [Productos repetidos en categorías pueden parecer redundantes] → Permitir repetición solo en secciones contextuales de categoría y evitarla estrictamente entre destacados y recientes.
- [El endpoint agregado puede volverse costoso] → Mantener límites pequeños, índices dedicados, consultas acotadas y caché pública breve con invalidación tras cambios editoriales.

## Migration Plan

1. Crear el workspace, configuración compartida, aplicaciones vacías, PostgreSQL local y pipeline de calidad.
2. Incorporar esquema inicial, migraciones, seed mínimo y módulos base del API.
3. Implementar identidad y autorización antes de exponer back office.
4. Entregar catálogo e inventario con interfaces públicas y administrativas.
5. Entregar carrito público persistente para visitantes y clientes, vinculación al autenticar, checkout protegido, pagos/envíos simulados y órdenes bajo pruebas transaccionales.
6. Entregar facturación, PDF, auditoría y flujos end-to-end.
7. Desplegar cada aplicación de manera independiente, ejecutar migraciones antes del API y habilitar storefront/backoffice después de verificaciones de salud.

Los pasos 1–7 describen la entrega inicial. El rollback de despliegues solo revierte migraciones explícitamente reversibles; los cambios destructivos usarán expansión y contracción. La fase 24 sí copia los datos existentes y aplica este orden adicional:

1. Comprobar conexión, versión/extensión y destino vacío con el preflight básico de 24.1.
2. Preparar configuración privada del API/migrador y opción TLS docente en 24.2.
3. Tras autorización, respaldar y copiar datos de aplicación en 24.3 con escrituras/workers pausados y verificación básica de conteos.
4. Tras autorización, activar conexión, realizar prueba básica REST/UI y actualizar guías/README/AGENTS en 24.4, conservando origen para recuperación sin perder escrituras nuevas.
