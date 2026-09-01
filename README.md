# Technology E-commerce Platform

Aplicación e-commerce para comercializar un catálogo de productos tecnológicos. El proyecto se diseñó como un monorepo con dos aplicaciones frontend en Next.js, un backend REST independiente y PostgreSQL como base de datos transaccional.

> Estado actual: planificación completada. Todavía no se ha implementado código funcional.

La propuesta OpenSpec activa es [`build-technology-ecommerce-platform`](openspec/changes/build-technology-ecommerce-platform/). Sus cuatro tipos de artefactos están completos y la validación estricta es exitosa.

## Objetivo

Construir una plataforma que cubra de forma coherente:

- Storefront público con landing page, hero y catálogo de tecnología.
- Identidad visual comercial propia de una tienda online tecnológica.
- Shell reutilizable con header, navbar superior, logo SVG, footer y badge de unidades del carrito.
- Registro, autenticación, sesiones y autorización por roles.
- Búsqueda, filtros colapsables, ordenamiento, paginación backend y detalle por slug.
- Categorías administrables, etiquetas y lista de deseos persistente.
- Carrito persistente y checkout con pagos y envíos simulados.
- Historial y administración de órdenes.
- Control de inventario consistente y auditable.
- Facturación manual o derivada de órdenes con autocomplete remoto de clientes y productos.
- Perfil empresarial administrable y preservado en snapshots históricos.
- Exportación PDF de órdenes y facturas.
- Back office separado con navegación lateral, búsquedas y filtros colapsables para administración y facturación.
- Back office empresarial con dashboard, identidad visual distinta y temas claro y oscuro independientes.
- Seed no productivo con 20 productos tecnológicos, al menos 60 imágenes y usuarios de ejemplo `ADMIN` y `CUSTOMER`.
- Landing con 3 destacados, 9 productos recientes no repetidos y hasta 3 categorías importantes con 3 productos cada una.
- Imagen de portada para tarjetas y galería accesible tipo carrusel en el detalle.

El diseño busca preservar consistencia entre compra, orden, inventario y facturación sin asumir microservicios ni integraciones externas prematuras.

## Estado de OpenSpec

| Artefacto | Estado | Propósito |
|---|---|---|
| [`proposal.md`](openspec/changes/build-technology-ecommerce-platform/proposal.md) | Completo | Motivación, alcance, capacidades e impacto |
| [`design.md`](openspec/changes/build-technology-ecommerce-platform/design.md) | Completo | Arquitectura, decisiones, riesgos y despliegue |
| [`specs/`](openspec/changes/build-technology-ecommerce-platform/specs/) | Completo | Requisitos observables y escenarios verificables |
| [`tasks.md`](openspec/changes/build-technology-ecommerce-platform/tasks.md) | Completo | 135 tareas de implementación con verificación |

Validación ejecutada:

```text
Change: build-technology-ecommerce-platform
Progress: 4/4 artifacts complete
Change 'build-technology-ecommerce-platform' is valid
```

## Reglas fundamentales

Estas decisiones son invariantes del proyecto:

1. El frontend consume exclusivamente la API REST.
2. Next.js no usa Server Actions ni Route Handlers para lógica de negocio o acceso a datos.
3. Solo el backend accede a PostgreSQL.
4. Orden, pago y factura son conceptos independientes.
5. El carrito no reserva ni descuenta inventario.
6. Una compra confirmada descuenta inventario exactamente una vez.
7. Facturar, pagar, anular o exportar una factura nunca modifica inventario.
8. Una factura manual tampoco modifica inventario.
9. Una venta administrativa de productos físicos debe originarse como orden antes de facturarse.
10. El stock nunca puede quedar negativo, incluso ante checkouts concurrentes.
11. Los reintentos de checkout no pueden duplicar órdenes, pagos ni movimientos de stock.
12. Productos, órdenes y facturas conservan snapshots históricos.
13. Usuarios y productos relacionados con operaciones históricas no se eliminan físicamente.
14. La autorización se aplica en el API; ocultar opciones en el frontend no constituye seguridad.
15. Toda colección potencialmente grande se busca, filtra, ordena y pagina en el backend.
16. La wishlist no reserva inventario y un producto guardado continúa sujeto a validación de disponibilidad.
17. Las categorías, etiquetas y slugs conservan integridad y referencias históricas mediante restricciones y eliminación lógica.
18. Órdenes, facturas y PDFs usan snapshots del perfil empresarial; editar la empresa no reescribe documentos existentes.
19. Storefront y backoffice comparten primitivas técnicas, pero mantienen identidades visuales, paletas, densidades y jerarquías diferentes.
20. Cada aplicación ofrece temas claro y oscuro accesibles y conserva su preferencia visual de forma independiente.
21. El resumen del dashboard está autorizado por rol y nunca expone métricas administrativas a `CUSTOMER`.
22. Un producto publicable tiene exactamente una portada y una colección ordenada de imágenes con texto alternativo.
23. Las tarjetas usan la portada; la galería completa pertenece al detalle y nunca avanza automáticamente.
24. La sección de recientes de la landing muestra como máximo 9 productos activos sin paginador; el catálogo completo conserva búsqueda, filtros, orden y paginación backend.
25. El seed demostrativo es idempotente, explícito y está bloqueado en producción.
26. Solo `ADMIN` destaca productos y selecciona u ordena categorías importantes.
27. La landing muestra primero hasta 3 destacados por `featuredAt`, luego hasta 9 recientes sin repetirlos y finalmente entre 2 y 3 categorías importantes.
28. Cada categoría importante muestra hasta 3 productos activos recientes y puede repetir productos de las secciones anteriores por su contexto editorial.
29. Las categorías vacías o inactivas y los productos inactivos se omiten de la composición pública.
30. La landing se obtiene mediante una única respuesta REST agregada y no mediante consultas independientes desde el frontend.

