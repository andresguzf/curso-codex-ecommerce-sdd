# Technology E-commerce Platform

Aplicación e-commerce para comercializar un catálogo de productos tecnológicos. El proyecto se diseñó como un monorepo con dos aplicaciones frontend en Next.js, un backend REST independiente y PostgreSQL como base de datos transaccional.

> Estado actual: planificación completada. Todavía no se ha implementado código funcional.

La propuesta OpenSpec activa es [`build-technology-ecommerce-platform`](openspec/changes/build-technology-ecommerce-platform/). Sus cuatro tipos de artefactos están completos y la validación estricta es exitosa.

## Objetivo

Construir una plataforma que cubra de forma coherente:

- Storefront público con landing page, hero y catálogo de tecnología.
- Registro, autenticación, sesiones y autorización por roles.
- Búsqueda, filtros, ordenamiento, paginación y detalle de productos.
- Carrito persistente y checkout con pagos y envíos simulados.
- Historial y administración de órdenes.
- Control de inventario consistente y auditable.
- Facturación manual o derivada de órdenes.
- Exportación PDF de órdenes y facturas.
- Back office separado para administración y facturación.

El diseño busca preservar consistencia entre compra, orden, inventario y facturación sin asumir microservicios ni integraciones externas prematuras.

## Estado de OpenSpec

| Artefacto | Estado | Propósito |
|---|---|---|
| [`proposal.md`](openspec/changes/build-technology-ecommerce-platform/proposal.md) | Completo | Motivación, alcance, capacidades e impacto |
| [`design.md`](openspec/changes/build-technology-ecommerce-platform/design.md) | Completo | Arquitectura, decisiones, riesgos y despliegue |
| [`specs/`](openspec/changes/build-technology-ecommerce-platform/specs/) | Completo | Requisitos observables y escenarios verificables |
| [`tasks.md`](openspec/changes/build-technology-ecommerce-platform/tasks.md) | Completo | 67 tareas de implementación con verificación |

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
| Catálogo público | Sí | Sí | Lectura opcional |
| Carrito y checkout | Sí | Opcional | No |
| Consultar compras propias | Sí | No aplica | No aplica |
| Consultar todas las órdenes | No | Sí | Sí |
| Cambiar estados operativos de órdenes | No | Sí | No |
| Facturar una orden | No | Sí | Sí |
| CRUD de productos | No | Sí | No |
| Ajustar inventario | No | Sí | No |
| Administrar usuarios y roles | No | Sí | No |
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
- Protección del último administrador.
- Aislamiento de datos entre clientes.
- Cookies protegidas, CORS, CSRF y limitación de intentos de autenticación.

### 2. Catálogo de productos

Especificación: [`product-catalog/spec.md`](openspec/changes/build-technology-ecommerce-platform/specs/product-catalog/spec.md)

Cada producto tendrá al menos:

- ID.
- SKU único.
- Nombre.
- Descripción.
- Precio no negativo.
- Moneda.
- Imagen e información alternativa para accesibilidad.
- Stock disponible proyectado desde inventario.
- Fecha de creación.
- Fecha de actualización.
- Estado `ACTIVE` o `INACTIVE`.
- Marca de eliminación lógica cuando corresponda.

El storefront incluirá:

- Landing page con hero.
- Listado de productos activos.
- Tarjetas de producto.
- Búsqueda por nombre, descripción o SKU.
- Filtros por disponibilidad y criterios permitidos.
- Ordenamiento por campos explícitamente autorizados.
- Detalle con imagen, descripción, precio y stock.
- Indicación de producto agotado.
- Acción de compra deshabilitada cuando no exista disponibilidad.

El back office permitirá exclusivamente a `ADMIN`:

- Listar productos activos, inactivos y archivados según filtros.
- Crear y editar productos.
- Activar y desactivar productos.
- Eliminar productos lógicamente.
- Gestionar imágenes.
- Ajustar inventario mediante operaciones separadas del formulario comercial.

### 3. Paginación

Las listas administrativas usarán paginación basada en página y tamaño porque necesitan conocer la primera página, la última y el total.

El API devolverá conceptualmente:

