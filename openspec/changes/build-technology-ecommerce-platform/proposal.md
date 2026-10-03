## Why

El proyecto necesita una base completa y coherente para operar un e-commerce de productos tecnológicos, cubriendo la experiencia de compra, la administración del catálogo y usuarios, el control de inventario y la facturación sin mezclar responsabilidades entre órdenes, pagos y facturas. Definir estas capacidades en conjunto permite que el futuro desarrollo preserve la consistencia del stock, la seguridad por roles y la separación obligatoria entre el frontend Next.js y el backend REST.

## What Changes

- Crear un monorepo con frontend Next.js y TypeScript, backend independiente mediante API REST y PostgreSQL como base de datos transaccional.
- Incorporar un storefront público con landing comercial y catálogo completo paginado, búsqueda, filtros, ordenamiento, detalle de producto y un carrito utilizable sin registro ni login; exigir autenticación únicamente al iniciar el checkout con pagos y envíos simulados.
- Incorporar un back office donde `ADMIN` administre usuarios, productos, inventario, órdenes y facturas, y `BILLING` administre exclusivamente órdenes y facturas.
- Implementar registro, login, logout, recuperación de sesión y autorización por roles, aplicando los permisos en el backend.
- Gestionar productos simples con SKU, nombre, descripción, precio expresado siempre en dólares estadounidenses (`USD`), imagen, stock disponible, fechas y estado activo/inactivo, sin configuración de moneda por producto, con eliminación lógica y trazabilidad.
- Gestionar un carrito persistente por cliente autenticado o por visitante anónimo, validar cantidades contra el stock, recalcular totales, vincular o fusionar el carrito al iniciar sesión y crear órdenes mediante checkout autenticado e idempotente.
- Mantener órdenes, pagos y facturas como conceptos independientes con estados y responsabilidades separados.
- Descontar inventario únicamente al confirmar una compra exitosa, impedir stock negativo y registrar movimientos compensatorios ante cancelaciones.
- Permitir a `ADMIN` y `BILLING` administrar las transiciones de las órdenes y cancelar órdenes en proceso o facturadas únicamente cuando no tengan facturas activas; exigir anular primero cualquier factura asociada no anulada, sin modificar automáticamente factura ni pago al cancelar.
- Permitir que `ADMIN` y `BILLING` generen facturas desde órdenes o manualmente; las facturas manuales no alterarán inventario.
- Permitir la consulta y exportación PDF de órdenes y facturas con controles de acceso según propiedad y rol.
- Añadir auditoría para operaciones sensibles sobre usuarios, roles, productos, inventario, órdenes y facturas.
- Incorporar shells y plantillas reutilizables para storefront y back office, con header, navegación, footer, logo SVG y layouts responsive.
- Incorporar en el storefront una navegación superior con enlaces de sesión y badge de cantidad del carrito, además de un hero tecnológico con imagen de fondo semitransparente y buscador.
- Incorporar filtros colapsables en un sidebar izquierdo del catálogo público completo —no en la landing— y, en el back office, navegación colapsable a la izquierda, búsqueda sobre cada listado y filtros colapsables a la derecha; la gestión de productos permitirá filtrar por rango de precio, categoría principal, etiquetas y rango inclusivo de fecha de creación.
- Estandarizar todas las colecciones potencialmente grandes con búsqueda, filtros, ordenamiento y paginación ejecutados por el backend usando la navegación numérica ya definida.
- Incorporar mensajes flash reutilizables para autenticación, operaciones de catálogo y mutaciones del carrito, además de confirmación modal para toda acción destructiva.
- Incorporar una lista de deseos persistente para cada cliente, con acciones para agregar o retirar productos y mover productos disponibles al carrito.
- Ampliar el catálogo con slugs únicos, categorías administrables y etiquetas asociables a productos.
- Permitir en el formulario administrativo de productos seleccionar etiquetas existentes o crear y asignar etiquetas nuevas por nombre, como chips o mediante entrada separada por comas, sin salir del formulario; ofrecer un slug de producto opcional y editable. Las categorías se crean exclusivamente en su administración y se seleccionan desde un desplegable de categorías existentes.
- Incorporar un perfil único de la empresa con nombre comercial, razón social, identificador fiscal, dirección física y logo administrado como archivo inmutable, configurable desde el back office y preservado como referencia verificable en los snapshots de órdenes y facturas; los PDF incrustarán visualmente la versión histórica del logo cuando exista.
- Incorporar autocompletado remoto y paginado de clientes y productos al crear facturas manuales.
- Diferenciar por completo la identidad visual del storefront y del back office: el storefront tendrá una experiencia comercial propia de una tienda online y el back office una experiencia administrativa minimalista, elegante y empresarial.
- Incorporar un dashboard inicial del back office con indicadores y accesos operativos adaptados a los permisos de `ADMIN` y `BILLING`.
- Permitir seleccionar entre temas claro y oscuro en storefront y back office, con preferencias independientes, persistentes y accesibles.
- Incorporar un seed idempotente y exclusivo de desarrollo y pruebas con veinte productos tecnológicos completos, sus categorías, etiquetas, precios, inventario e imágenes temporales de Lorem Picsum seleccionadas mediante IDs fijos revisados visualmente, usuarios de ejemplo `ADMIN` y `CUSTOMER`, y un perfil empresarial ficticio claramente marcado como `DEMO`; el perfil se crea solo cuando está ausente, nunca sobrescribe cambios administrativos y el seed se bloquea en producción. Las referencias de imágenes se reemplazarán por assets gestionados en Cloudinary antes de producción.
- Permitir múltiples imágenes ordenadas por producto, con una portada principal para tarjetas y una galería tipo carrusel en la página de detalle.
- Separar la landing del catálogo completo: la landing mostrará una composición editorial de productos destacados, productos recientes y categorías importantes, sin filtros ni paginación; el buscador del hero dirigirá al catálogo completo, que ofrecerá búsqueda, filtros, ordenamiento y paginación backend.
- Ampliar la landing con una primera sección de hasta tres productos destacados recientemente, seguida de hasta nueve productos recientes no repetidos y de dos o tres secciones de categorías importantes con hasta tres productos recientes por categoría.
- Permitir que `ADMIN` destaque productos y seleccione, ordene o retire hasta tres categorías importantes para la landing.
- Incorporar en el formulario de productos del backoffice un gestor de galería exclusivo de `ADMIN`: subir archivos JPEG, PNG o WebP con vista previa, editar texto alternativo, elegir portada, ordenar mediante arrastre o teclado y eliminar con confirmación. Cada producto admitirá como máximo cuatro imágenes en total: una portada y hasta tres adicionales. El límite se aplicará también en el backend ante solicitudes concurrentes; compresión y ajustes de calidad quedan fuera de esta revisión.
- Añadir una fase 23 para almacenar las nuevas cargas de imágenes del catálogo en Cloudinary, exclusivamente en la carpeta `codex-storefront`, mediante el backend REST y sin modificar el formulario, la UI, el gestor de galería ni los endpoints existentes. Conservar las imágenes locales y de Picsum actuales sin migración ni ejecución automática del seed; los logos empresariales y los documentos históricos quedan fuera de esta integración.
- Configurar credenciales exclusivamente en el backend, mantener un proveedor local seleccionable y coordinar carga, persistencia y eliminación remota con recuperación de fallos, sin sobrescribir assets ni eliminar archivos todavía referenciados.