## Arquitectura general

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
                 | transactions   |
                 +----------------+
```

Frontend y backend viven en el mismo repositorio, pero se construyen y despliegan de manera independiente. El monorepo no implica que las aplicaciones compartan ejecución ni acceso a datos.

### Estructura planificada

```text
apps/
  storefront/       Next.js: catálogo, carrito, checkout y cuenta
  backoffice/       Next.js: usuarios, productos, stock, órdenes y facturas
  api/              NestJS: API REST y lógica de negocio

packages/
  api-client/       Cliente TypeScript generado desde OpenAPI
  api-schemas/      Esquemas Zod de fronteras HTTP
  ui/               Componentes presentacionales compartidos
  config-*/         TypeScript, ESLint y Tailwind compartidos

infra/
  database/         PostgreSQL, migraciones y entorno local
  docker/           Imágenes y composición de servicios
  deployment/       Configuración de despliegue

openspec/
  changes/          Propuestas y planes de cambio
  specs/            Especificaciones principales archivadas
```

### Dependencias permitidas

```text
storefront  --> api-client, api-schemas, ui
backoffice  --> api-client, api-schemas, ui
api         --> persistencia, dominio, infraestructura

storefront  -x-> ORM o PostgreSQL
backoffice  -x-> ORM o PostgreSQL
frontend    -x-> entidades internas del backend
```

## Stack técnico planificado

### Monorepo

- pnpm workspaces.
- Turborepo para ejecución y caché de tareas.
- Configuraciones compartidas de TypeScript, ESLint, Tailwind y testing.

### Frontend

- Next.js con App Router.
- TypeScript.
- React estable 19.2.8 o una versión estable posterior disponible al implementar.
- Tailwind CSS.
- TanStack Query para estado remoto, caché, mutaciones e invalidación.
- Zustand con `create()` exclusivamente para estado global del cliente.
- Zod para validar entradas y respuestas no confiables.
- React Hook Form con `zodResolver` para formularios.

Los Server Components pueden consultar endpoints REST para renderizado inicial y SEO. Los Client Components gestionan interacción, eventos y APIs del navegador. Ningún componente accede directamente a la base de datos.

### Backend

- NestJS como monolito modular.
- API REST versionada bajo `/api/v1`.
- OpenAPI como contrato público.
- Cliente TypeScript generado desde OpenAPI.
- ORM con migraciones y transacciones.
- SQL explícito donde sea necesario controlar concurrencia y bloqueos.
- Generador PDF desacoplado mediante un adaptador.
- Logs estructurados, correlation IDs, métricas y auditoría.

### Datos e infraestructura

- PostgreSQL como autoridad transaccional.
- Importes decimales de precisión fija junto con código de moneda.
- Fechas con zona horaria.
- Imágenes almacenadas fuera de PostgreSQL; la base guarda la clave, URL y metadatos.
- Aplicaciones empaquetables y desplegables por separado.

## Roles y permisos

El sistema reconoce exactamente tres roles:

- `CUSTOMER`
- `ADMIN`
- `BILLING`

| Funcionalidad | Customer | Admin | Billing |
|---|---:|---:|---:|
| Registro público | Sí, siempre como Customer | No aplica | No aplica |
| Login, sesión y logout | Sí | Sí | Sí |
| Catálogo público | Sí | Sí | Sí |
| Wishlist propia | Sí | No | No |
| Carrito y checkout | Sí | Opcional | No |
| Consultar compras propias | Sí | No aplica | No aplica |
| Consultar todas las órdenes | No | Sí | Sí |
| Cambiar estados operativos de órdenes | No | Sí | No |
| Facturar una orden | No | Sí | Sí |
| CRUD de productos | No | Sí | No |
| Administrar categorías y etiquetas | No | Sí | No |
| Ajustar inventario | No | Sí | No |
| Administrar usuarios y roles | No | Sí | No |
| Modificar perfil empresarial | No | Sí | No |
| Consultar perfil empresarial | No | Sí | Sí |
| Crear factura manual | No | Sí | Sí |
| Gestionar estados de factura | No | Sí | Sí |
| Descargar documentos propios | Sí | No aplica | No aplica |
| Descargar cualquier documento autorizado | No | Sí | Sí |

### Reglas de identidad

- El registro público siempre asigna `CUSTOMER` en el servidor.
- El cliente no puede solicitar ni autoadjudicarse un rol privilegiado.
- Solo `ADMIN` crea usuarios `ADMIN` o `BILLING` y modifica roles.
- Los correos son únicos.
- Las cuentas pueden estar activas, inactivas o bloqueadas.
- El sistema no permite desactivar al último administrador activo.
- Cada cliente accede exclusivamente a su carrito, órdenes, facturas y documentos.
- Los cambios de rol, activaciones, bloqueos y desactivaciones quedan auditados.

## Capacidades y especificaciones

### 1. Identidad y acceso

Especificación: [`identity-access/spec.md`](openspec/changes/build-technology-ecommerce-platform/specs/identity-access/spec.md)

Incluye:

- Registro público de clientes.
- Login, renovación de sesión y logout.
- Invalidación de sesiones revocadas.
- Autorización backend basada en tres roles.
- CRUD administrativo de usuarios con desactivación lógica.
- Búsqueda, filtros, ordenamiento y paginación backend de usuarios.
- Protección del último administrador.
- Aislamiento de datos entre clientes.
- Cookies protegidas, CORS, CSRF y limitación de intentos de autenticación.
- Mensajes flash accesibles después de login y logout.
- Confirmación modal antes de desactivar o eliminar lógicamente usuarios.

### 2. Catálogo de productos

Especificación: [`product-catalog/spec.md`](openspec/changes/build-technology-ecommerce-platform/specs/product-catalog/spec.md)

Cada producto tendrá al menos:

- ID.
- SKU único.
- Nombre.
- Slug único y estable para la URL pública.
- Descripción.
- Precio no negativo.
- Moneda.
- Una imagen principal de portada y una colección ordenada de imágenes con texto alternativo.
- Stock disponible proyectado desde inventario.
- Fecha de creación.
- Fecha de actualización.
- Estado `ACTIVE` o `INACTIVE`.
- Categoría principal.
- Cero o más etiquetas.
- Marca de eliminación lógica cuando corresponda.

El storefront incluirá:

- Shell reutilizable con header, navbar superior, logo SVG, área principal y footer.
- Navbar con inicio, cuenta, login/logout según sesión y carrito con badge de unidades.
- Landing page con hero, imagen tecnológica semitransparente y buscador.
- Primera sección con hasta 3 productos activos destacados recientemente.
- Segunda sección con hasta 9 productos activos recientes, excluyendo los destacados ya mostrados.
- Entre 2 y 3 secciones de categorías importantes, ordenadas, con hasta 3 productos activos recientes cada una.
- Enlace “Ver todos los productos” hacia una página de catálogo separada.
- Catálogo completo de productos activos con búsqueda, filtros, ordenamiento y paginación backend.
- Tarjetas de producto.
- Búsqueda por nombre, descripción o SKU.
- Filtros por categoría, etiquetas, disponibilidad, precio y criterios permitidos.
- Sidebar izquierdo de filtros colapsable y drawer equivalente en pantallas pequeñas.
- Ordenamiento por campos explícitamente autorizados.
- Detalle público por slug con galería tipo carrusel, miniaturas, controles, teclado, gestos táctiles, descripción, precio y stock.
- Indicación de producto agotado.
- Acción de compra deshabilitada cuando no exista disponibilidad.
- Controles para agregar o retirar productos de la wishlist.

El back office permitirá exclusivamente a `ADMIN`:

- Listar productos activos, inactivos y archivados según filtros.
- Crear y editar productos.
- Administrar categorías y etiquetas con nombres y slugs únicos.
- Destacar productos y retirar su destaque.
- Seleccionar, ordenar o retirar hasta 3 categorías importantes para la landing.
- Activar y desactivar productos.
- Eliminar productos lógicamente.
- Gestionar múltiples imágenes, su orden, texto alternativo y portada única.
- Ajustar inventario mediante operaciones separadas del formulario comercial.
- Usar navegación lateral izquierda colapsable, búsqueda superior y filtros derechos colapsables.
- Recibir mensajes flash y confirmar acciones destructivas mediante un modal accesible.

### 3. Datos demostrativos

Los entornos de desarrollo y pruebas podrán cargar de forma idempotente:

- Exactamente 20 productos tecnológicos con categorías, etiquetas, slugs, precios y estados válidos.
- Al menos 3 imágenes por producto: una portada y dos imágenes adicionales, para un mínimo de 60 assets optimizados.
- Inventario inicial creado mediante balances y movimientos auditables de apertura.
- Al menos 9 productos activos para poblar la sección de recientes de la landing.
- Un usuario de ejemplo `ADMIN` y uno `CUSTOMER`, con contraseñas almacenadas únicamente como hashes.
- Tres productos activos destacados con fechas deterministas.
- Tres categorías importantes con posiciones editoriales 1, 2 y 3.

Los assets serán propios, generados o aprobados para el proyecto y no usarán hotlinks. El seed nunca se ejecutará automáticamente en producción y una segunda ejecución no duplicará registros ni archivos.

#### Composición comercial de la landing

```text
1. Productos destacados:         hasta 3, featuredAt descendente
2. Productos recientes:          hasta 9, createdAt descendente
                                  sin repetir los destacados
