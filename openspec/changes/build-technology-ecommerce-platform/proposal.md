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
- Incorporar shells y plantillas reutilizables para storefront y back office, con header, navegación, footer, logo SVG y layouts responsive.
- Incorporar en el storefront una navegación superior con enlaces de sesión y badge de cantidad del carrito, además de un hero tecnológico con imagen de fondo semitransparente y buscador.
- Incorporar filtros colapsables en un sidebar izquierdo del catálogo público y, en el back office, navegación colapsable a la izquierda, búsqueda sobre cada listado y filtros colapsables a la derecha.
- Estandarizar todas las colecciones potencialmente grandes con búsqueda, filtros, ordenamiento y paginación ejecutados por el backend usando la navegación numérica ya definida.
- Incorporar mensajes flash reutilizables para autenticación, operaciones de catálogo y mutaciones del carrito, además de confirmación modal para toda acción destructiva.
- Incorporar una lista de deseos persistente para cada cliente, con acciones para agregar o retirar productos y mover productos disponibles al carrito.
- Ampliar el catálogo con slugs únicos, categorías administrables y etiquetas asociables a productos.
- Incorporar un perfil único de la empresa con nombre comercial, razón social, identificador fiscal, dirección física y logo, administrable desde el back office y preservado como snapshot en órdenes y facturas.
- Incorporar autocompletado remoto y paginado de clientes y productos al crear facturas manuales.
- Diferenciar por completo la identidad visual del storefront y del back office: el storefront tendrá una experiencia comercial propia de una tienda online y el back office una experiencia administrativa minimalista, elegante y empresarial.
- Incorporar un dashboard inicial del back office con indicadores y accesos operativos adaptados a los permisos de `ADMIN` y `BILLING`.
- Permitir seleccionar entre temas claro y oscuro en storefront y back office, con preferencias independientes, persistentes y accesibles.
- Incorporar un seed idempotente y exclusivo de desarrollo y pruebas con veinte productos tecnológicos completos, sus categorías, etiquetas, precios, inventario e imágenes, además de usuarios de ejemplo `ADMIN` y `CUSTOMER`.
- Permitir múltiples imágenes ordenadas por producto, con una portada principal para tarjetas y una galería tipo carrusel en la página de detalle.
- Separar la landing del catálogo completo: la landing mostrará los nueve productos activos más recientes sin paginación y enlazará a una página de catálogo con todos los productos, buscador, filtros, ordenamiento y paginación backend.

## Capabilities

### New Capabilities

- `identity-access`: Registro, autenticación, sesión, autorización con tres roles y administración del ciclo de vida de usuarios.
- `product-catalog`: Catálogo público y administrativo, detalle, búsqueda, filtros, ordenamiento, paginación y gestión de productos e imágenes.
- `shopping-cart-checkout`: Carrito persistente por cliente, validación de cantidades, cálculo de totales y checkout con pago y envío simulados.
- `order-management`: Creación, consulta, transición y administración de órdenes, incluyendo historial del cliente y snapshots comerciales.
- `inventory-control`: Existencias, validación concurrente, movimientos, ajustes y prevención de stock negativo.
- `billing-invoicing`: Facturación manual o desde órdenes, estados de factura y pago, numeración y separación explícita respecto de órdenes e inventario.
- `document-export`: Generación y descarga autorizada de órdenes y facturas en PDF.

Las capacidades ya declaradas también cubrirán las siguientes ampliaciones sin introducir nuevos paths de especificación:

- `identity-access`: búsqueda y paginación administrativa de usuarios, feedback de autenticación y confirmación de operaciones destructivas.
- `identity-access`: usuarios seed `ADMIN` y `CUSTOMER` restringidos a entornos no productivos.
- `product-catalog`: layouts del storefront y back office, filtros colapsables, categorías, etiquetas, slugs y lista de deseos.
- `product-catalog`: identidades visuales diferenciadas, dashboard administrativo por rol y selección persistente de tema claro u oscuro.
- `product-catalog`: seed de veinte productos, múltiples imágenes con portada, galería accesible y separación entre productos recientes de la landing y catálogo completo paginado.
- `shopping-cart-checkout`: indicador de cantidad del carrito, mensajes flash y confirmación al retirar líneas.
- `order-management`: búsqueda y paginación administrativa y snapshots del perfil de empresa.
- `inventory-control`: búsqueda, filtros y paginación administrativa de balances y movimientos.
- `billing-invoicing`: perfil de empresa, autocompletado remoto y experiencia administrativa paginada.
- `document-export`: datos de empresa preservados en PDFs históricos.

### Modified Capabilities

- Ninguna; el proyecto todavía no contiene especificaciones funcionales existentes.

## Impact

- Nuevas aplicaciones de storefront, back office y API dentro del monorepo, con posibilidad de ejecutar procesos asíncronos de forma independiente.
- Nuevos contratos REST versionados y documentados mediante OpenAPI; el frontend no accederá directamente a PostgreSQL ni usará Server Actions para lógica de negocio o datos.
- Nuevo esquema PostgreSQL, migraciones, restricciones transaccionales, auditoría y almacenamiento de referencias a imágenes y documentos.
- Nuevas dependencias de frontend para React/Next.js, TypeScript, Tailwind, Zustand, Zod, React Hook Form y TanStack Query; y dependencias de backend para REST, persistencia, autenticación, OpenAPI y generación PDF.
- Nuevas suites de pruebas unitarias, integración, contrato y flujos end-to-end para seguridad, catálogo, checkout, concurrencia de inventario y facturación.
- Nuevas entidades y contratos REST para categorías, etiquetas, lista de deseos y perfil de empresa, además de búsquedas remotas para autocompletado.
- Nuevos componentes UI compartidos para shells, navegación, sidebars, buscadores, filtros, mensajes flash, badges y modales de confirmación accesibles.
- Nuevos sistemas de tokens visuales separados por aplicación, infraestructura de temas y contrato REST agregado para el resumen autorizado del dashboard.
- Nuevas fixtures de desarrollo para productos, imágenes y usuarios, ampliación del modelo y contrato de imágenes de producto, y nuevas pruebas de galería y navegación entre landing y catálogo.
