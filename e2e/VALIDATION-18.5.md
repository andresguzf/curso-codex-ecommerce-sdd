# Revisión de escenarios OpenSpec — tarea 18.5

Fecha: 30 de septiembre de 2026. Cambio: `build-technology-ecommerce-platform`.
Schema: `spec-driven`.

## Resultado y límites

- `openspec validate build-technology-ecommerce-platform --strict`: válido.
- Se revisaron los siete archivos de especificación, propuesta, diseño y tareas:
  **81 requisitos y 163 escenarios**, incluidos los requisitos futuros.
- Se contrastaron las revisiones implementadas con las suites relacionadas,
  el contrato OpenAPI y los informes de [18.2](ACCESSIBILITY.md) y
  [18.3](VALIDATION-18.3.md). La tabla siguiente conserva los nombres de todos
  los escenarios para que la revisión sea trazable.
- Se repitió `pnpm exec turbo run test --force`: siete tareas de pruebas exitosas,
  cero recuperadas de caché. Las seis suites principales suman 498 pruebas
  (API 222, storefront 105, backoffice 99, UI 28, esquemas 30, cliente 14);
  las dos pruebas de límites arquitectónicos de config-eslint también pasaron.
- Se repitió `pnpm contract:check`: cliente generado coherente, una prueba
  de generación y 16 pruebas API exitosas. Se solapan con las suites anteriores.
- Las pruebas de navegador, lint, tipos y builds no se repitieron en esta
  tarea documental: su evidencia previa está en 18.2/18.3 y las tareas
  de calidad/despliegue. Las pruebas de integración ejecutadas aquí usan
  bases aisladas; no se ejecutó seed sobre la base de desarrollo.
- La validez estructural de OpenSpec **no demuestra cumplimiento total**.
  Las filas pendientes o parciales no se consideran escenarios aceptados
  ni motivos para completar tareas futuras. La revisión 18.5 puede terminar
  sin archivar el cambio; las fases 19–21 siguen abiertas, salvo 20.8.

## Observaciones de coherencia

1. Diseño, decisión 17, escribe `view=admin`; OpenAPI, Zod y API usan
   `view=administrative`. Los filtros por fechas siguen siendo administrativos
   y las suites comprueban ese límite. Es una diferencia terminológica del
   artefacto de diseño, no una autorización para aceptar un alias nuevo.
   Queda registrada para reconciliar mediante el workflow de planificación;
   no se modificó diseño ni contrato en esta tarea.
2. La portada del backoffice todavía no es el dashboard con métricas y no existe
   `/dashboard/summary`; faltan switch y preferencias de tema, múltiples
   imágenes, galería y `/catalog/landing`. Todos permanecen con tareas abiertas.
3. El seed actual tiene tres productos y tres roles, no veinte productos
   y sesenta imágenes. Los escenarios completos de seed de 20–21 no se
   acreditan con las pruebas de idempotencia del seed básico.
4. Las descripciones iniciales de 7.3/7.4 reflejan permisos anteriores;
   7.7 y las specs actuales permiten completar/cancelar órdenes elegibles
   a Billing. La suite transaccional y los límites de autorización prueban
   la regla vigente; no se restauró la exclusividad antigua de Admin.
5. 11.5 es evidencia histórica de una etapa previa; no acredita retrospectivamente
   escenarios añadidos después. Tampoco 18.5 acredita las fases pendientes.
   Ninguna tarea futura se marca por inferencia o por compartir pruebas.

## Evidencias relacionadas

Los códigos identifican archivos de pruebas existentes. Son referencias de revisión,
no una afirmación de correspondencia uno-a-uno entre escenario y caso automatizado.
Las pruebas con fixtures validan UI; no sustituyen las pruebas de negocio del API.