3. Categorías importantes:       entre 2 y 3, orden configurado
   Productos por categoría:      hasta 3 recientes
```

Las secciones de categorías pueden volver a mostrar productos anteriores porque aportan contexto editorial. Si una categoría no tiene productos activos, se omite sin alterar el orden persistido de las restantes. Ninguna sección de la landing muestra paginador.

### 4. Lista de deseos

La wishlist forma parte de `product-catalog` y está disponible únicamente para clientes autenticados:

- Cada cliente consulta y modifica solo su propia lista.
- Un producto no puede aparecer duplicado para el mismo cliente.
- La lista persiste entre sesiones.
- Guardar un producto no reserva ni descuenta stock.
- Los productos agotados o inactivos permanecen visibles como no disponibles.
- Agregar desde deseos al carrito vuelve a validar producto, cantidad y stock.
- Agregar al carrito no elimina automáticamente el producto guardado.

### 5. Paginación

Todas las colecciones potencialmente grandes usarán paginación ejecutada por el backend. Esto incluye usuarios, productos, categorías, etiquetas, wishlist, balances, movimientos, órdenes y facturas.

El API devolverá conceptualmente:

```text
items
page
pageSize
totalItems
totalPages
```

Los controles mostrarán:

- Primera página.
- Página anterior.
- Hasta cuatro páginas anteriores a la actual.
- Página actual destacada.
- Hasta cuatro páginas posteriores.
- Página siguiente.
- Última página.
- Elipsis cuando existan páginas omitidas.

Ejemplo para la página 10 de 25:

```text
[Primera] [Atras] 1 ... 6 7 8 9 [10] 11 12 13 14 ... 25 [Siguiente] [Ultima]
```

Búsqueda, filtros, orden, página y tamaño vivirán en query parameters de la URL. Cambiar un criterio reiniciará la lista a la primera página.

### 6. Carrito y checkout

Especificación: [`shopping-cart-checkout/spec.md`](openspec/changes/build-technology-ecommerce-platform/specs/shopping-cart-checkout/spec.md)

- Cada cliente tiene como máximo un carrito activo.
- Se pueden agregar, modificar y eliminar líneas.
- El navbar muestra la suma total de unidades del carrito.
- La cantidad mínima es uno.
- No se permiten cantidades superiores al stock conocido.
- El API vuelve a validar disponibilidad aunque el frontend ya la haya comprobado.
- Los subtotales y el total se recalculan automáticamente.
- Las operaciones muestran mensajes flash accesibles.
- Eliminar una línea exige confirmación modal previa.
- El backend es la fuente autoritativa de precios y totales.
- El checkout revalida identidad, productos activos, precios, cantidades y stock.
- Se seleccionan métodos ficticios de pago y envío.
- El resultado del pago se modela separado del estado de la orden.
- Un pago rechazado no crea una orden confirmada ni descuenta stock.
- Una clave de idempotencia evita duplicados ante reintentos.

### 7. Órdenes

Especificación: [`order-management/spec.md`](openspec/changes/build-technology-ecommerce-platform/specs/order-management/spec.md)

Una orden contiene:

- Número único.
- Cliente.
- Líneas con snapshots de producto y SKU.
- Cantidades, precios, impuestos, moneda y totales históricos.
- Snapshot de dirección.
- Snapshot de la empresa emisora.
- Método y costo de envío.
- Referencia y estado del pago.
- Estado operativo independiente.
- Fechas y trazabilidad de transiciones.

Estados iniciales:

```text
PROCESSING --> INVOICED --> COMPLETED
     |
     +--> CANCELLED, cuando la transición sea válida
