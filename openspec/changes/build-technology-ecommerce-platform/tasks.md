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

## 12. Layouts, navegación y retroalimentación compartida

- [ ] 12.1 Implementar `StorefrontShell` con header, navbar superior, área principal, footer, nombre de tienda y logo SVG; verificar persistencia del layout, regiones semánticas y navegación responsive mediante pruebas de componentes.
- [ ] 12.2 Integrar en el navbar del storefront inicio, acciones de cuenta y login/logout según sesión y badge con la suma de unidades del carrito; verificar estados visitante, cliente autenticado, carrito vacío y carrito con múltiples cantidades.
- [ ] 12.3 Implementar `BackofficeShell` con navegación lateral izquierda colapsable y opciones condicionadas por `ADMIN` y `BILLING`; verificar expansión, colapso, teclado, pantalla pequeña y ausencia de enlaces no autorizados.
- [ ] 12.4 Implementar el hero del storefront con imagen tecnológica semitransparente, contenido legible y buscador conectado al catálogo; verificar contraste, adaptación responsive y navegación a la primera página de resultados con la URL correcta.
- [ ] 12.5 Implementar un sistema compartido de mensajes flash accesibles para éxito, error, advertencia e información; verificar región `aria-live`, deduplicación y mensajes de login, logout y mutaciones sin usar `useEffect` para inferir eventos.
- [ ] 12.6 Implementar un diálogo de confirmación reutilizable con Tailwind para operaciones destructivas; verificar foco inicial y de retorno, cierre por teclado, cancelación sin solicitud y bloqueo de envíos duplicados.
- [ ] 12.7 Integrar mensajes flash y confirmaciones en CRUD de productos, categorías, etiquetas y usuarios y en agregar, actualizar o eliminar líneas del carrito; verificar cada operación exitosa, fallida y cancelada mediante pruebas de componentes.

## 13. Categorías, etiquetas y slugs

- [ ] 13.1 Añadir migraciones para categorías, etiquetas, relación producto-etiqueta, categoría principal y slug de producto con índices, unicidad y eliminación lógica; verificar migración desde cero y restricciones con pruebas PostgreSQL.
- [ ] 13.2 Implementar normalización y resolución determinista de slugs sin regenerarlos automáticamente al cambiar nombres; verificar caracteres especiales, colisiones, edición explícita y unicidad concurrente.
- [ ] 13.3 Implementar CRUD REST autorizado de categorías y etiquetas con búsqueda, filtros, orden y paginación; verificar OpenAPI, validaciones, permisos `ADMIN` y conservación de referencias al desactivar o eliminar lógicamente.
- [ ] 13.4 Extender productos y catálogo con categoría, etiquetas, slug y detalle público por slug; verificar creación, edición, filtros combinados y rechazo de clasificaciones inactivas en nuevas asignaciones.
- [ ] 13.5 Crear pantallas administrativas paginadas para categorías y etiquetas con búsqueda superior, filtros colapsables y formularios React Hook Form más Zod; verificar CRUD, mensajes flash y confirmaciones contra el API.
- [ ] 13.6 Integrar selectores de categoría y etiquetas en formularios de producto y filtros en el catálogo público; verificar selección accesible, persistencia en URL y vuelta a página 1 al cambiar criterios.
- [ ] 13.7 Regenerar el cliente TypeScript y los esquemas Zod después de ampliar el contrato de catálogo; verificar compilación de API, storefront y backoffice y ausencia de diferencias de contrato sin generar.

## 14. Lista de deseos

- [ ] 14.1 Añadir migraciones y repositorios para una wishlist por cliente y elementos únicos por producto; verificar unicidad, aislamiento por propietario y conservación de referencias a productos inactivos.
- [ ] 14.2 Implementar endpoints REST para listar deseos paginados, agregar y eliminar productos con autorización de propietario; verificar duplicados, producto inexistente, cliente ajeno y metadatos de paginación.
- [ ] 14.3 Crear controles para agregar o quitar deseos desde tarjetas y detalle de producto y una página de wishlist del cliente; verificar estados activo, agotado e inactivo, invalidación de caché y mensajes flash.
- [ ] 14.4 Permitir agregar al carrito desde la wishlist sin eliminar automáticamente el deseo; verificar stock válido, stock insuficiente, badge del carrito y permanencia del producto guardado.
- [ ] 14.5 Añadir pruebas end-to-end de wishlist para persistencia entre sesiones, ausencia de duplicados, aislamiento de clientes y transición válida al carrito; verificar el flujo completo con dos clientes.

## 15. Perfil empresarial y snapshots

