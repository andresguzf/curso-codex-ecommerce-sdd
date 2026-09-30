# Dashboard inicial del backoffice — tarea 19.6

El inicio `/` reemplaza la pantalla provisional por un resumen empresarial con datos de `GET /api/v1/dashboard/summary`. Conserva la autenticación existente y no consulta datos privados antes de validar el acceso.

## Comportamiento

- ADMIN: clientes, productos activos, stock bajo o agotado, órdenes en proceso y facturas pendientes.
- BILLING: órdenes elegibles y pendientes de facturar, facturas pendientes y pagadas. Sin tarjetas ni accesos de usuarios, catálogo o inventario.
- Carga accesible, error seguro, reintento, valores cero con orientación y actualización manual.
- Fecha de actualización y período de pagos visibles, con zona UTC explícita.
- Respuesta validada con Zod y comprobación adicional de que el rol coincide con la sesión.
- TanStack Query separa la caché por cuenta y rol, cancela solicitudes obsoletas, limita las solicitudes a diez segundos y elimina datos privados al quedar sin observadores. No persiste tokens ni métricas.
- Las tarjetas reutilizan AdminMetricCard y los tokens semánticos de ambos temas administrativos; no se añaden tendencias, importes o gráficos ficticios.

## Accesos

Clientes filtra CUSTOMER; productos filtra ACTIVE; órdenes filtra PROCESSING; facturas filtra PENDING_PAYMENT o PAID. Las órdenes de BILLING también filtran NO_ACTIVE_INVOICE.

Los filtros existentes no admiten exactamente el umbral de stock ni el período por paidAt. La UI lo indica: inventario abre productos activos ordenados de menor a mayor cantidad, y facturas pagadas abre todas las PAID. No se inventan parámetros ignorados por el backend ni se presentan estos enlaces como listas exactas del indicador.

Los conteos son informativos; toda mutación conserva su autorización y revalidación en el API.

## Archivos

Agregados:

- `apps/backoffice/src/features/dashboard/dashboard-api.ts`
- `apps/backoffice/src/features/dashboard/use-dashboard-summary.ts`
- `apps/backoffice/src/features/dashboard/dashboard-cards.ts`
- `apps/backoffice/src/features/dashboard/dashboard.tsx`
- `apps/backoffice/test/dashboard-api.spec.ts`
- `apps/backoffice/test/dashboard.spec.tsx`
- `e2e/frontend/backoffice-dashboard.spec.ts`
- `docs/backoffice-dashboard.md`

Actualizados:

- `apps/backoffice/src/app/page.tsx`
- `e2e/frontend/catalog-api-fixture.ts`
- `e2e/playwright.config.ts`
- `openspec/changes/build-technology-ecommerce-platform/tasks.md`

Las pruebas verifican métricas y permisos, URLs filtradas, carga/error/vacío, reintento y actualización, validación REST y aislamiento entre cuentas. Las pruebas de navegador cubren ADMIN/BILLING, claro/oscuro y 375/1440 px, con contraste, teclado, ausencia de desbordamiento y navegación a órdenes.

Verificación completada: 118 pruebas de backoffice (17 nuevas), 29 pruebas de navegador (8 nuevas de dashboard), lint, typecheck, build de producción y validación OpenSpec estricta. Se inspeccionaron visualmente capturas de escritorio oscuro y móvil claro.

19.7 continúa pendiente; esta tarea no amplía los temas a otros componentes.