- **I**: [apps/api/test/identity-access/auth.integration.spec.ts](../apps/api/test/identity-access/auth.integration.spec.ts)
- **U**: [apps/api/test/identity-access/user-administration.integration.spec.ts](../apps/api/test/identity-access/user-administration.integration.spec.ts)
- **A**: [apps/api/test/e2e/authorization-boundaries.e2e.spec.ts](../apps/api/test/e2e/authorization-boundaries.e2e.spec.ts)
- **C**: [apps/api/test/product-catalog/product-administration.integration.spec.ts](../apps/api/test/product-catalog/product-administration.integration.spec.ts)
- **T**: [apps/api/test/shopping-cart-checkout/cart.integration.spec.ts](../apps/api/test/shopping-cart-checkout/cart.integration.spec.ts)
- **S**: [apps/api/test/database/development-seed.integration.spec.ts](../apps/api/test/database/development-seed.integration.spec.ts)
- **W**: [apps/api/test/e2e/wishlist-flow.e2e.spec.ts](../apps/api/test/e2e/wishlist-flow.e2e.spec.ts)
- **P**: [apps/api/test/e2e/store-profile.e2e.spec.ts](../apps/api/test/e2e/store-profile.e2e.spec.ts)
- **H**: [apps/api/test/billing-invoicing/issuer-snapshot.integration.spec.ts](../apps/api/test/billing-invoicing/issuer-snapshot.integration.spec.ts)
- **D**: [apps/api/src/document-export/document-export.spec.ts](../apps/api/src/document-export/document-export.spec.ts)
- **F**: [apps/backoffice/test/invoices-management.spec.tsx](../apps/backoffice/test/invoices-management.spec.tsx)
- **N**: [apps/backoffice/test/user-management.spec.tsx](../apps/backoffice/test/user-management.spec.tsx)
- **B**: [apps/backoffice/test/product-management.spec.tsx](../apps/backoffice/test/product-management.spec.tsx)
- **K**: [apps/backoffice/test/backoffice-shell.spec.tsx](../apps/backoffice/test/backoffice-shell.spec.tsx)
- **L**: [apps/storefront/test/catalog-landing.spec.tsx](../apps/storefront/test/catalog-landing.spec.tsx)
- **R**: [apps/storefront/test/storefront-navigation.spec.tsx](../apps/storefront/test/storefront-navigation.spec.tsx)
- **V**: [apps/storefront/test/cart.spec.tsx](../apps/storefront/test/cart.spec.tsx)
- **Q**: [apps/storefront/test/wishlist.spec.tsx](../apps/storefront/test/wishlist.spec.tsx)
- **J**: [apps/backoffice/test/orders-management.spec.tsx](../apps/backoffice/test/orders-management.spec.tsx)
- **M**: [apps/backoffice/test/inventory-balance-management.spec.tsx](../apps/backoffice/test/inventory-balance-management.spec.tsx)
- **E**: [e2e/frontend/invoice-autocomplete.spec.ts](../e2e/frontend/invoice-autocomplete.spec.ts)
- **X**: [packages/ui/test/remote-autocomplete.spec.tsx](../packages/ui/test/remote-autocomplete.spec.tsx)
- **Z**: [e2e/frontend/storefront-catalog.spec.ts](../e2e/frontend/storefront-catalog.spec.ts)
- **O**: [apps/api/test/openapi/openapi-contract.integration.spec.ts](../apps/api/test/openapi/openapi-contract.integration.spec.ts)
- **G**: [packages/ui/test/confirmation-dialog.spec.tsx](../packages/ui/test/confirmation-dialog.spec.tsx)
- **Y**: [packages/ui/test/flash.spec.tsx](../packages/ui/test/flash.spec.tsx)
- **AA**: [apps/backoffice/test/auth-forms.spec.tsx](../apps/backoffice/test/auth-forms.spec.tsx)
- **AB**: [apps/storefront/test/auth-forms.spec.tsx](../apps/storefront/test/auth-forms.spec.tsx)
- **AC**: [apps/backoffice/test/classification-management.spec.tsx](../apps/backoffice/test/classification-management.spec.tsx)
- **AD**: [e2e/frontend/backoffice-catalog.spec.ts](../e2e/frontend/backoffice-catalog.spec.ts)
- **AE**: [apps/storefront/test/storefront-shell.spec.tsx](../apps/storefront/test/storefront-shell.spec.tsx)

## Matriz completa de revisión

“Revisado” indica escenario contrastado con suites del alcance ya implementado.
“Pendiente/parcial” conserva explícitamente trabajo de una fase abierta.

### billing-invoicing

Fuente: [spec.md](../openspec/changes/build-technology-ecommerce-platform/specs/billing-invoicing/spec.md).