- [ ] 15.1 Añadir la migración del perfil único de tienda con nombre comercial, razón social, identificador fiscal, dirección, contacto y referencia de logo; verificar unicidad del registro y validaciones obligatorias en PostgreSQL y dominio.
- [ ] 15.2 Implementar `GET /api/v1/store-profile` y `PATCH /api/v1/store-profile` con modificación exclusiva de `ADMIN`, lectura autorizada para `ADMIN` y `BILLING` y auditoría; verificar la matriz de permisos y OpenAPI.
- [ ] 15.3 Crear el formulario de empresa en backoffice con React Hook Form, Zod y carga o selección de logo; verificar valores iniciales, errores accesibles, guardado, mensaje flash y permisos por rol.
- [ ] 15.4 Incorporar el snapshot empresarial al confirmar órdenes y a facturas manuales o derivadas de órdenes; verificar que editar el perfil no altera documentos existentes y que una factura desde orden reutiliza el emisor histórico.
- [ ] 15.5 Actualizar las plantillas PDF para usar únicamente el snapshot empresarial de cada orden o factura; verificar nombre comercial, razón social, identificador fiscal, dirección y logo antes y después de modificar el perfil vigente.
- [ ] 15.6 Añadir pruebas de integración y end-to-end del perfil empresarial, autorización y persistencia histórica; verificar edición por Admin, lectura por Billing, rechazo de modificación por Billing y regeneración estable de PDF.

## 16. Listas, sidebars y paginación uniforme

- [ ] 16.1 Normalizar en OpenAPI la respuesta `items`, `page`, `pageSize`, `totalItems` y `totalPages` para usuarios, productos, categorías, etiquetas, wishlist, inventario, órdenes y facturas; verificar pruebas de contrato para cada colección.
- [ ] 16.2 Completar consultas backend de búsqueda, filtros permitidos, orden y conteo previo a paginación para todas las colecciones; verificar que ningún endpoint descarga el conjunto completo ni pagina en memoria.
- [ ] 16.3 Implementar el sidebar izquierdo colapsable de filtros del catálogo y su drawer responsive; verificar conservación de criterios, accesibilidad, URL y reinicio de página.
- [ ] 16.4 Implementar slots compartidos de búsqueda superior y sidebar derecho colapsable para listas del backoffice; verificar productos, usuarios, clientes, categorías, etiquetas, inventario, órdenes y facturas en escritorio y pantalla pequeña.
- [ ] 16.5 Reutilizar el control numerado con primera, anterior, hasta cuatro páginas a cada lado, siguiente, última y elipsis en todas las listas; verificar extremos, página intermedia, una sola página y ausencia de duplicados.
- [ ] 16.6 Añadir pruebas de componentes y end-to-end que combinen búsqueda, filtros, orden y paginación en storefront y backoffice; verificar recarga, historial del navegador y metadatos concordantes con el backend.

## 17. Autocomplete para facturación manual

- [ ] 17.1 Extender las consultas REST paginadas de usuarios y productos para autocomplete autorizado con término mínimo, tamaño limitado e índices adecuados; verificar rendimiento básico, permisos y que no se expongan colecciones completas.
- [ ] 17.2 Implementar un componente y custom hook de autocomplete remoto con espera breve, cancelación de solicitudes obsoletas, caché y navegación por teclado; verificar carga, vacío, error, selección y lectores de pantalla mediante pruebas de componentes.
- [ ] 17.3 Integrar autocomplete de clientes y productos en la factura manual guardando identificadores confirmados en React Hook Form; verificar selección, cambio, eliminación de línea y validación Zod.
- [ ] 17.4 Revalidar cliente, productos, cantidades, precios e impuestos en el API al crear la factura; verificar rechazo de identificadores manipulados o inactivos y ausencia de movimientos de inventario.
- [ ] 17.5 Añadir pruebas end-to-end de factura manual con autocomplete para `ADMIN` y `BILLING`; verificar búsqueda remota, selección por teclado, creación exitosa y autorización negativa.

## 18. Validación integral de las revisiones

- [ ] 18.1 Regenerar OpenAPI, cliente TypeScript y esquemas Zod para todas las rutas y modelos añadidos; verificar repositorio sin diferencias de generación y typecheck de las tres aplicaciones.
- [ ] 18.2 Ejecutar pruebas de accesibilidad y responsive para shells, navbar, hero, sidebars, drawers, mensajes y modales; corregir fallos hasta verificar teclado, foco, contraste y anuncios accesibles.
- [ ] 18.3 Ejecutar lint, typecheck, pruebas unitarias, integración, contrato, componentes y end-to-end incluyendo categorías, wishlist, perfil empresarial y autocomplete; corregir fallos hasta obtener una suite completa exitosa.
- [ ] 18.4 Actualizar README y AGENTS.md con las rutas, entidades, layouts y reglas incorporadas; verificar que la documentación coincide con OpenAPI, specs y design sin sustituirlos como fuentes de verdad.
- [ ] 18.5 Ejecutar `openspec validate build-technology-ecommerce-platform --strict` y revisar todos los escenarios añadidos; verificar resultado válido y que ninguna tarea se marque completada sin evidencia.

## 19. Identidades visuales, temas y dashboard