```

Reglas:

- El cliente consulta únicamente “Mis compras” y sus detalles.
- `ADMIN` consulta y gestiona todas las órdenes.
- `BILLING` consulta órdenes y ejecuta operaciones de facturación, pero no las cancela ni completa.
- Las listas del back office tienen búsqueda superior, filtros colapsables y paginación backend.
- Una cancelación registra motivo y actor.
- Si la orden consumió stock, cancelar genera una restitución exactamente una vez.
- Editar después el producto o usuario no altera la orden histórica.

### 8. Inventario

Especificación: [`inventory-control/spec.md`](openspec/changes/build-technology-ecommerce-platform/specs/inventory-control/spec.md)

El stock está separado del producto comercial:

```text
Product 1 ---- 1 InventoryBalance
                    |
                    +---- * InventoryMovement
```

Cada movimiento registra:

- Tipo.
- Cantidad.
- Motivo.
- Referencia de negocio.
- Autor.
- Fecha.

Reglas transaccionales:

- Ajustar stock requiere un movimiento auditable.
- El balance nunca puede quedar negativo.
- Los balances se bloquean en un orden estable durante checkout.
- Dos compras concurrentes no pueden consumir la misma última unidad.
- Una compra aprobada genera un único movimiento de salida vinculado a la orden.
- Una cancelación elegible genera un movimiento compensatorio idempotente.
- Facturar una orden no genera un segundo descuento.
- Una factura manual no reserva, descuenta ni repone inventario.
- Balances y movimientos se buscan, filtran, ordenan y paginan desde el backend.

### 9. Facturación

Especificación: [`billing-invoicing/spec.md`](openspec/changes/build-technology-ecommerce-platform/specs/billing-invoicing/spec.md)

Orden y factura permanecen separadas:

```text
Order              Payment             Invoice
-----              -------             -------
flujo comercial    resultado pago      documento contable
productos          metodo              numero
envio              estado              lineas y totales
estado operativo   referencia          estado de cobro
```

Una factura puede originarse:

1. Desde una orden elegible.
2. Manualmente, seleccionando un cliente y definiendo líneas.

#### Factura desde orden

- Solo `ADMIN` o `BILLING` pueden generarla.
- La factura copia snapshots de la orden.
- La factura y el cambio de la orden a `INVOICED` ocurren atómicamente.
- Una orden no puede producir dos facturas activas.
- Si el pago ya está aprobado, la factura puede quedar `PAID`.
- Si no está aprobado, queda `PENDING_PAYMENT`.
- El inventario no cambia.

#### Factura manual

- Puede ser creada por `ADMIN` o `BILLING`.
- Tiene origen `MANUAL`.
- Requiere cliente y líneas válidas.
- Usa autocomplete remoto, limitado y paginado para seleccionar clientes y productos.
- El API revalida los identificadores seleccionados y no confía en el texto mostrado.
- No necesita una orden.
- No modifica inventario.

Estados iniciales:

```text
DRAFT --> PENDING_PAYMENT --> PAID
   |
   +--> VOID, cuando la transición sea válida