| Requisito | Escenarios revisados | Evidencia / alcance |
|---|---|---|
| Factura generada desde una orden | Conversión exitosa<br>Facturación duplicada | Revisado — T |
| Factura manual | Creación manual válida | Revisado — T |
| Alcance operativo de Billing | Billing convierte una orden en factura<br>Billing crea una factura sin orden | Revisado — T, A |
| Estados de factura y pago | Factura de una orden pagada<br>Factura pendiente | Revisado — T |
| Numeración y snapshots | Cambio posterior del cliente o producto | Revisado — T |
| Consulta administrativa de facturas | Billing consulta pendientes | Revisado — T, F |
| Perfil de la empresa emisora | Administrador actualiza la empresa<br>Billing intenta modificar la empresa | Revisado — P |
| Perfil empresarial DEMO en el seed no productivo | Primera ejecución en desarrollo o pruebas<br>Reejecución tras edición administrativa<br>Ejecución en producción | Revisado — S |
| Logo empresarial administrado e inmutable | Administrador sustituye el logo<br>Archivo inválido o rol no autorizado | Revisado — P |
| Snapshot empresarial de la factura | Factura después de cambiar la empresa | Revisado — H, P |
| Autocomplete remoto para factura manual | Buscar cliente<br>Buscar producto<br>Selección manipulada | Revisado — E, X, T |
| Consulta paginada de facturas en backoffice | Buscar y filtrar facturas | Revisado — F |

### document-export

Fuente: [spec.md](../openspec/changes/build-technology-ecommerce-platform/specs/document-export/spec.md).

| Requisito | Escenarios revisados | Evidencia / alcance |
|---|---|---|
| Exportación PDF de órdenes | Cliente descarga su orden<br>Cliente solicita una orden ajena | Revisado — A, T |
| Exportación PDF de facturas | Factura emitida<br>Factura borrador | Revisado — D, T |
| Autorización de documentos | Usuario no autenticado | Revisado — A |
| Consistencia de regeneración | Regeneración posterior | Revisado — D |
| Identidad empresarial en documentos | Documento histórico tras actualizar la empresa<br>Logo histórico sustituido en el perfil<br>Logo ausente o asset alterado | Revisado — D, P, H |

### identity-access

Fuente: [spec.md](../openspec/changes/build-technology-ecommerce-platform/specs/identity-access/spec.md).

| Requisito | Escenarios revisados | Evidencia / alcance |
|---|---|---|
| Registro público de clientes | Registro exitoso<br>Intento de elegir un rol privilegiado | Revisado — I, A |
| Autenticación y sesión | Inicio de sesión válido<br>Cierre de sesión | Revisado — I, AA, AB |
| Autorización basada en tres roles | Cliente intenta entrar al back office<br>Billing accede a facturación | Revisado — A |
| Administración de usuarios | Administrador crea un usuario privilegiado<br>Protección del último administrador | Revisado — U |
| Aislamiento de datos del cliente | Cliente consulta una orden ajena<br>Visitante intenta usar un identificador ajeno | Revisado — A, T |
| Consulta administrativa paginada de usuarios | Administrador busca clientes activos<br>Cambio de criterios de usuarios | Revisado — N, U |
| Retroalimentación de autenticación | Login exitoso<br>Logout exitoso | Revisado — AA, AB, Y |
| Confirmación de acciones destructivas sobre usuarios | Administrador cancela la confirmación | Revisado — N, G |
| Usuarios demostrativos no productivos | Seed de usuarios permitido<br>Seed de usuarios en producción | Pendiente/parcial — 20.5: existe seed básico con tres roles, no acredita la ampliación exacta. Evidencia básica: S. |

### inventory-control

Fuente: [spec.md](../openspec/changes/build-technology-ecommerce-platform/specs/inventory-control/spec.md).

| Requisito | Escenarios revisados | Evidencia / alcance |
|---|---|---|
| Balance y movimientos de inventario | Ajuste administrativo | Revisado — C |
| Prevención de stock negativo | Dos compras compiten por la última unidad | Revisado — C, T |
| Descuento por compra | Compra exitosa | Revisado — T |
| Independencia respecto de facturación | Factura desde orden<br>Factura manual | Revisado — T |
| Disponibilidad pública | Agotamiento posterior a una compra | Revisado — C, T |
| Consulta administrativa paginada de inventario | Buscar balance de producto<br>Consultar movimientos paginados | Revisado — C, M |

### order-management

