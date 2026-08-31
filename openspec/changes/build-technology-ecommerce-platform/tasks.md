## 1. Fundaciones del monorepo

- [ ] 1.1 Crear el workspace pnpm y la configuración Turborepo con `apps/storefront`, `apps/backoffice`, `apps/api` y los paquetes compartidos definidos en el diseño; verificar que pnpm reconoce todos los workspaces y que el grafo de tareas no contiene ciclos.
- [ ] 1.2 Inicializar storefront y back office con Next.js, TypeScript, App Router, Tailwind y React estable 19.2.8 o posterior disponible; verificar versiones instaladas, typecheck y build de ambas aplicaciones.
- [ ] 1.3 Inicializar el API NestJS modular con endpoint de salud y configuración validada por entorno; verificar el arranque y una prueba HTTP del health check.
- [ ] 1.4 Crear configuraciones compartidas de TypeScript, ESLint, Tailwind y testing sin ocultar dependencias entre paquetes; verificar lint y typecheck desde la raíz.
- [ ] 1.5 Configurar PostgreSQL local y variables de entorno mediante infraestructura reproducible; verificar conexión del API y persistencia después de reiniciar el servicio.
- [ ] 1.6 Añadir comandos raíz de desarrollo, build, lint, typecheck y test para todas las aplicaciones; verificar que cada comando termina correctamente en un checkout limpio.

## 2. Persistencia, contratos y límites

- [ ] 2.1 Configurar el ORM, migraciones y cliente PostgreSQL exclusivo del API; verificar que una base vacía puede migrarse hacia adelante desde cero.
- [ ] 2.2 Crear las tablas y restricciones de usuarios, sesiones, roles y auditoría; verificar integridad de correos únicos, roles admitidos y referencias mediante pruebas de integración.
- [ ] 2.3 Crear las tablas de productos, imágenes, balances y movimientos de inventario; verificar SKU único, precio no negativo y balance no negativo en la base de datos.
- [ ] 2.4 Crear las tablas de carritos, líneas, órdenes, líneas de orden, pagos e idempotencia; verificar relaciones, unicidad y snapshots mediante una migración y pruebas de repositorio.
- [ ] 2.5 Crear las tablas de facturas y líneas con origen, estados, numeración y referencia opcional a orden; verificar unicidad de número y de factura activa por orden.
- [ ] 2.6 Crear seed reproducible para los tres roles, un administrador inicial y datos de catálogo de desarrollo; verificar que puede ejecutarse dos veces sin duplicar registros.
- [ ] 2.7 Publicar OpenAPI versionado bajo `/api/v1`, generar `packages/api-client` y definir esquemas Zod para fronteras HTTP; verificar que el cliente se regenera sin cambios inesperados y compila en ambos frontends.
- [ ] 2.8 Aplicar reglas de dependencia que impidan a los frontends importar persistencia o dominio interno del API; verificar las reglas con lint o pruebas de arquitectura que fallen ante una importación prohibida.

## 3. Identidad, sesión y autorización

- [ ] 3.1 Implementar hash de contraseñas, login, renovación y logout con revocación de sesión; verificar credenciales válidas, inválidas, expiradas y revocadas mediante pruebas de integración.
- [ ] 3.2 Implementar registro público que asigne siempre `CUSTOMER`; verificar que enviar `ADMIN` o `BILLING` no eleva privilegios.
- [ ] 3.3 Implementar guards para `CUSTOMER`, `ADMIN`, `BILLING` y comprobaciones de propiedad; verificar toda la matriz de acceso con pruebas positivas y negativas del API.
- [ ] 3.4 Implementar CRUD administrativo de usuarios con activación, desactivación y cambio de rol; verificar auditoría y rechazo de la desactivación del último administrador activo.
- [ ] 3.5 Configurar cookies, CORS, CSRF, orígenes permitidos y límites de intentos de autenticación; verificar cabeceras, cookies seguras y bloqueo de solicitudes desde orígenes no autorizados.
- [ ] 3.6 Crear formularios de registro y login con React Hook Form y Zod, estado de sesión y logout en storefront y back office; verificar errores accesibles, redirecciones por rol y ausencia de Server Actions.

## 4. Catálogo e inventario en el API