## Capabilities

### New Capabilities

- `identity-access`: Registro, autenticación, sesión, autorización con tres roles y administración del ciclo de vida de usuarios.
- `product-catalog`: Catálogo público y administrativo, detalle, búsqueda, filtros, ordenamiento, paginación y gestión de productos e imágenes.
- `shopping-cart-checkout`: Carrito público persistente por cliente o visitante anónimo, validación de cantidades, cálculo de totales, vinculación al autenticarse y checkout protegido con pago y envío simulados.
- `order-management`: Creación, consulta, transición y administración de órdenes, incluyendo historial del cliente y snapshots comerciales.
- `inventory-control`: Existencias, validación concurrente, movimientos, ajustes y prevención de stock negativo.
- `billing-invoicing`: Facturación manual o desde órdenes, estados de factura y pago, numeración y separación explícita respecto de órdenes e inventario.
- `document-export`: Generación y descarga autorizada de órdenes y facturas en PDF.

Las capacidades ya declaradas también cubrirán las siguientes ampliaciones sin introducir nuevos paths de especificación:

- `identity-access`: búsqueda y paginación administrativa de usuarios, feedback de autenticación y confirmación de operaciones destructivas.
- `identity-access`: usuarios seed `ADMIN` y `CUSTOMER` restringidos a entornos no productivos.
- `product-catalog`: layouts del storefront y back office, filtros colapsables, categorías, etiquetas, slugs, lista de deseos y filtros administrativos de productos por precio, categoría, etiquetas y fecha de creación.
- `product-catalog`: identidades visuales diferenciadas, dashboard administrativo por rol y selección persistente de tema claro u oscuro.
- `product-catalog`: seed de veinte productos, múltiples imágenes con portada, galería accesible y separación entre productos recientes de la landing y catálogo completo paginado.
- `product-catalog`: productos destacados, categorías importantes configurables y composición agregada y ordenada de las secciones comerciales de la landing.
- `product-catalog`: gestor visual administrativo de imágenes y límite transaccional de cuatro imágenes por producto, reutilizando los endpoints REST existentes.
- `product-catalog`: almacenamiento Cloudinary de nuevas cargas en `codex-storefront`, compatibilidad con referencias anteriores y limpieza recuperable de assets propios no referenciados, sin cambios visuales ni migración del contenido demo.
- `shopping-cart-checkout`: identificación segura y expiración del carrito anónimo, fusión con el carrito del cliente, indicador de cantidad para visitantes y clientes, mensajes flash y confirmación al retirar líneas.
- `order-management`: búsqueda y paginación administrativa, gestión de estados por `ADMIN` y `BILLING` y snapshots del perfil de empresa.
- `inventory-control`: búsqueda, filtros y paginación administrativa de balances y movimientos.
- `billing-invoicing`: perfil de empresa, perfil empresarial `DEMO` precargado únicamente en entornos no productivos, autocompletado remoto y experiencia administrativa paginada.
- `document-export`: datos de empresa y logo visual preservados en PDFs históricos sin consultar el perfil vigente ni descargar imágenes remotas al regenerar.

