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

## Risks / Trade-offs

- [El alcance inicial abarca varios dominios] → Implementar en incrementos verticales y mantener cada módulo utilizable antes de avanzar al siguiente.
- [Bloqueos concurrentes pueden causar espera o deadlocks] → Bloquear productos en orden estable, mantener transacciones cortas, limitar reintentos y probar compras simultáneas.
- [Dos aplicaciones Next.js duplican configuración] → Centralizar UI y configuración, pero conservar fronteras de despliegue y permisos.
- [Un monolito modular puede degradarse en acoplamiento] → Aplicar reglas de dependencias, contratos de módulo y pruebas de arquitectura.
- [Los PDFs pueden consumir CPU o memoria] → Usar un adaptador, límites de tamaño y posibilidad futura de generación asíncrona.
- [Los pagos simulados no representan fallos reales] → Aislarlos detrás de un puerto de pago para reemplazarlos posteriormente sin alterar checkout.
- [La facturación no cumple normativa tributaria real] → Etiquetarla como facturación interna y tratar cualquier integración fiscal como cambio posterior.

## Migration Plan

1. Crear el workspace, configuración compartida, aplicaciones vacías, PostgreSQL local y pipeline de calidad.
2. Incorporar esquema inicial, migraciones, seed mínimo y módulos base del API.
3. Implementar identidad y autorización antes de exponer back office.
4. Entregar catálogo e inventario con interfaces públicas y administrativas.
5. Entregar carrito, checkout, pagos/envíos simulados y órdenes bajo pruebas transaccionales.
6. Entregar facturación, PDF, auditoría y flujos end-to-end.
7. Desplegar cada aplicación de manera independiente, ejecutar migraciones antes del API y habilitar storefront/backoffice después de verificaciones de salud.

Al ser un proyecto nuevo no existe migración de datos productivos. El rollback de cada despliegue volverá a la imagen anterior y solo revertirá migraciones cuando sean explícitamente reversibles; los cambios destructivos de esquema usarán expansión y contracción en entregas futuras.