Fuente: [spec.md](../openspec/changes/build-technology-ecommerce-platform/specs/order-management/spec.md).

| Requisito | Escenarios revisados | Evidencia / alcance |
|---|---|---|
| Creación de orden confirmada | Orden creada desde checkout | Revisado — T |
| Estados independientes de orden | Transición inválida | Revisado — T |
| Historial de compras del cliente | Consulta de mis compras | Revisado — T |
| Administración de órdenes | Billing administra una orden<br>Billing intenta alterar datos históricos | Revisado — T, A, J |
| Cancelación consistente | Orden con factura activa<br>Orden facturada con factura anulada<br>Reintento de cancelación<br>Cancelación de orden confirmada | Revisado — T, J |
| Consulta de órdenes con herramientas de backoffice | Billing filtra órdenes pendientes de facturar<br>Cambio de filtros de órdenes | Revisado — T, J |
| Snapshot del emisor en la orden | Cambio posterior de empresa | Revisado — H |

### product-catalog

Fuente: [spec.md](../openspec/changes/build-technology-ecommerce-platform/specs/product-catalog/spec.md).

| Requisito | Escenarios revisados | Evidencia / alcance |
|---|---|---|
| Datos de producto | Producto válido<br>SKU duplicado<br>Moneda fija del catálogo | Revisado — C |
| Catálogo público | Producto inactivo<br>Producto sin stock | Revisado — C, L |
| Búsqueda, filtros y ordenamiento | Búsqueda combinada con filtros<br>Filtros administrativos combinados<br>Límites inclusivos de creación | Revisado — C, B |
| Paginación administrativa numerada | Página intermedia<br>Cambio de búsqueda | Revisado — B, AD |
| Gestión administrativa de productos | Desactivación de producto<br>Producto referenciado históricamente | Revisado — C, B |
| Plantilla reutilizable del storefront | Navegación de visitante<br>Navegación de cliente autenticado | Revisado — AE, R |
| Hero tecnológico con búsqueda | Búsqueda desde el hero | Revisado — L, Z |
| Filtros colapsables del catálogo público | Aplicar filtro desde el sidebar<br>Abrir filtros en pantalla pequeña | Revisado — L, Z |
| Plantilla y herramientas del backoffice de catálogo | Administrador colapsa la navegación<br>Búsqueda administrativa de productos | Revisado — K, B |
| Clasificación, etiquetas y slugs de productos | Creación con slug disponible<br>Colisión de slug<br>Clasificación inactiva | Revisado — C |
| Clasificación desde el formulario de producto | Crear producto con etiquetas nuevas y existentes<br>Nombre de etiqueta ya utilizado<br>Guardado de producto fallido<br>Slug opcional y categorías administradas aparte | Revisado — C, B |
| Administración de categorías y etiquetas | Categoría administrada<br>Eliminación de categoría referenciada | Revisado — C, AC |
| Paginación de colecciones del catálogo | Página solicitada del catálogo | Revisado — C, O |
| Mensajes y confirmaciones de gestión del catálogo | Producto creado<br>Eliminación cancelada | Revisado — B, AC, G, Y |
| Lista de deseos persistente | Agregar producto a deseos<br>Producto no disponible en deseos<br>Consultar deseos propios | Revisado — W, Q |
| Identidades visuales diferenciadas por aplicación | Comparación de aplicaciones | Pendiente/parcial — 19.1–19.4: shells actuales distintos; falta sistema visual final. Evidencia básica: K, AE. |
| Experiencia visual de tienda online | Visita a la landing page<br>Exploración de productos | Pendiente/parcial — 19.3 y 20–21: catálogo actual disponible; falta composición comercial final. Evidencia básica: L. |
| Dashboard empresarial del back office | Dashboard de administrador<br>Dashboard de facturación<br>Cliente intenta consultar el resumen | Pendiente/parcial — 19.5–19.6 |
| Selección de tema claro y oscuro | Primera visita sin preferencia guardada<br>Cambio explícito de tema<br>Preferencias independientes | Pendiente/parcial — 19.2 |
| Accesibilidad y cobertura completa de temas | Cambiar tema en una vista compleja<br>Carga con preferencia persistida | Pendiente/parcial — 19.7–19.8 |
| Imágenes múltiples y portada de producto | Producto con galería válida<br>Cambio de portada<br>Producto sin portada | Pendiente/parcial — 20.1–20.2 |
| Uso de portada en tarjetas de catálogo | Tarjeta con imágenes múltiples<br>Fallo de la portada | Pendiente/parcial — 20.6: fallback actual no acredita portada de galería. |
| Galería accesible en el detalle del producto | Selección de miniatura<br>Navegación por teclado<br>Producto con una sola imagen | Pendiente/parcial — 20.9 |
| Productos recientes en la landing | Existen más de nueve productos activos<br>Existen menos de nueve productos activos | Pendiente/parcial — 20.7 y 21.7 |
| Página de catálogo completo | Acceso desde la landing<br>Navegación del catálogo | Revisado — Z |
| Seed demostrativo del catálogo | Primera ejecución del seed<br>Reejecución del seed<br>Sustitución para producción<br>Intento en producción | Pendiente/parcial — 20.3–20.4 y 20.10 |
| Administración de productos destacados | Destacar producto activo<br>Retirar destaque<br>Producto destacado desactivado | Pendiente/parcial — 21.1–21.4 |
| Administración de categorías importantes | Configurar tres categorías<br>Intentar una cuarta categoría<br>Categoría importante desactivada | Pendiente/parcial — 21.1–21.2 y 21.5 |
| Composición ordenada de la landing | Landing con contenido completo<br>Productos repetidos en categorías<br>Contenido insuficiente<br>Sección de categoría vacía | Pendiente/parcial — 21.7 |
| Respuesta REST agregada de landing | Consulta pública de landing<br>Landing sin configuración comercial | Pendiente/parcial — 21.3 |
| Destaques del seed demostrativo | Seed de composición comercial | Pendiente/parcial — 21.6 |