```

Las facturas emitidas tienen numeración única y snapshots del emisor, cliente, líneas, precios, impuestos, moneda y totales. El perfil empresarial incluye al menos nombre comercial, razón social, identificador fiscal, dirección física y logo; solo `ADMIN` lo modifica y `BILLING` puede consultarlo para facturación.

### 10. Exportación documental

Especificación: [`document-export/spec.md`](openspec/changes/build-technology-ecommerce-platform/specs/document-export/spec.md)

- El backend genera PDFs de órdenes y facturas.
- Los documentos se construyen desde snapshots históricos.
- Los documentos incluyen la identidad empresarial histórica correspondiente.
- Regenerar un PDF no incorpora cambios posteriores de productos o clientes.
- Las facturas `DRAFT` muestran una marca visible de borrador.
- `CUSTOMER` descarga únicamente documentos propios.
- `ADMIN` y `BILLING` descargan documentos dentro de su ámbito autorizado.
- Usuarios no autenticados o clientes ajenos reciben acceso denegado.
- La primera versión genera PDFs bajo demanda mediante un adaptador reemplazable.

## Modelo general del dominio

```text
User --> Session
  |
  +--> Wishlist --> WishlistItem --> Product --> ProductImage
  |                                  |    |
  |                                  |    +--> Category
  |                                  |    +--> ProductTag --> Tag
  |                                  v
  |                            InventoryBalance
  |                                  |
  |                                  v
  |                            InventoryMovement
  |
  +--> Cart --> CartItem --> Product
  |
  +--> Order --> OrderItem
          |
          +--> Payment
          |
          +--> Invoice --> InvoiceLine

StoreProfile --> issuer snapshots --> Order / Invoice / PDF
Admin/Billing --> AuditEntry
Checkout      --> IdempotencyRecord
```

Entidades mínimas planificadas:

- `User`
- `Session`
- `RoleAssignment`
- `Product`
- `ProductImage`
- `Category`
- `Tag`
- `ProductTag`
- `Wishlist`
- `WishlistItem`
- `InventoryBalance`
- `InventoryMovement`
- `Cart`
- `CartItem`
- `Order`
- `OrderItem`
- `Payment`
- `Invoice`
- `InvoiceLine`
- `StoreProfile`
- `AuditEntry`
- `IdempotencyRecord`

## Flujo principal de compra

```text
Customer
   |
   v
Active Cart
   |
   v
Checkout
   |
   +--> Revalidar productos y precios
   +--> Bloquear y validar stock
   +--> Simular pago y envio
   +--> Crear Order + Payment
   +--> Descontar inventario
   +--> Cerrar carrito
   +--> Guardar resultado idempotente
```

Para un pago aprobado, la creación de orden, descuento de stock, movimientos y cierre del carrito se confirma transaccionalmente. Un error revierte todo el conjunto.

No se reserva stock al agregar al carrito. Esa decisión evita que carritos abandonados bloqueen productos; las reservas con vencimiento quedarían para una evolución con pagos reales pendientes.

## Flujo de facturación

```text
Order PROCESSING
       |
       | Admin o Billing
       v
Create Invoice
       |
       +--> Invoice PENDING_PAYMENT o PAID
       +--> Order INVOICED
       +--> Inventory unchanged