```text
items
pagination:
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

### 4. Carrito y checkout

Especificación: [`shopping-cart-checkout/spec.md`](openspec/changes/build-technology-ecommerce-platform/specs/shopping-cart-checkout/spec.md)

- Cada cliente tiene como máximo un carrito activo.
- Se pueden agregar, modificar y eliminar líneas.
- La cantidad mínima es uno.
- No se permiten cantidades superiores al stock conocido.
- El API vuelve a validar disponibilidad aunque el frontend ya la haya comprobado.
- Los subtotales y el total se recalculan automáticamente.
- El backend es la fuente autoritativa de precios y totales.
- El checkout revalida identidad, productos activos, precios, cantidades y stock.
- Se seleccionan métodos ficticios de pago y envío.
- El resultado del pago se modela separado del estado de la orden.
- Un pago rechazado no crea una orden confirmada ni descuenta stock.
- Una clave de idempotencia evita duplicados ante reintentos.

### 5. Órdenes

Especificación: [`order-management/spec.md`](openspec/changes/build-technology-ecommerce-platform/specs/order-management/spec.md)

Una orden contiene:

- Número único.
- Cliente.
- Líneas con snapshots de producto y SKU.
- Cantidades, precios, impuestos, moneda y totales históricos.
- Snapshot de dirección.
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
- Una cancelación registra motivo y actor.
- Si la orden consumió stock, cancelar genera una restitución exactamente una vez.
- Editar después el producto o usuario no altera la orden histórica.

### 6. Inventario

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

### 7. Facturación

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
- No necesita una orden.
- No modifica inventario.

Estados iniciales:

```text
DRAFT --> PENDING_PAYMENT --> PAID
   |
   +--> VOID, cuando la transición sea válida
```

Las facturas emitidas tienen numeración única y snapshots del emisor, cliente, líneas, precios, impuestos, moneda y totales.

### 8. Exportación documental

Especificación: [`document-export/spec.md`](openspec/changes/build-technology-ecommerce-platform/specs/document-export/spec.md)

- El backend genera PDFs de órdenes y facturas.
- Los documentos se construyen desde snapshots históricos.
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
  +--> Cart --> CartItem --> Product --> ProductImage
  |                             |
  |                             v
  |                       InventoryBalance
  |                             |
  |                             v
  |                       InventoryMovement
  |
  +--> Order --> OrderItem
          |
          +--> Payment
          |
          +--> Invoice --> InvoiceLine

Admin/Billing --> AuditEntry
Checkout      --> IdempotencyRecord
```

Entidades mínimas planificadas:

- `User`
- `Session`
- `RoleAssignment`
- `Product`
- `ProductImage`
- `InventoryBalance`
- `InventoryMovement`
- `Cart`
- `CartItem`
- `Order`
- `OrderItem`
- `Payment`
- `Invoice`
- `InvoiceLine`
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

## Convenciones del API

- Prefijo versionado `/api/v1`.
- Contrato documentado con OpenAPI.
- Cliente frontend generado desde el contrato.
- Respuestas externas validadas con Zod.
- Errores uniformes con código estable, mensaje seguro, detalles de campo y correlation ID.
- Paginación numérica con `page`, `pageSize`, `totalItems` y `totalPages`.
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
- Pruebas end-to-end de registro, compra, historial, administración y facturación.
- Pruebas negativas de roles, propiedad y fuga de datos.
- Lint, typecheck y builds de producción para todas las aplicaciones.

## Hoja de ruta de implementación

La lista normativa y verificable se encuentra en [`tasks.md`](openspec/changes/build-technology-ecommerce-platform/tasks.md). El trabajo se divide en once etapas:

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

Cada una de las 67 tareas incluye una forma concreta de verificación mediante pruebas, comandos, comportamiento observable o artefactos entregados.

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

## Continuar con la implementación

La planificación está lista para revisión. La implementación debe iniciarse en una nueva solicitud mediante el flujo de aplicación:

```text
$openspec-apply-change build-technology-ecommerce-platform
```

El flujo de aplicación deberá ejecutar las tareas en orden, marcar el progreso en `tasks.md` y mantener las especificaciones como contrato de aceptación.