### shopping-cart-checkout

Fuente: [spec.md](../openspec/changes/build-technology-ecommerce-platform/specs/shopping-cart-checkout/spec.md).

| Requisito | Escenarios revisados | Evidencia / alcance |
|---|---|---|
| Carrito público por cliente o visitante | Visitante agrega un producto<br>Agregar un producto disponible<br>Cantidad superior al stock | Revisado — T, V |
| Persistencia y aislamiento del carrito anónimo | Visitante vuelve posteriormente<br>Identificador anónimo inválido<br>Carrito anónimo vencido | Revisado — T |
| Vinculación del carrito al autenticarse | Cliente sin carrito previo<br>Cliente con carrito previo<br>Suma superior al stock durante la fusión | Revisado — T, AB |
| Totales del carrito | Cambio de cantidad | Revisado — T, V |
| Validación final de checkout | Visitante intenta iniciar checkout<br>Stock cambia antes de confirmar | Revisado — T |
| Pago y envío simulados | Pago simulado aprobado<br>Pago simulado rechazado | Revisado — T |
| Checkout idempotente | Repetición de solicitud exitosa | Revisado — T |
| Indicador global del carrito | Cantidad actualizada<br>Abrir el carrito | Revisado — R, V |
| Retroalimentación de operaciones del carrito | Producto agregado<br>Cantidad rechazada | Revisado — V, L |
| Confirmación antes de eliminar una línea | Cliente confirma eliminación<br>Cliente cancela eliminación | Revisado — V, G |
| Agregar al carrito desde deseos | Producto deseado disponible | Revisado — W, Q |

La matriz contiene 123 escenarios relacionados con el alcance implementado y
40 escenarios pendientes o parciales; ambos grupos fueron revisados.
No se interpreta la existencia de una suite como certificación de todos los
estados visuales ni de funcionalidades aún no construidas.

## Control de tareas y archivos

La revisión usa el estado real de `tasks.md`: al comenzar había 118/145 tareas
completadas. Solo se completa 18.5 tras registrar el resultado; quedan
119/145 completadas y 26 pendientes. No se cambian checkboxes de 19–21.

- `e2e/VALIDATION-18.5.md`: inventario de escenarios, evidencias y diferencias.
- `openspec/changes/build-technology-ecommerce-platform/tasks.md`: solo checkbox 18.5.
- `README.md` y `AGENTS.md`: referencia al cierre de esta revisión, sin afirmar
  que toda la aplicación esté terminada.

No se modificó código de aplicación, no se comenzó 19.1, no se archivó el cambio
y no se realizó commit ni push.