```

La conversión de orden a factura es atómica. La facturación consume el snapshot de la venta, pero no vuelve a ejecutar la venta ni modifica existencias.

## Sistema de layouts e interacción

Las dos aplicaciones comparten primitivas visuales desde `packages/ui`, pero conservan shells independientes:

```text
StorefrontShell
  Header / Navbar: logo SVG, tienda, inicio, cuenta, login/logout, carrito
  Hero: fondo tecnológico semitransparente y búsqueda
  Main: catálogo con filtros izquierdos colapsables
  Footer

BackofficeShell
  Sidebar izquierdo: navegación de Admin o Billing
  Header contextual
  Main: búsqueda sobre la lista y tabla paginada
  Sidebar derecho: filtros colapsables
```

En pantallas pequeñas, los sidebars se convierten en drawers accesibles. El estado de búsqueda, filtros, ordenamiento y página vive en la URL; la apertura visual de paneles puede ser estado local o Zustand si varios componentes deben compartirla.

Los mensajes flash usan una región `aria-live` y se originan desde handlers o callbacks de mutación. Las eliminaciones y desactivaciones requieren un modal Tailwind accesible con control de foco, teclado, cancelación sin efectos y protección frente a envíos duplicados.

### Identidades visuales y temas

El storefront tendrá una apariencia comercial típica de un e-commerce tecnológico: imágenes y tarjetas de producto protagonistas, espacios generosos, contenido destacado, precio, stock y llamadas a la compra claramente jerarquizadas.

El backoffice tendrá una apariencia minimalista, elegante y empresarial: paleta neutral basada en slate, navy y azul, mayor densidad operativa, tablas compactas, tarjetas KPI, navegación sobria y colores semánticos para estados.

Se contemplan cuatro combinaciones visuales independientes:

```text
Storefront claro     Storefront oscuro
Backoffice claro     Backoffice oscuro
```

Cada aplicación usa sus propios tokens semánticos y guarda su preferencia por separado. En la primera visita se respeta `prefers-color-scheme`; una selección explícita prevalece posteriormente. El tema se aplica antes de la primera presentación visible para evitar parpadeos durante la hidratación.

Todos los temas deben cubrir navbar, hero, tarjetas, dashboard, gráficos, tablas, formularios, sidebars, drawers, modales, mensajes y estados interactivos con contraste WCAG AA, foco visible y significado no dependiente únicamente del color.

### Dashboard del backoffice

El dashboard inicial adapta indicadores y accesos al rol:

- `ADMIN`: clientes totales, productos activos, stock bajo o agotado, órdenes en proceso y facturas pendientes.
- `BILLING`: órdenes elegibles o pendientes de facturar, facturas pendientes y facturas pagadas.

Los indicadores son informativos y enlazan a las listas filtradas autoritativas. Cada resumen muestra su período o fecha de actualización.

## API REST planificada

Todas las rutas se ubican bajo `/api/v1`. El mapa es planificación; OpenAPI será el contrato autoritativo cuando se implemente.

### Salud y autenticación

- `GET /health`
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`

### Usuarios

- `GET /users`
- `POST /users`
- `GET /users/:userId`
- `PATCH /users/:userId`
- `DELETE /users/:userId`

### Productos, categorías y etiquetas

- `GET /catalog/landing`
- `GET /products`
- `POST /products`
- `GET /products/:productId`
- `PATCH /products/:productId`
- `DELETE /products/:productId`
- `PATCH /products/:productId/status`
- `POST /products/:productId/images`
- `PATCH /products/:productId/images/:imageId`
- `DELETE /products/:productId/images/:imageId`
- `GET|POST /categories`
- `GET|PATCH|DELETE /categories/:categoryId`
- `GET|POST /tags`
- `GET|PATCH|DELETE /tags/:tagId`

Los listados devuelven `coverImage`; el detalle devuelve `images` ordenadas. El detalle público se resolverá también mediante slug conforme al contrato OpenAPI definitivo. Las consultas de productos aceptarán búsqueda, categoría, etiquetas, disponibilidad, rango de precio, orden y paginación.

`GET /catalog/landing` devuelve `featuredProducts`, `latestProducts` y `highlightedCategories` en una única respuesta pública. Los `PATCH` existentes de productos y categorías administran `isFeatured`, `featuredAt`, `showOnLanding` y `landingOrder` con autorización `ADMIN`.

### Wishlist, carrito y checkout

- `GET /wishlist`
- `POST /wishlist/items`
- `DELETE /wishlist/items/:productId`
- `GET /cart`
- `POST /cart/items`
- `PATCH /cart/items/:itemId`
- `DELETE /cart/items/:itemId`
- `POST /checkout`, con cabecera `Idempotency-Key`

### Inventario

- `GET /inventory`
- `GET /inventory/:productId/movements`
- `POST /inventory/:productId/adjustments`

### Órdenes y facturas

- `GET /orders`
- `GET /orders/mine`
- `GET /orders/:orderId`
- `PATCH /orders/:orderId/status`
- `POST /orders/:orderId/cancel`
- `POST /orders/:orderId/invoice`
- `GET /orders/:orderId/pdf`
- `GET /invoices`
- `POST /invoices`
- `GET /invoices/:invoiceId`
- `PATCH /invoices/:invoiceId/status`
- `GET /invoices/:invoiceId/pdf`

