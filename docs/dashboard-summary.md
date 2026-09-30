# Resumen administrativo — tarea 19.5

`GET /api/v1/dashboard/summary` requiere un access token de `ADMIN` o `BILLING`. `CUSTOMER` recibe `403 AUTH_FORBIDDEN`; sin sesión se responde `401 AUTH_INVALID_SESSION`. Los errores no contienen métricas.

## Contrato y criterios

La respuesta discrimina por `role` e incluye `updatedAt`, la fecha de la instantánea PostgreSQL en formato ISO con zona horaria. No se almacena en cachés HTTP (`Cache-Control: private, no-store`). El período no admite personalización.

| Rol | Métrica | Criterio |
| --- | --- | --- |
| ADMIN | `totalCustomers` | Cuentas CUSTOMER no eliminadas, incluidas inactivas y bloqueadas |
| ADMIN | `activeProducts` | Productos activos no eliminados |
| ADMIN | `lowStockProducts` | Productos activos no eliminados con hasta 5 unidades, incluidos agotados o sin balance |
| ADMIN | `processingOrders` | Órdenes PROCESSING |
| Ambos | `pendingInvoices` | Facturas PENDING_PAYMENT de cualquier origen o antigüedad |
| BILLING | `ordersAwaitingInvoice` | Órdenes PROCESSING sin factura distinta de VOID |
| BILLING | `ordersEligibleForInvoicing` | Las anteriores con pago registrado; la conversión revalida sus invariantes |
| BILLING | `paidInvoices` | Facturas actualmente PAID cuyo paidAt esté en los últimos 30 días |

ADMIN recibe `lowStockThreshold: 5`. BILLING recibe `period: { from, to, basis: "paidAt" }`, con extremos inclusivos y `to = updatedAt`. BILLING no recibe metadatos ni métricas de usuarios, catálogo o inventario.

Los indicadores son informativos. No autorizan mutaciones ni sustituyen las reglas transaccionales de facturación e inventario.

## Arquitectura y verificación

`DashboardSummaryService` coordina operaciones públicas de lectura de los cinco módulos sobre una sola transacción `REPEATABLE READ`, `READ ONLY`. BILLING no invoca lecturas de identidad, catálogo o inventario. Los conteos se calculan en PostgreSQL sin descargar colecciones.

El controlador aplica autenticación, autorización y documentación. OpenAPI usa variantes estrictas `oneOf` por rol; Zod rechaza campos ajenos, conteos incorrectos y fechas inválidas. El cliente TypeScript generado incorpora la ruta.

Las pruebas HTTP usan PostgreSQL aislado: respuestas vacías, conteos, stock, ausencia de balances, eliminación lógica, facturas VOID/DRAFT, pagos registrados, período paidAt, autorización y consistencia ante escrituras concurrentes. Las pruebas Zod cubren variantes válidas y datos inválidos.

La interfaz y accesos rápidos del dashboard corresponden a 19.6 y siguen pendientes.

Verificación completada: 229 pruebas del backend (incluidas 7 de dashboard), 38 de esquemas y 14 de cliente REST; lint, typecheck de las aplicaciones, generación/verificación OpenAPI y validación OpenSpec estricta exitosos.

## Archivos de esta tarea

Agregados:

- `apps/api/src/dashboard/dashboard.module.ts`
- `apps/api/src/dashboard/dashboard.controller.ts`
- `apps/api/src/dashboard/dashboard-summary.service.ts`
- `apps/api/src/identity-access/identity-summary.reader.ts`
- `apps/api/src/product-catalog/catalog-summary.reader.ts`
- `apps/api/src/inventory-control/inventory-summary.reader.ts`
- `apps/api/src/order-management/order-summary.reader.ts`
- `apps/api/src/billing-invoicing/billing-summary.reader.ts`
- `apps/api/test/dashboard/dashboard.integration.spec.ts`
- `packages/api-schemas/src/dashboard.ts`
- `packages/api-schemas/test/dashboard.spec.ts`
- `docs/dashboard-summary.md`

Actualizados:

- `apps/api/src/app.module.ts`
- `apps/api/src/identity-access/auth.module.ts`
- `apps/api/src/product-catalog/product-catalog.module.ts`
- `apps/api/src/inventory-control/inventory-control.module.ts`
- `apps/api/src/order-management/order-management.module.ts`
- `apps/api/src/billing-invoicing/billing-invoicing.module.ts`
- `apps/api/src/openapi/openapi.ts`
- `apps/api/openapi/openapi.json`
- `packages/api-client/src/generated/openapi.ts`
- `packages/api-schemas/src/index.ts`
- `openspec/changes/build-technology-ecommerce-platform/tasks.md`