- [ ] 4.1 Implementar almacenamiento de imágenes mediante un adaptador con proveedor local de desarrollo; verificar carga, lectura, validación de tipo/tamaño y eliminación segura de una imagen no referenciada.
- [ ] 4.2 Implementar CRUD REST de productos con SKU, precio, moneda, imagen, fechas, estado y eliminación lógica; verificar validaciones y que solo `ADMIN` puede mutar productos.
- [ ] 4.3 Implementar listado público y administrativo con búsqueda, filtros, campos de orden permitidos y paginación con totales; verificar combinaciones de criterios y límites de página mediante pruebas del API.
- [ ] 4.4 Implementar detalle público que excluya productos inactivos o eliminados y proyecte disponibilidad; verificar respuestas para producto activo, inactivo, inexistente y agotado.
- [ ] 4.5 Implementar ajustes de inventario como movimientos auditables separados del CRUD de productos; verificar aumentos, reducciones, motivo obligatorio y rechazo de balance negativo.
- [ ] 4.6 Implementar operaciones atómicas de descuento y restitución con bloqueo en orden estable; verificar mediante una prueba concurrente que dos compras no pueden consumir la misma última unidad.

## 5. Experiencia de catálogo y back office

- [ ] 5.1 Crear componentes UI compartidos para navegación, formularios, tablas, estados de carga/error, modal de confirmación y paginación; verificar renderizado y accesibilidad básica con pruebas de componentes.
- [ ] 5.2 Implementar el hero, listado y tarjetas del catálogo público usando el cliente REST y TanStack Query; verificar que solo aparecen productos activos y que los agotados deshabilitan la compra.
- [ ] 5.3 Implementar detalle de producto con imagen, descripción, precio y stock disponible; verificar estados de carga, inexistente, inactivo y agotado.
- [ ] 5.4 Implementar búsqueda, filtros y orden del catálogo sincronizados con la URL; verificar navegación, recarga y vuelta a página 1 cuando cambia un criterio.
- [ ] 5.5 Implementar la paginación de back office con primera, última, anterior, siguiente, cuatro páginas a cada lado y elipsis; verificar páginas inicial, intermedia, final y resultados de una sola página.
- [ ] 5.6 Implementar lista y formularios administrativos de crear, editar, activar, desactivar y eliminar lógicamente productos con React Hook Form y Zod; verificar cada flujo contra el API y la invalidación de caché.
- [ ] 5.7 Implementar la interfaz de ajustes e historial de inventario para `ADMIN`; verificar que cada ajuste actualiza la disponibilidad y muestra su movimiento y autor.

## 6. Carrito, pago simulado y checkout

- [ ] 6.1 Implementar el carrito persistente único por cliente con endpoints para consultar, agregar, cambiar cantidad y eliminar líneas; verificar propiedad, cantidades positivas y rechazo de stock insuficiente.
- [ ] 6.2 Implementar el cálculo autoritativo de subtotales y total desde precios vigentes; verificar redondeo monetario y recálculo después de cada mutación.
- [ ] 6.3 Implementar puertos y adaptadores configurables de pago y envío simulados con resultados aprobado/rechazado y costos de envío; verificar escenarios deterministas de cada método.
- [ ] 6.4 Implementar checkout transaccional e idempotente que revalide catálogo, precios y stock, cree orden y pago, descuente inventario y cierre el carrito; verificar repetición de la misma clave sin duplicados.
- [ ] 6.5 Añadir pruebas de integración para stock cambiado, producto inactivo, pago rechazado, conflicto concurrente y rollback por error; verificar que ningún fallo parcial crea orden o movimiento inconsistente.
- [ ] 6.6 Crear la interfaz del carrito con cambio de cantidades, eliminación, disponibilidad y totales automáticos, usando TanStack Query para datos remotos y Zustand solo para estado visual; verificar límites de cantidad y actualización inmediata.
- [ ] 6.7 Crear el formulario de checkout con dirección, pago y envío simulados; verificar éxito, rechazo, conflicto de stock, reintento idempotente y navegación a la orden creada.

## 7. Gestión de órdenes

- [ ] 7.1 Implementar el agregado y máquina de estados de orden con snapshots, número único y transiciones válidas; verificar que cambios posteriores de producto o usuario no alteran la orden.
- [ ] 7.2 Implementar endpoints de historial y detalle propios para `CUSTOMER`; verificar orden descendente, paginación y denegación de órdenes ajenas.
- [ ] 7.3 Implementar listado, filtros, detalle y transiciones administrativas para `ADMIN`, y acceso de solo lectura/facturación para `BILLING`; verificar la matriz de permisos y transiciones inválidas.
- [ ] 7.4 Implementar cancelación con motivo y restitución idempotente de inventario; verificar que reintentar la cancelación no duplica el movimiento compensatorio.
- [ ] 7.5 Crear las pantallas de “Mis compras” y detalle de orden en storefront; verificar estados, snapshots, pago, envío y acceso exclusivo del propietario.
- [ ] 7.6 Crear la gestión de órdenes del back office para Admin y Billing; verificar filtros, paginación, acciones visibles por rol y rechazo backend de acciones no autorizadas.