### Perfil empresarial

- `GET /store-profile`
- `PATCH /store-profile`

Los autocompletes de facturación reutilizan `GET /users` y `GET /products` con `search`, filtros autorizados y un `pageSize` reducido; no descargan colecciones completas.

### Dashboard

- `GET /dashboard/summary`: resumen administrativo agregado y autorizado por rol; rechaza a `CUSTOMER`.

## Convenciones del API

- Prefijo versionado `/api/v1`.
- Contrato documentado con OpenAPI.
- Cliente frontend generado desde el contrato.
- Respuestas externas validadas con Zod.
- Errores uniformes con código estable, mensaje seguro, detalles de campo y correlation ID.
- Respuestas paginadas uniformes con `items`, `page`, `pageSize`, `totalItems` y `totalPages`.
- Campos ordenables definidos explícitamente por endpoint.
- Claves de idempotencia en checkout y operaciones compensatorias críticas.
- Autorización y propiedad verificadas en el backend.

## Convenciones de frontend

- Código exclusivamente TypeScript en `.ts` y `.tsx`.
- Componentes pequeños y con una sola responsabilidad.
- Estado remoto gestionado con TanStack Query.
- Zustand reservado para estado global puramente cliente; no duplica carrito, órdenes o inventario remotos.
- Formularios con React Hook Form y esquemas Zod.
- Tailwind como sistema de estilos.
- Shells separados para storefront y backoffice sobre primitivas compartidas.
- Sidebars y modales accesibles con foco visible, teclado y adaptación responsive.
- Mensajes flash generados en handlers o callbacks de mutación, no derivados mediante effects.
- Búsqueda, filtros, ordenamiento y página sincronizados con la URL.
- Autocomplete remoto mediante custom hook con término mínimo, espera breve y cancelación de solicitudes obsoletas.
- Tokens visuales independientes para storefront y backoffice, con variantes claras y oscuras propias.
- Switch de tema accesible, preferencia inicial del sistema, persistencia independiente y aplicación previa a la hidratación visible.
- Zustand limitado al estado visual del tema; la preferencia no requiere PostgreSQL ni Server Actions.
- Las tarjetas renderizan únicamente `coverImage`; el detalle consume la colección `images` ordenada.
- La galería evita autoplay, permite miniaturas, anterior/siguiente, teclado y gestos, y carga diferidamente imágenes no visibles.
- La landing consume `GET /catalog/landing` y respeta el orden destacados, recientes y categorías importantes sin renderizar paginadores.
- Los recientes excluyen los IDs destacados; las categorías se renderizan independientemente y pueden repetir productos anteriores.
- Estado inmutable; no se mutan objetos ni arrays directamente.
- `useEffect` solo sincroniza con sistemas externos.
- Los cálculos derivados se realizan durante render o en handlers.
- La lógica causada por una interacción vive en el event handler correspondiente.
- Hooks reutilizables para lógica compartida.
- `useMemo` solo para cálculos costosos o estabilidad referencial necesaria.
- Ningún hook se ejecuta en bucles, condicionales o funciones anidadas.

## Seguridad

- Contraseñas almacenadas únicamente como hashes resistentes.
- Credenciales de corta duración y renovación protegida.
- Cookies persistentes con `HttpOnly`, `Secure` y política `SameSite` apropiada.
- CORS limitado a orígenes configurados.
- Protección CSRF donde corresponda.
- Limitación de intentos de autenticación.
- Ningún secreto, contraseña o token se registra en logs.
- Operaciones sensibles registradas en auditoría.
- Correlation IDs propagados en las solicitudes.
- Pruebas negativas para elevación de rol y acceso cruzado entre clientes.

## Auditoría y observabilidad

Se auditarán al menos:

- Creación, cambio de rol y desactivación de usuarios.
- Creación, modificación, activación y eliminación lógica de productos.
- Creación y cambios de categorías y etiquetas.
- Cambios del perfil empresarial.
- Ajustes y movimientos de inventario.
- Transiciones y cancelaciones de órdenes.
- Creación, emisión, pago y anulación de facturas.

Cada entrada contendrá actor, acción, entidad, referencia, fecha y cambios relevantes sin incluir secretos.

El API emitirá logs estructurados, correlation IDs y métricas para autenticación, checkout, inventario, órdenes y facturación.

## Estrategia de pruebas

- Pruebas unitarias para permisos, totales y máquinas de estado.
- Pruebas de integración con PostgreSQL para migraciones, restricciones y transacciones.
- Pruebas concurrentes para la última unidad disponible.
- Pruebas de idempotencia de checkout y cancelación.
- Pruebas de contrato entre OpenAPI, API y cliente generado.
- Pruebas de componentes para formularios, catálogo, carrito y paginación.
- Pruebas de accesibilidad y responsive para shells, sidebars, drawers, modales y mensajes.
- Pruebas de contraste, temas, persistencia, hidratación y regresión visual para las cuatro combinaciones de interfaz.
- Pruebas de contrato y autorización negativa para el resumen del dashboard.
- Pruebas de seed, portada única, orden de imágenes, fallback, galería, sección de 9 productos recientes y catálogo completo.
- Pruebas de productos destacados, máximo de 3 categorías importantes, orden editorial, deduplicación entre destacados y recientes y endpoint agregado de landing.
- Pruebas end-to-end de registro, compra, historial, administración, wishlist, perfil empresarial, autocomplete y facturación.
- Pruebas negativas de roles, propiedad y fuga de datos.
- Lint, typecheck y builds de producción para todas las aplicaciones.