- [ ] 19.1 Definir tokens semánticos independientes para storefront claro/oscuro y backoffice claro/oscuro, incluyendo superficies, texto, bordes, acentos, estados, elevación, radio, espaciado y densidad; verificar las cuatro combinaciones en un catálogo visual de componentes sin reutilizar una apariencia completa.
- [ ] 19.2 Implementar la infraestructura de tema con variables CSS, atributo `data-theme`, preferencia inicial del sistema, claves locales separadas y store Zustand visual; verificar primera visita, cambio inmediato, navegación, recarga, independencia entre aplicaciones y ausencia perceptible de parpadeo durante hidratación.
- [ ] 19.3 Aplicar al storefront un look and feel de e-commerce tecnológico con jerarquía comercial, imágenes protagonistas, contenido destacado, tarjetas, detalle y acciones de compra; verificar mediante pruebas de componentes y revisión responsive que no contiene patrones visuales propios del panel administrativo.
- [ ] 19.4 Aplicar al backoffice un look and feel minimalista, elegante y empresarial con paleta administrativa, navegación sobria, tablas densas, formularios, estados y tarjetas KPI; verificar consistencia visual y funcional en las vistas de `ADMIN` y `BILLING`.
- [ ] 19.5 Implementar `GET /api/v1/dashboard/summary` mediante operaciones de lectura de los módulos y respuestas específicas por rol; verificar contrato OpenAPI, conteos de Admin y Billing, período o fecha de actualización y rechazo sin fuga de campos para `CUSTOMER`.
- [ ] 19.6 Crear el dashboard inicial del backoffice con indicadores y accesos rápidos autorizados para `ADMIN` y `BILLING`; verificar métricas, estados de carga/error/vacío, enlaces hacia listas filtradas y ausencia de tarjetas o enlaces prohibidos por rol.
- [ ] 19.7 Extender los cuatro temas a navbar, hero, tarjetas, dashboard, gráficos, tablas, formularios, sidebars, drawers, modales, mensajes y todos sus estados interactivos; verificar que ningún componente queda sin tokens o comunica significado únicamente por color.
- [ ] 19.8 Añadir pruebas de contraste WCAG AA, teclado, foco, preferencia del sistema, persistencia y regresión visual para las cuatro combinaciones; corregir diferencias hasta verificar vistas representativas de storefront y backoffice en escritorio y pantalla pequeña.
- [ ] 19.9 Actualizar README y AGENTS.md con la separación visual, los temas, el dashboard, su endpoint y las nuevas tareas; verificar que ambos documentos coinciden con proposal, specs y design y continúan describiendo funcionalidades planificadas, no implementadas.

## 20. Seed demostrativo, imágenes y navegación del catálogo

- [ ] 20.1 Ampliar `ProductImage` para múltiples imágenes con texto alternativo, portada única, orden y metadatos, y añadir sus migraciones y restricciones; verificar con pruebas PostgreSQL que un producto no admite dos portadas ni posiciones inválidas y que un producto activo conserva una portada.
- [ ] 20.2 Implementar los endpoints REST para agregar, editar, reordenar, elegir portada y eliminar imágenes de producto; verificar autorización `ADMIN`, validación, OpenAPI, cliente generado y coordinación segura con el adaptador de almacenamiento.
- [ ] 20.3 Preparar un manifiesto y al menos sesenta assets optimizados, propios o aprobados, con una portada y dos imágenes adicionales por producto; verificar existencia, dimensiones, formato, texto alternativo, ausencia de hotlinks y asociación determinista de todos los archivos.
- [ ] 20.4 Implementar el seed idempotente de exactamente veinte productos tecnológicos con categorías, etiquetas, slugs, precios, estados, imágenes y balances creados mediante movimientos de apertura; verificar conteos, relaciones, al menos nueve productos activos y una segunda ejecución sin duplicados.
- [ ] 20.5 Implementar usuarios seed `ADMIN` y `CUSTOMER` exclusivos de desarrollo y pruebas con configuración no productiva y contraseñas hasheadas; verificar idempotencia, login de ambos roles, ausencia de credenciales en logs y rechazo de ejecución en producción.
- [ ] 20.6 Extender los contratos de listado y detalle para devolver `coverImage` en tarjetas y `images` ordenadas en detalle; verificar respuestas para múltiples imágenes, una sola imagen, portada faltante, fallback y regeneración coherente de cliente y esquemas Zod.
- [ ] 20.7 Implementar en la landing la consulta y presentación de los nueve productos activos más recientes sin paginador y con enlace “Ver todos los productos”; verificar orden descendente, límite de nueve, comportamiento con menos resultados y ausencia de productos inactivos.
- [ ] 20.8 Implementar la página separada de catálogo completo con búsqueda, filtros, orden, URL y paginación backend existente; verificar acceso desde la landing, primera página, navegación intermedia, recarga y que no se descargue el catálogo completo para paginar en memoria.
- [ ] 20.9 Implementar la galería de detalle con imagen grande, miniaturas, anterior/siguiente, teclado, gestos táctiles, indicador de posición y carga diferida sin autoplay; verificar una y múltiples imágenes, foco, anuncios accesibles, responsive, prevención de layout shift y ambos temas del storefront.
- [ ] 20.10 Añadir pruebas de integración, contrato, componentes y end-to-end para seed, imágenes, portada, landing, catálogo y galería, y actualizar README y AGENTS.md; verificar suite exitosa, documentación alineada y `openspec validate build-technology-ecommerce-platform --strict` válido.