### Modified Capabilities

- Ninguna; el proyecto todavía no contiene especificaciones funcionales existentes.

## Impact

- Nuevas aplicaciones de storefront, back office y API dentro del monorepo, con posibilidad de ejecutar procesos asíncronos de forma independiente.
- Nuevos contratos REST versionados y documentados mediante OpenAPI; el frontend no accederá directamente a PostgreSQL ni usará Server Actions para lógica de negocio o datos.
- Nuevo esquema PostgreSQL, migraciones, restricciones transaccionales, auditoría y almacenamiento de referencias a imágenes y documentos.
- Nuevas dependencias de frontend para React/Next.js, TypeScript, Tailwind, Zustand, Zod, React Hook Form y TanStack Query; y dependencias de backend para REST, persistencia, autenticación, OpenAPI y generación PDF.
- Nuevas suites de pruebas unitarias, integración, contrato y flujos end-to-end para seguridad, catálogo, checkout, concurrencia de inventario y facturación.
- Nuevas entidades y contratos REST para categorías, etiquetas, lista de deseos y perfil de empresa, además de búsquedas remotas para autocompletado.
- Un endpoint administrativo de carga de logo y almacenamiento de versiones inmutables con huella verificable; el perfil referenciará solo assets gestionados por el API y las versiones usadas en documentos históricos no se eliminarán.
- Ampliación de las mutaciones REST de productos para resolver o crear etiquetas por nombre junto con sus asociaciones en una sola operación, sin creación de categorías en línea.
- Nuevos componentes UI compartidos para shells, navegación, sidebars, buscadores, filtros, mensajes flash, badges y modales de confirmación accesibles.
- Nuevos sistemas de tokens visuales separados por aplicación, infraestructura de temas y contrato REST agregado para el resumen autorizado del dashboard.
- Nuevas fixtures de desarrollo para productos, imágenes temporales deterministas de Lorem Picsum, usuarios y un perfil empresarial ficticio `DEMO` que no reemplaza configuraciones existentes, ampliación del modelo y contrato de imágenes de producto, una ruta explícita de migración posterior a Cloudinary y nuevas pruebas de galería y navegación entre landing y catálogo.
- Nuevos campos y filtros de destaque para productos y categorías, un endpoint REST agregado de landing y pruebas de orden, límites, deduplicación y autorización administrativa.
- Ampliación de los filtros administrativos de productos con rango de precio, categoría principal, selección de etiquetas y rango inclusivo de fecha de creación, aplicados por backend y persistidos en la URL.
- Persistencia PostgreSQL de carritos anónimos mediante identificadores opacos almacenados en cookie segura, sin exigir una cuenta hasta el checkout, además de reglas de expiración, aislamiento y fusión al autenticarse.
- Moneda global única `USD` para catálogo, carrito, checkout, órdenes, pagos, facturas y documentos; los contratos y snapshots conservarán el código técnico de moneda fijo para hacer explícitos los importes, pero ninguna interfaz permitirá elegirlo por producto u operación.
- Fase 22 adicional sobre la implementación existente: validación del límite de imágenes en todos los caminos de escritura del catálogo, documentación del error en OpenAPI, adaptadores HTTP del backoffice, gestor accesible y pruebas. No incorpora endpoints paralelos ni cambia inventario, órdenes, facturas o snapshots; no elimina automáticamente imágenes existentes para ajustar el límite.
- Fase 23 adicional implementada y verificada; activación local autorizada posteriormente a 23.8: adaptador Cloudinary con SDK oficial, configuración privada por entorno y modo de carpetas explícito, identificación del proveedor por asset, seguimiento persistente de operaciones y limpieza compensatoria recuperable. La selección afecta únicamente a nuevas cargas del catálogo; la lectura y gestión de imágenes anteriores permanecen compatibles. No incluye migración masiva, transformación/calidad de imágenes, carga directa desde el navegador, cambios de logos o activación automática del proveedor.
- Pruebas aisladas de cargas y eliminación, permisos, concurrencia, errores y renderizado en ambas aplicaciones; documentación posterior en README, AGENTS y guías operativas. Cualquier prueba real con credenciales, activación o escritura externa requerirá autorización específica y no forma parte de la actualización de estos artefactos.