## Hoja de ruta de implementación

La lista normativa y verificable se encuentra en [`tasks.md`](openspec/changes/build-technology-ecommerce-platform/tasks.md). El trabajo se divide en veintiuna etapas:

1. Fundaciones del monorepo y aplicaciones base.
2. Persistencia, migraciones, contratos OpenAPI y límites de dependencias.
3. Identidad, sesión, roles y administración de usuarios.
4. Catálogo e inventario en el API.
5. Storefront, detalle, buscador, filtros, paginación y back office de productos.
6. Carrito, pago simulado, envío y checkout transaccional.
7. Historial y administración de órdenes.
8. Facturación manual y desde órdenes.
9. Exportación PDF de órdenes y facturas.
10. Auditoría, observabilidad y calidad integral.
11. Contenedores, CI, health checks y preparación de despliegue.
12. Layouts, navegación y retroalimentación compartida.
13. Categorías, etiquetas y slugs.
14. Lista de deseos.
15. Perfil empresarial y snapshots.
16. Listas, sidebars y paginación uniforme.
17. Autocomplete para facturación manual.
18. Validación integral de las revisiones y actualización documental.
19. Identidades visuales, temas y dashboard.
20. Seed demostrativo, imágenes y navegación del catálogo.
21. Productos destacados y categorías importantes.

Cada una de las 135 tareas incluye una forma concreta de verificación mediante pruebas, comandos, comportamiento observable o artefactos entregados.

## Fuera del alcance inicial

- Pagos reales.
- Proveedores reales de despacho.
- Integración tributaria o factura electrónica legal.
- Variantes de producto por color, RAM o almacenamiento.
- Múltiples almacenes.
- Promociones, cupones o listas de precios múltiples.
- Microservicios.
- Reservas de inventario con expiración.
- Generación PDF asíncrona mediante workers, salvo que el volumen la vuelva necesaria.

Estas funcionalidades pueden añadirse mediante cambios OpenSpec posteriores sin alterar las reglas centrales del MVP.

## Riesgos principales

- Alcance amplio: se mitigará con entregas verticales y módulos utilizables de forma incremental.
- Concurrencia de inventario: transacciones cortas, bloqueos ordenados y pruebas simultáneas.
- Duplicación entre dos aplicaciones Next.js: paquetes compartidos de UI y configuración.
- Acoplamiento del monolito: contratos internos y reglas de dependencia.
- Costo de generación PDF: adaptador sustituible y futura ejecución asíncrona.
- Limitaciones de pagos simulados: puerto reemplazable por un proveedor real.
- Facturación no tributaria: cualquier integración legal será una capacidad futura separada.
- Complejidad de sidebars responsive: navegación izquierda, filtros derechos y drawers probados con teclado.
- Ruido de mensajes flash: deduplicación, duración limitada y errores accionables.
- Slugs publicados: no se regeneran automáticamente al cambiar nombres.
- Perfil empresarial incompleto: validación obligatoria antes de checkout o emisión.
- Carga de autocompletes: término mínimo, espera breve, cancelación, límites e índices de búsqueda.
- Mantenimiento de cuatro combinaciones visuales: primitivas compartidas, tokens separados y regresión visual por aplicación y tema.
- Parpadeo o discrepancia de tema durante hidratación: aplicación temprana de la preferencia y pruebas SSR.
- Resumen administrativo desactualizado: fecha visible, caché breve y enlaces a listas autoritativas.
- Fuga de indicadores entre roles: respuestas específicas por rol y pruebas negativas para `CUSTOMER`.
- Volumen del seed de imágenes: assets optimizados, manifiesto estable y cargas idempotentes.
- Conflictos al reordenar imágenes o cambiar portada: restricciones y transacción backend.
- Credenciales seed conocidas: bloqueo estricto en producción y ausencia de secretos en logs.
- Accesibilidad o rendimiento del carrusel: sin autoplay, navegación por teclado, dimensiones reservadas y lazy loading.
- Sección de recientes incompleta por exclusión: consultar suficientes candidatos antes de aplicar el límite de 9.
- Configuración editorial parcial: advertir al administrador y tolerar temporalmente menos de 2 categorías visibles.
- Costo del endpoint agregado: límites pequeños, índices dedicados y caché pública breve con invalidación editorial.

## Continuar con la implementación

La planificación está lista para revisión. La implementación debe iniciarse en una nueva solicitud mediante el flujo de aplicación:

```text
$openspec-apply-change build-technology-ecommerce-platform
```

El flujo de aplicación deberá ejecutar las tareas en orden, marcar el progreso en `tasks.md` y mantener las especificaciones como contrato de aceptación.
