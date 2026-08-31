## Why

El proyecto necesita una base completa y coherente para operar un e-commerce de productos tecnológicos, cubriendo la experiencia de compra, la administración del catálogo y usuarios, el control de inventario y la facturación sin mezclar responsabilidades entre órdenes, pagos y facturas. Definir estas capacidades en conjunto permite que el futuro desarrollo preserve la consistencia del stock, la seguridad por roles y la separación obligatoria entre el frontend Next.js y el backend REST.

## What Changes

- Crear un monorepo con frontend Next.js y TypeScript, backend independiente mediante API REST y PostgreSQL como base de datos transaccional.
- Incorporar un storefront público con hero, catálogo paginado, búsqueda, filtros, ordenamiento, detalle de producto, disponibilidad, carrito y checkout con pagos y envíos simulados.
- Incorporar un back office para administrar usuarios, productos, inventario, órdenes y facturas según los roles `CUSTOMER`, `ADMIN` y `BILLING`.
- Implementar registro, login, logout, recuperación de sesión y autorización por roles, aplicando los permisos en el backend.
- Gestionar productos simples con SKU, nombre, descripción, precio, moneda, imagen, stock disponible, fechas y estado activo/inactivo, con eliminación lógica y trazabilidad.
- Gestionar un carrito por cliente, validar cantidades contra el stock, recalcular totales y crear órdenes mediante checkout idempotente.
- Mantener órdenes, pagos y facturas como conceptos independientes con estados y responsabilidades separados.
- Descontar inventario únicamente al confirmar una compra exitosa, impedir stock negativo y registrar movimientos compensatorios ante cancelaciones.
- Permitir que `ADMIN` y `BILLING` generen facturas desde órdenes o manualmente; las facturas manuales no alterarán inventario.
- Permitir la consulta y exportación PDF de órdenes y facturas con controles de acceso según propiedad y rol.
- Añadir auditoría para operaciones sensibles sobre usuarios, roles, productos, inventario, órdenes y facturas.

## Capabilities

### New Capabilities

- `identity-access`: Registro, autenticación, sesión, autorización con tres roles y administración del ciclo de vida de usuarios.
- `product-catalog`: Catálogo público y administrativo, detalle, búsqueda, filtros, ordenamiento, paginación y gestión de productos e imágenes.
- `shopping-cart-checkout`: Carrito persistente por cliente, validación de cantidades, cálculo de totales y checkout con pago y envío simulados.
- `order-management`: Creación, consulta, transición y administración de órdenes, incluyendo historial del cliente y snapshots comerciales.
- `inventory-control`: Existencias, validación concurrente, movimientos, ajustes y prevención de stock negativo.
- `billing-invoicing`: Facturación manual o desde órdenes, estados de factura y pago, numeración y separación explícita respecto de órdenes e inventario.
- `document-export`: Generación y descarga autorizada de órdenes y facturas en PDF.

### Modified Capabilities

- Ninguna; el proyecto todavía no contiene especificaciones funcionales existentes.

## Impact

- Nuevas aplicaciones de storefront, back office y API dentro del monorepo, con posibilidad de ejecutar procesos asíncronos de forma independiente.
- Nuevos contratos REST versionados y documentados mediante OpenAPI; el frontend no accederá directamente a PostgreSQL ni usará Server Actions para lógica de negocio o datos.
- Nuevo esquema PostgreSQL, migraciones, restricciones transaccionales, auditoría y almacenamiento de referencias a imágenes y documentos.
- Nuevas dependencias de frontend para React/Next.js, TypeScript, Tailwind, Zustand, Zod, React Hook Form y TanStack Query; y dependencias de backend para REST, persistencia, autenticación, OpenAPI y generación PDF.
- Nuevas suites de pruebas unitarias, integración, contrato y flujos end-to-end para seguridad, catálogo, checkout, concurrencia de inventario y facturación.