## 8. Facturación

- [ ] 8.1 Implementar el agregado de factura con origen, estados, numeración única, snapshots y transiciones auditadas; verificar borrador, emisión pendiente, pago y anulación.
- [ ] 8.2 Implementar conversión atómica de orden a factura y cambio a `INVOICED`; verificar que una orden no produce dos facturas activas y que el inventario no cambia.
- [ ] 8.3 Implementar creación de factura manual para `ADMIN` y `BILLING`; verificar origen `MANUAL`, cliente y líneas válidas, ausencia de orden y cero movimientos de inventario.
- [ ] 8.4 Implementar endpoints paginados de facturas con búsqueda, filtros, detalle y actualización de estado; verificar permisos administrativos y consulta exclusiva del cliente propietario.
- [ ] 8.5 Crear las pantallas de facturas del back office, incluyendo conversión desde orden y formulario manual con React Hook Form y Zod; verificar flujos de Admin y Billing y acciones prohibidas para Customer.
- [ ] 8.6 Mostrar facturas propias dentro del área de cliente cuando estén disponibles; verificar que nunca se expongan facturas ajenas.

## 9. Exportación de documentos

- [ ] 9.1 Crear el adaptador backend de PDF y las plantillas de orden y factura basadas exclusivamente en snapshots; verificar contenido, formato y generación de ambos tipos de documento.
- [ ] 9.2 Implementar endpoints autorizados para descargar PDFs de órdenes y facturas; verificar acceso de propietario, Admin, Billing, usuario no autenticado y cliente ajeno.
- [ ] 9.3 Marcar facturas `DRAFT` como borrador y conservar la salida histórica al regenerar documentos; verificar PDFs antes y después de modificar datos maestros relacionados.
- [ ] 9.4 Añadir acciones de descarga en storefront y back office con manejo de errores; verificar nombre de archivo, tipo MIME y descarga desde los roles permitidos.

## 10. Auditoría, observabilidad y calidad integral

- [ ] 10.1 Implementar auditoría para usuarios, roles, productos, inventario, órdenes y facturas sin registrar secretos; verificar actor, acción, referencia, fecha y cambios relevantes en cada operación sensible.
- [ ] 10.2 Implementar correlation IDs, logs estructurados, manejo uniforme de errores y métricas básicas; verificar propagación del identificador y ausencia de contraseñas, tokens o datos sensibles en logs.
- [ ] 10.3 Añadir pruebas de contrato que comparen OpenAPI, cliente generado y respuestas reales; verificar que CI falla cuando el contrato cambia sin regenerar el cliente.
- [ ] 10.4 Añadir pruebas end-to-end de registro, login, catálogo, carrito, checkout, historial, administración, facturación desde orden y factura manual; verificar el flujo completo en una base aislada.
- [ ] 10.5 Añadir pruebas end-to-end negativas para escalamiento de rol, acceso cruzado entre clientes y operaciones prohibidas de Billing; verificar respuestas de autorización sin fuga de datos.
- [ ] 10.6 Ejecutar lint, typecheck, pruebas unitarias, integración, componentes, end-to-end y builds de producción; corregir fallos hasta que la suite completa sea exitosa.

## 11. Empaquetado y preparación de despliegue

- [ ] 11.1 Crear imágenes y configuraciones de despliegue independientes para storefront, back office y API; verificar builds reproducibles y arranque separado de cada aplicación.
- [ ] 11.2 Configurar migraciones previas al arranque, health checks y readiness del API y PostgreSQL; verificar un despliegue desde base vacía y recuperación ante una migración fallida.
- [ ] 11.3 Configurar CI con instalación bloqueada, caché, controles de calidad, pruebas y builds por aplicación afectada; verificar una ejecución completa y una ejecución incremental.
- [ ] 11.4 Documentar variables de entorno, comandos locales, seed, migraciones, roles iniciales y límites de pagos/facturación simulados; verificar que un entorno nuevo puede levantarse siguiendo únicamente esa documentación.
- [ ] 11.5 Validar la implementación contra todos los escenarios OpenSpec y ejecutar `openspec validate build-technology-ecommerce-platform --strict`; registrar cualquier desviación y verificar estado válido antes de solicitar archivo del cambio.
