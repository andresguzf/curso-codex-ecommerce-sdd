## Purpose

Define el catálogo tecnológico público y administrativo, incluyendo productos, disponibilidad, búsqueda, ordenamiento y navegación paginada.

## ADDED Requirements

### Requirement: Despliegue independiente de las tres aplicaciones en Vercel
El sistema SHALL desplegar storefront, backoffice y API como tres proyectos del mismo monorepo en Vercel, manteniendo UI, REST /api/v1, NestJS/Fastify, Drizzle, Supabase activo y requisitos anteriores. Las credenciales MUST permanecer exclusivas del API y la conexión remota SHALL usar Session pooler real en 5432 compatible con los advisory locks; MUST NOT usar Transaction pooler 6543, ejecutar seed, recopiado automático o migraciones por petición/cold start. Previews MUST NOT escribir sobre datos ni reconciliar assets activos sin autorización.

#### Scenario: Tres proyectos conservan la frontera REST
- **WHEN** se publican los tres proyectos con URLs y variables finales
- **THEN** ambos frontends consumen exclusivamente NestJS, health confirma Supabase y el catálogo mantiene datos/imágenes existentes sin acceso directo del navegador a PostgreSQL

#### Scenario: Configuración incompatible impide publicar el API
- **WHEN** faltan secretos privados o se configura un pool transaccional para la coordinación de sesión
- **THEN** la verificación falla sin debilitar TLS/locks ni sustituir datos o proveedores silenciosamente

### Requirement: Imágenes y recuperación compatibles con Vercel Functions
El sistema SHALL conservar galería, portada, máximo de cuatro y carga por REST usando Cloudinary para nuevos assets de catálogo. En Vercel SHALL aplicar máximo de 4194304 bytes (4 MiB), con rechazo seguro y feedback coherente, sin carga directa desde el navegador. MUST resolver entrega durable de imágenes locales antes de declarar el despliegue funcional; conservar Picsum/Cloudinary, metadatos y originales. Transferir assets existentes MUST requerir autorización específica, no se deduce de esta planificación. La recuperación SHALL ejecutarse como trabajo protegido acotado con cadencia compatible con el plan acordado, sin timers permanentes ni depender de tráfico, manteniendo journal, backoff, propiedad, mutex y límites existentes.

#### Scenario: Carga demasiado grande no altera la galería
- **WHEN** ADMIN intenta subir más de 4 MiB en el despliegue Vercel
- **THEN** el formulario/API rechazan la carga con mensaje claro, sin crear referencias ni anunciar éxito

#### Scenario: Recuperación programada segura sin proceso permanente
- **WHEN** una ejecución autorizada procesa trabajos pendientes, incluso con invocaciones concurrentes
- **THEN** respeta gracia/backoff y exclusión, conserva seguimiento durable y nunca borra assets ajenos/referenciados; una solicitud no autenticada no ejecuta el trabajo

#### Scenario: Archivos locales no se pierden tras una reinvocación
- **WHEN** el runtime se reinicia o cambia de instancia después de resolver portabilidad con la estrategia autorizada
- **THEN** las referencias locales anteriores siguen entregando sus imágenes sin depender del disco efímero ni reemplazar Picsum/Cloudinary

### Requirement: Migración verificable de persistencia a Supabase
El sistema SHALL trasladar la base de aplicación a PostgreSQL gestionado en Supabase sin cambiar UI, contratos REST, Drizzle ni requisitos existentes. Para el curso SHALL ejecutar una migración simplificada en cuatro tareas, con conexión/compatibilidad básica, configuración, respaldo/copia y activación/prueba básica. MUST preservar esquema, datos, IDs, relaciones, secuencias e historial Drizzle, comprobar conteos y registros representativos sin exponer secretos y respaldar solo esquemas de aplicación. MUST NOT sobrescribir esquemas gestionados, ejecutar seed ni limpiar un destino no vacío automáticamente. No se exige harness genérico, ensayo exhaustivo ni comparación determinista de todos los valores como condición de esta fase.

#### Scenario: Restauración compatible sin duplicar esquema ni datos
- **WHEN** se copia la base a un destino vacío autorizado mediante restauración compatible o migraciones Drizzle más importación de datos/historial
- **THEN** se preservan productos, taxonomía, wishlist, perfil empresarial, auditoría y asociaciones, se restaura el historial Drizzle y solo se aplican migraciones pendientes

#### Scenario: Incompatibilidad o colisión bloquea la migración
- **WHEN** el destino tiene objetos conflictivos o una versión/extensión incompatible
- **THEN** la operación se detiene antes de sobrescribir datos o activar el destino y conserva el origen y su respaldo privado

### Requirement: Referencias de imágenes y recuperación seguras durante la migración
La migración SHALL preservar URLs, claves, portada, orden, altText y journal de operaciones de imágenes sin trasladar bytes a Supabase Storage ni modificar Cloudinary/Picsum/archivos locales. Los clones y ensayos MUST inhibir cargas y recuperación remota contra assets reales. El corte MUST detener escrituras y workers de origen y mantener una sola autoridad operativa antes de habilitar recuperación en destino.

#### Scenario: Ensayo con journal copiado sin efectos remotos
- **WHEN** se restaura una copia que contiene operaciones de limpieza pendientes
- **THEN** ningún worker o comando del ensayo elimina o modifica assets reales y las referencias siguen intactas

#### Scenario: Corte y rollback sin restaurar datos obsoletos
- **WHEN** el destino ya recibió escrituras y se requiere rollback
- **THEN** se congelan escrituras, respaldan y reconcilian cambios y operaciones de imágenes antes de volver al origen, sin pérdida silenciosa ni resurrección de referencias a assets eliminados

### Requirement: Datos de producto
El sistema SHALL mantener para cada producto un identificador, SKU único, nombre, descripción, precio no negativo expresado en la moneda global fija `USD`, imagen, fechas de creación y actualización, estado `ACTIVE` o `INACTIVE` y disponibilidad de stock, y SHALL NOT permitir configurar una moneda por producto.

#### Scenario: Producto válido
- **WHEN** un administrador crea un producto con todos los datos obligatorios válidos
- **THEN** el sistema guarda el producto y asigna sus identificadores y fechas de auditoría

#### Scenario: SKU duplicado
- **WHEN** un administrador intenta guardar un SKU ya utilizado
- **THEN** el sistema rechaza la operación con un error de validación

#### Scenario: Moneda fija del catálogo
- **WHEN** un administrador crea o edita un producto
- **THEN** el sistema asigna o conserva `USD` sin solicitar una moneda y rechaza cualquier contrato que intente persistir una distinta

### Requirement: Catálogo público
El sistema SHALL mostrar un hero, una lista de productos activos y el detalle de cada producto, incluyendo precio, imagen, descripción y stock disponible.

#### Scenario: Producto inactivo
- **WHEN** un visitante consulta el catálogo público
- **THEN** el sistema excluye todos los productos inactivos o eliminados lógicamente

#### Scenario: Producto sin stock
- **WHEN** un producto activo tiene disponibilidad cero
- **THEN** el catálogo muestra el producto como agotado y no permite agregarlo al carrito

### Requirement: Búsqueda, filtros y ordenamiento
El sistema SHALL permitir buscar productos por nombre, descripción o SKU, filtrar al menos por estado y disponibilidad cuando el contexto lo autorice, y ordenar por campos admitidos. En el listado administrativo, `ADMIN` SHALL poder combinar búsqueda y filtros por rango de precio, categoría principal, etiquetas y fecha de creación; el backend SHALL aplicar todos los criterios antes de contar y paginar.

#### Scenario: Búsqueda combinada con filtros
- **WHEN** un usuario aplica búsqueda, filtros y ordenamiento
- **THEN** el sistema devuelve únicamente los productos coincidentes en el orden solicitado y conserva esos criterios al navegar páginas

#### Scenario: Filtros administrativos combinados
- **WHEN** un administrador combina precio mínimo o máximo en `USD`, una categoría principal, una o más etiquetas y un rango de fechas de creación
- **THEN** el backend devuelve solo los productos coincidentes antes de calcular los metadatos de paginación, y el back office conserva los criterios en la URL y reinicia la página a 1 al aplicarlos

#### Scenario: Límites inclusivos de creación
- **WHEN** un administrador filtra por fechas `Desde` y `Hasta` expresadas como `YYYY-MM-DD`
- **THEN** el backend incluye las fechas límite completas interpretadas en UTC, rechaza fechas inválidas o un inicio posterior al fin y aplica el rango solo al listado administrativo

### Requirement: Paginación administrativa numerada
El back office SHALL paginar productos con total de elementos y páginas, controles de primera, última, anterior y siguiente, la página actual, hasta cuatro páginas anteriores y hasta cuatro posteriores, y elipsis cuando existan páginas omitidas.

#### Scenario: Página intermedia
- **WHEN** el administrador visualiza la página 10 de un resultado de 25 páginas
- **THEN** la interfaz muestra primera, anterior, páginas 6 a 14 con la 10 destacada, elipsis cuando correspondan, última y siguiente sin duplicar extremos

#### Scenario: Cambio de búsqueda
- **WHEN** el administrador cambia la búsqueda, filtro, orden o tamaño de página
- **THEN** la lista vuelve a la primera página y refleja los criterios en la URL

### Requirement: Gestión administrativa de productos
El sistema SHALL permitir exclusivamente a `ADMIN` crear, consultar, editar, desactivar, reactivar y eliminar lógicamente productos.

#### Scenario: Desactivación de producto
- **WHEN** un administrador desactiva un producto
- **THEN** el producto permanece disponible para auditoría e historial pero deja de aparecer en el catálogo público

#### Scenario: Producto referenciado históricamente
- **WHEN** un administrador elimina un producto utilizado por una orden o factura
- **THEN** el sistema conserva el registro y aplica una eliminación lógica sin alterar documentos históricos

### Requirement: Plantilla reutilizable del storefront
El storefront SHALL usar una plantilla reutilizable con header, navegación superior, área principal y footer, y SHALL mostrar el nombre de la tienda, un logo SVG, enlace a inicio, acceso al carrito con la cantidad total de unidades y opciones de login o logout según la sesión.

#### Scenario: Navegación de visitante
- **WHEN** una persona sin sesión visita el catálogo
- **THEN** la navegación superior muestra identidad de la tienda, inicio, carrito y acceso al login sin mostrar la acción de logout

#### Scenario: Navegación de cliente autenticado
- **WHEN** un cliente autenticado navega por el storefront
- **THEN** la plantilla mantiene la navegación y el footer entre páginas y muestra las acciones de cuenta y logout correspondientes

### Requirement: Hero tecnológico con búsqueda
La página principal SHALL mostrar un hero con una imagen tecnológica de fondo tratada con transparencia para conservar la legibilidad y SHALL incluir un buscador que aplique la consulta al catálogo.

#### Scenario: Búsqueda desde el hero
- **WHEN** una persona introduce un término válido en el buscador del hero
- **THEN** la interfaz navega a la página del catálogo completo, muestra su primera página filtrada por ese término y refleja la búsqueda en la URL

### Requirement: Filtros colapsables del catálogo público
La página del catálogo completo SHALL presentar sus filtros en un sidebar izquierdo colapsable y SHALL ofrecer un control equivalente adaptado a pantallas pequeñas, conservando búsqueda, filtros, orden y página en la URL. Esta regla no aplica a la landing editorial, que no tendrá filtros ni paginación.

#### Scenario: Aplicar filtro desde el sidebar
- **WHEN** una persona selecciona una categoría, etiqueta, disponibilidad o rango permitido desde el sidebar
- **THEN** la interfaz solicita al backend la primera página que cumple todos los criterios y permite colapsar el panel sin perderlos

#### Scenario: Abrir filtros en pantalla pequeña
- **WHEN** una persona activa los filtros desde una pantalla pequeña
- **THEN** la interfaz presenta un panel accesible que puede cerrarse y conserva los criterios seleccionados

### Requirement: Plantilla y herramientas del backoffice de catálogo
El backoffice SHALL usar una plantilla reutilizable con navegación lateral izquierda colapsable y SHALL ubicar la búsqueda sobre las listas y los filtros en un panel derecho colapsable para productos, categorías y etiquetas.

#### Scenario: Administrador colapsa la navegación
- **WHEN** un administrador colapsa la navegación lateral del backoffice
- **THEN** el contenido principal conserva sus funciones y la navegación puede volver a expandirse sin perder el estado de la lista

#### Scenario: Búsqueda administrativa de productos
- **WHEN** un administrador escribe una búsqueda sobre la lista de productos y combina filtros del panel derecho
- **THEN** la interfaz solicita al backend la primera página coincidente y refleja los criterios en la URL

### Requirement: Clasificación, etiquetas y slugs de productos
El sistema SHALL asignar a cada producto un slug único, SHALL permitir asociarlo a una categoría principal y a cero o más etiquetas, y SHALL permitir consultar su detalle público mediante el slug estable.

#### Scenario: Creación con slug disponible
- **WHEN** un administrador crea un producto válido con categoría y etiquetas permitidas
- **THEN** el sistema guarda las asociaciones y asigna o valida un slug único apto para la URL pública

#### Scenario: Colisión de slug
- **WHEN** se intenta guardar un slug ya utilizado por otro producto
- **THEN** el sistema rechaza el valor o genera de forma determinista una variante única y devuelve el slug definitivo

#### Scenario: Clasificación inactiva
- **WHEN** una categoría o etiqueta se encuentra inactiva
- **THEN** el sistema conserva sus referencias históricas pero no permite asignarla a nuevos productos ni ofrecerla como filtro público activo

### Requirement: Clasificación desde el formulario de producto
El formulario administrativo de creación y edición de productos SHALL permitir a `ADMIN` seleccionar una categoría activa ya creada mediante un desplegable, elegir etiquetas activas existentes y escribir nombres de etiquetas nuevas como chips removibles o separados por comas. SHALL ofrecer un campo opcional para editar explícitamente el slug del producto. El sistema SHALL crear las etiquetas nuevas y guardar sus asociaciones junto con el producto de forma atómica, sin ofrecer creación de categorías en este formulario.

#### Scenario: Crear producto con etiquetas nuevas y existentes
- **WHEN** un administrador selecciona una categoría existente, conserva una etiqueta activa y agrega nombres nuevos mediante coma o Enter antes de guardar el producto
- **THEN** el sistema asigna la categoría seleccionada, reutiliza la etiqueta existente y crea y asocia las nuevas etiquetas una sola vez, mostrando las selecciones como chips removibles

#### Scenario: Nombre de etiqueta ya utilizado
- **WHEN** un administrador introduce un nombre de etiqueta que ya corresponde a una etiqueta activa o repite el mismo nombre con diferencias de mayúsculas o espacios
- **THEN** el sistema reutiliza una sola etiqueta activa y no duplica la asociación; si el nombre corresponde a una etiqueta inactiva o no es válido, rechaza la asignación con un error de campo seguro

#### Scenario: Guardado de producto fallido
- **WHEN** una solicitud incluye nombres de etiquetas nuevas pero falla la validación o persistencia del producto o sus asociaciones
- **THEN** la operación revierte todos sus cambios y no deja etiquetas nuevas sin producto

#### Scenario: Slug opcional y categorías administradas aparte
- **WHEN** un administrador crea un producto sin slug, edita uno sin modificar su slug o introduce explícitamente un slug válido, y abre la selección de categoría
- **THEN** el sistema genera el slug únicamente cuando falta en la creación, conserva el slug existente en la edición o valida el cambio explícito, y el desplegable ofrece solo categorías existentes activas sin permitir crearlas desde el formulario

### Requirement: Administración de categorías y etiquetas
El sistema SHALL permitir exclusivamente a `ADMIN` crear, listar, buscar, editar, activar, desactivar y eliminar lógicamente categorías y etiquetas con nombres y slugs únicos.

#### Scenario: Categoría administrada
- **WHEN** un administrador crea o edita una categoría con datos válidos
- **THEN** el sistema guarda sus datos y la incluye en las selecciones y filtros permitidos según su estado

#### Scenario: Eliminación de categoría referenciada
- **WHEN** un administrador elimina una categoría asociada a productos o documentos históricos
- **THEN** el sistema aplica eliminación lógica, conserva las referencias y evita alterar el historial

### Requirement: Paginación de colecciones del catálogo
El backend SHALL paginar las listas de productos, categorías y etiquetas y SHALL devolver `items`, `page`, `pageSize`, `totalItems` y `totalPages` después de aplicar búsqueda, filtros y ordenamiento.

#### Scenario: Página solicitada del catálogo
- **WHEN** una interfaz solicita una página válida con criterios permitidos
- **THEN** el backend devuelve solo los elementos de esa página y metadatos correspondientes al conjunto filtrado

### Requirement: Mensajes y confirmaciones de gestión del catálogo
La interfaz SHALL mostrar mensajes flash accesibles tras crear, editar, activar, desactivar o eliminar productos, categorías o etiquetas, y MUST solicitar confirmación modal antes de toda eliminación o desactivación destructiva.

#### Scenario: Producto creado
- **WHEN** un administrador crea correctamente un producto
- **THEN** la interfaz muestra un mensaje flash de éxito y actualiza la lista sin perder sus criterios vigentes

#### Scenario: Eliminación cancelada
- **WHEN** un administrador cancela el diálogo de eliminación de un producto, categoría o etiqueta
- **THEN** la interfaz no envía la operación y conserva el registro sin cambios

### Requirement: Lista de deseos persistente
El sistema SHALL permitir que cada `CUSTOMER` autenticado consulte su lista de deseos y agregue o elimine productos sin duplicados, y MUST impedir que un cliente acceda o modifique la lista de otro.

#### Scenario: Agregar producto a deseos
- **WHEN** un cliente agrega un producto que todavía no está en su lista
- **THEN** el sistema persiste una única referencia al producto en la lista de ese cliente y confirma la operación

#### Scenario: Producto no disponible en deseos
- **WHEN** un producto guardado se vuelve inactivo o se agota
- **THEN** la lista conserva la referencia para el cliente, indica su indisponibilidad y no permite agregar una cantidad inválida al carrito

#### Scenario: Consultar deseos propios
- **WHEN** un cliente autenticado solicita su lista de deseos paginada
- **THEN** el sistema devuelve únicamente sus productos guardados con metadatos de paginación

### Requirement: Identidades visuales diferenciadas por aplicación
El storefront y el back office MUST presentar identidades visuales claramente diferenciadas y SHALL mantener paletas, densidades, jerarquías y composiciones propias sin reutilizar la misma apariencia completa entre ambas aplicaciones.

#### Scenario: Comparación de aplicaciones
- **WHEN** una persona navega desde el storefront hacia el back office autorizado
- **THEN** reconoce de forma inequívoca una experiencia comercial en el storefront y una experiencia administrativa empresarial en el back office, aunque ambas conserven patrones accesibles y consistentes

### Requirement: Experiencia visual de tienda online
El storefront SHALL ofrecer un look and feel reconocible de e-commerce tecnológico, centrado en imágenes y datos de producto, descubrimiento del catálogo, promociones o contenido destacado y acciones de compra claramente jerarquizadas.

#### Scenario: Visita a la landing page
- **WHEN** una persona abre la página principal del storefront
- **THEN** encuentra una jerarquía comercial con navbar, hero, búsqueda, contenido destacado, catálogo, precio, disponibilidad y acciones de compra sin elementos propios de un panel administrativo

#### Scenario: Exploración de productos
- **WHEN** una persona recorre tarjetas y detalle de producto
- **THEN** la presentación prioriza imagen, nombre, precio, stock y acciones de carrito o deseos mediante patrones familiares de una tienda online

### Requirement: Dashboard empresarial del back office
El back office SHALL iniciar en un dashboard minimalista, elegante y empresarial que muestre indicadores resumidos y accesos rápidos únicamente para los módulos autorizados al rol actual.

#### Scenario: Dashboard de administrador
- **WHEN** un usuario `ADMIN` abre el dashboard
- **THEN** la interfaz muestra indicadores autorizados de clientes, productos activos, stock bajo, órdenes en proceso y facturas pendientes junto con accesos a su gestión

#### Scenario: Dashboard de facturación
- **WHEN** un usuario `BILLING` abre el dashboard
- **THEN** la interfaz muestra indicadores autorizados de órdenes por facturar, facturas pendientes y facturas pagadas sin mostrar administración de usuarios, catálogo o inventario

#### Scenario: Cliente intenta consultar el resumen
- **WHEN** un usuario `CUSTOMER` solicita el resumen administrativo del dashboard
- **THEN** el API deniega la operación sin exponer indicadores administrativos

### Requirement: Selección de tema claro y oscuro
El storefront y el back office SHALL permitir alternar de forma independiente entre tema claro y oscuro, SHALL usar la preferencia del sistema en la primera visita y SHALL conservar posteriormente la selección explícita de cada aplicación.

#### Scenario: Primera visita sin preferencia guardada
- **WHEN** una persona abre una aplicación por primera vez y su sistema prefiere modo oscuro
- **THEN** la aplicación presenta el tema oscuro correspondiente a su propia identidad visual

#### Scenario: Cambio explícito de tema
- **WHEN** una persona selecciona el tema contrario mediante el switch
- **THEN** todos los elementos visibles cambian inmediatamente, la preferencia queda guardada para esa aplicación y se conserva al navegar o recargar

#### Scenario: Preferencias independientes
- **WHEN** una persona selecciona tema oscuro en el back office y tema claro en el storefront
- **THEN** cada aplicación conserva su propia preferencia sin sobrescribir la otra

### Requirement: Accesibilidad y cobertura completa de temas
Ambos temas MUST mantener contraste equivalente al nivel AA, foco visible, legibilidad y significado no dependiente solo del color, y SHALL cubrir navegación, dashboard, tablas, formularios, tarjetas, gráficos, sidebars, drawers, modales, mensajes y estados interactivos.

#### Scenario: Cambiar tema en una vista compleja
- **WHEN** una persona cambia de tema mientras visualiza una tabla, un modal o un dashboard
- **THEN** todos los componentes adoptan el nuevo tema sin zonas ilegibles, pérdida de foco ni información comunicada únicamente por color

#### Scenario: Carga con preferencia persistida
- **WHEN** una persona vuelve a una aplicación que tiene un tema guardado
- **THEN** la primera presentación visible usa ese tema sin mostrar primero de forma perceptible el tema contrario

### Requirement: Imágenes múltiples y portada de producto
El sistema SHALL permitir hasta cuatro imágenes ordenadas por producto en total, incluyendo una portada y hasta tres imágenes adicionales, MUST mantener exactamente una imagen principal entre las imágenes de un producto publicable y SHALL conservar texto alternativo descriptivo para cada imagen. Cuatro es un máximo, no una cantidad obligatoria.

#### Scenario: Producto con galería válida
- **WHEN** un administrador guarda un producto con una portada y varias imágenes adicionales válidas
- **THEN** el sistema conserva una única portada, el orden de la galería y el texto alternativo de todas las imágenes

#### Scenario: Cambio de portada
- **WHEN** un administrador selecciona otra imagen de la galería como principal
- **THEN** el sistema desmarca la portada anterior y mantiene exactamente una imagen principal

#### Scenario: Producto sin portada
- **WHEN** se intenta activar o publicar un producto con imágenes pero sin una portada válida
- **THEN** el sistema rechaza la operación e identifica el requisito de imagen principal

#### Scenario: Intento de quinta imagen
- **WHEN** una operación intenta agregar una imagen a un producto que ya tiene cuatro imágenes
- **THEN** el backend responde con un conflicto y código estable `PRODUCT_IMAGE_LIMIT_REACHED`, conserva las imágenes y portada anteriores y no deja un archivo nuevo huérfano

#### Scenario: Cargas concurrentes para el último espacio
- **WHEN** dos cargas compiten por el cuarto espacio de un producto con tres imágenes
- **THEN** como máximo una agrega una imagen y la otra recibe el conflicto de límite, sin superar cuatro imágenes ni duplicar portadas

#### Scenario: Datos anteriores con más de cuatro imágenes
- **WHEN** se encuentra un producto existente con más de cuatro imágenes al aplicar la revisión
- **THEN** el sistema conserva todas sus imágenes sin truncarlas ni eliminarlas automáticamente, informa el exceso al administrador y bloquea nuevas altas hasta que haya menos de cuatro; permite corregirlo mediante eliminación confirmada y conserva la gestión de portada, texto alternativo y orden

### Requirement: Gestor administrativo de galería en productos
El backoffice SHALL ofrecer exclusivamente a `ADMIN` un gestor de imágenes dentro del flujo de creación y edición de productos, consumiendo el detalle administrativo y las mutaciones REST existentes. SHALL mostrar miniaturas, portada, orden, texto alternativo y contador de imágenes respecto del máximo de cuatro, con estados accesibles de carga, vacío, error y reintento en ambos temas.

#### Scenario: Edición de galería existente
- **WHEN** un administrador abre la edición de un producto
- **THEN** el gestor consulta sus imágenes desde el detalle administrativo y muestra la colección completa ordenada, sin inferirla únicamente de la portada del listado

#### Scenario: Creación previa a la carga
- **WHEN** un administrador crea un producto y quiere agregar imágenes
- **THEN** primero se guarda el producto para obtener su identificador y después se habilitan las cargas; si una carga falla se conserva el producto creado y se reintenta la imagen sin crear otro producto

#### Scenario: Rol sin permiso de catálogo
- **WHEN** un usuario `BILLING` o `CUSTOMER` intenta acceder al gestor o modificar imágenes mediante REST
- **THEN** la interfaz no ofrece controles administrativos y el API deniega las mutaciones independientemente de la interfaz

### Requirement: Subida de imágenes con vista previa
El gestor SHALL permitir agregar archivos JPEG, PNG o WebP con vista previa local y texto alternativo descriptivo, enviando los bytes y metadatos al endpoint existente. El backend MUST validar formato, firma y tamaño conforme a la configuración del adaptador. La interfaz SHALL bloquear nuevas cargas al alcanzar cuatro imágenes y MUST NOT representar la vista previa como una imagen ya persistida. Esta revisión SHALL NOT incorporar compresión, recorte ni controles de calidad.

#### Scenario: Archivo válido
- **WHEN** un administrador selecciona un archivo admitido, proporciona texto alternativo y confirma la carga con espacio disponible
- **THEN** la interfaz muestra el estado pendiente, envía una sola operación, presenta la imagen devuelta por el API y confirma el éxito mediante mensaje flash

#### Scenario: Archivo rechazado o límite actualizado
- **WHEN** el servidor rechaza el archivo o informa que otra carga completó los cuatro espacios
- **THEN** la interfaz muestra un error seguro sin anunciar éxito, permite corregir la selección o actualizar la galería y libera las referencias temporales de vista previa cuando dejan de usarse

### Requirement: Edición y orden administrativo de imágenes
El gestor SHALL permitir editar texto alternativo, seleccionar otra portada y reordenar imágenes mediante arrastre y controles equivalentes de teclado. Las mutaciones SHALL respetar los permisos, la portada única y el orden autoritativo del API, sin modificar inventario ni snapshots comerciales.

#### Scenario: Cambio de portada desde el formulario
- **WHEN** un administrador confirma otra imagen como portada
- **THEN** el gestor refleja la única portada devuelta por el servidor y actualiza las consultas administrativas afectadas; las siguientes lecturas públicas usan esa portada

#### Scenario: Orden por teclado y error de mutación
- **WHEN** un administrador mueve una imagen con controles de teclado y una operación es rechazada
- **THEN** la interfaz conserva o recupera el orden autoritativo, anuncia el error y mantiene foco utilizable sin confirmar un orden no persistido

### Requirement: Eliminación confirmada de imágenes
El gestor MUST solicitar confirmación accesible antes de eliminar una imagen y MUST respetar la prohibición del backend de dejar un producto activo sin portada. Las operaciones pendientes SHALL bloquear envíos duplicados y las respuestas exitosas SHALL actualizar la galería y consultas administrativas afectadas sin descartar campos del formulario no guardados.

#### Scenario: Cancelar eliminación de imagen
- **WHEN** un administrador cancela el modal de eliminación
- **THEN** no se envía la solicitud y la galería permanece intacta

#### Scenario: Eliminar última portada de producto activo
- **WHEN** un administrador intenta eliminar la única imagen de un producto activo
- **THEN** el sistema impide la eliminación e informa que debe conservar una portada; un producto inactivo puede quedar sin imágenes conforme a las reglas existentes

#### Scenario: Error o pérdida de sesión durante una operación
- **WHEN** una mutación falla o la sesión deja de estar autorizada
- **THEN** la interfaz no confirma éxito ni conserva datos privados para otra cuenta, presenta un mensaje seguro y permite recuperar el estado autorizado sin duplicar la operación automáticamente

### Requirement: Uso de portada en tarjetas de catálogo
Las tarjetas de producto de la landing, catálogo, wishlist y back office SHALL usar la imagen principal como portada y SHALL mostrar un fallback accesible cuando la imagen no pueda cargarse.

#### Scenario: Tarjeta con imágenes múltiples
- **WHEN** una tarjeta representa un producto que tiene portada e imágenes adicionales
- **THEN** la tarjeta muestra únicamente la portada sin convertir la propia tarjeta en una galería

#### Scenario: Fallo de la portada
- **WHEN** la portada no puede cargarse
- **THEN** la tarjeta conserva su estructura y muestra un fallback con nombre o descripción accesible del producto

### Requirement: Galería accesible en el detalle del producto
La página de detalle SHALL presentar la portada y las imágenes adicionales mediante una galería tipo carrusel con miniaturas, controles anterior y siguiente, navegación por teclado y gestos táctiles, y MUST NOT avanzar automáticamente.

#### Scenario: Selección de miniatura
- **WHEN** una persona selecciona una miniatura de la galería
- **THEN** la imagen seleccionada pasa a ser la imagen grande visible sin cambiar la portada persistida del producto

#### Scenario: Navegación por teclado
- **WHEN** una persona enfoca la galería y usa los controles o teclas admitidas
- **THEN** puede recorrer las imágenes en orden y recibe una indicación accesible de la posición actual

#### Scenario: Producto con una sola imagen
- **WHEN** un producto contiene únicamente su portada
- **THEN** el detalle muestra la imagen sin controles de carrusel inactivos o engañosos

### Requirement: Productos recientes en la landing
La sección de recientes SHALL mostrar como máximo los nueve productos activos más recientes ordenados por fecha de creación descendente y que no aparezcan en destacados. La landing SHALL omitir controles de filtros y paginación y SHALL ofrecer un enlace visible hacia el catálogo completo; el buscador del hero SHALL navegar a dicho catálogo.

#### Scenario: Existen más de nueve productos activos
- **WHEN** una persona visita la landing y existen más de nueve productos activos
- **THEN** la sección de recientes muestra exactamente los nueve más recientes elegibles, no muestra filtros ni paginador y permite ir a “Ver todos los productos”

#### Scenario: Existen menos de nueve productos activos
- **WHEN** existen menos de nueve productos activos
- **THEN** la sección de recientes muestra todos los disponibles sin completar con productos inactivos ni presentar filtros o paginación

### Requirement: Página de catálogo completo
El storefront SHALL ofrecer una página de catálogo separada que permita explorar todos los productos activos mediante búsqueda, filtros, ordenamiento y paginación calculados por el backend con los controles numéricos ya definidos.

#### Scenario: Acceso desde la landing
- **WHEN** una persona activa “Ver todos los productos” desde la landing
- **THEN** navega a la primera página del catálogo completo sin heredar una paginación oculta de la sección de recientes

#### Scenario: Navegación del catálogo
- **WHEN** una persona busca, filtra, ordena o cambia de página en el catálogo completo
- **THEN** el storefront consulta únicamente la página correspondiente, conserva los criterios en la URL y muestra los metadatos y controles de paginación aplicables

### Requirement: Seed demostrativo del catálogo
Los entornos de desarrollo y pruebas SHALL poder cargar de forma idempotente exactamente veinte productos tecnológicos de ejemplo con datos válidos, categorías, etiquetas, precios, disponibilidad y al menos tres imágenes por producto, incluyendo una portada, sin habilitar este contenido automáticamente en producción. Las imágenes demostrativas MAY usar URLs temporales de Lorem Picsum con IDs fijos revisados visualmente y MUST conservar una asociación determinista preparada para su reemplazo por assets de Cloudinary antes de producción.

#### Scenario: Primera ejecución del seed
- **WHEN** se ejecuta el seed en un entorno permitido con una base preparada
- **THEN** quedan disponibles veinte productos coherentes, al menos nueve activos para la landing y un mínimo de sesenta imágenes ordenadas con texto alternativo y URLs de Picsum deterministas asociadas mediante IDs fijos revisados visualmente

#### Scenario: Reejecución del seed
- **WHEN** se vuelve a ejecutar el seed sobre los mismos datos
- **THEN** el sistema actualiza o conserva los registros deterministas sin duplicar productos, imágenes, categorías, etiquetas ni balances

#### Scenario: Sustitución para producción
- **WHEN** se prepara el catálogo demostrativo para un entorno productivo
- **THEN** las referencias temporales de Picsum se reemplazan por assets propios o aprobados gestionados en Cloudinary sin cambiar la asociación, el orden, la portada ni el texto alternativo del producto

#### Scenario: Intento en producción
- **WHEN** se intenta ejecutar el seed demostrativo en un entorno de producción
- **THEN** el sistema rechaza la operación antes de crear usuarios, productos, imágenes o inventario de ejemplo

### Requirement: Administración de productos destacados
El sistema SHALL permitir exclusivamente a `ADMIN` destacar o retirar el destaque de productos y SHALL registrar el momento de la última activación del destaque para ordenar su presentación comercial.

#### Scenario: Destacar producto activo
- **WHEN** un administrador destaca un producto activo
- **THEN** el sistema registra el producto como destacado y actualiza la fecha de destaque usada por la landing

#### Scenario: Retirar destaque
- **WHEN** un administrador retira el destaque de un producto
- **THEN** el producto deja de ser elegible para la sección de destacados sin cambiar su estado, inventario ni presencia normal en el catálogo

#### Scenario: Producto destacado desactivado
- **WHEN** un producto destacado se desactiva o elimina lógicamente
- **THEN** la landing lo excluye de todas sus secciones públicas aunque conserve el dato histórico de destaque

### Requirement: Administración de categorías importantes
El sistema SHALL permitir exclusivamente a `ADMIN` seleccionar entre dos y tres categorías activas para la landing, ordenar sus secciones y retirar una selección sin alterar la clasificación de los productos.

#### Scenario: Configurar tres categorías
- **WHEN** un administrador selecciona tres categorías activas y define su orden
- **THEN** el sistema conserva exactamente esas categorías y su posición relativa para la landing

#### Scenario: Intentar una cuarta categoría
- **WHEN** un administrador intenta seleccionar una cuarta categoría sin retirar una de las tres existentes
- **THEN** el sistema rechaza la operación e informa el límite máximo permitido

#### Scenario: Categoría importante desactivada
- **WHEN** una categoría seleccionada se desactiva o elimina lógicamente
- **THEN** la landing omite su sección sin mostrar productos inactivos ni alterar las asociaciones históricas

### Requirement: Composición ordenada de la landing
La landing SHALL presentar primero hasta tres productos activos destacados ordenados por fecha de destaque descendente, después hasta nueve productos activos recientes que no aparezcan en destacados y finalmente entre dos y tres secciones de categorías importantes ordenadas, cada una con hasta tres productos activos recientes. Esta composición editorial SHALL carecer de controles de filtrado y paginación; esos controles pertenecen únicamente al catálogo completo.

#### Scenario: Landing con contenido completo
- **WHEN** existen al menos tres destacados activos, nueve productos recientes adicionales y tres categorías importantes con productos
- **THEN** la landing muestra en orden tres destacados, nueve recientes sin repetir los destacados y tres secciones de categoría con tres productos cada una, sin filtros ni paginador

#### Scenario: Productos repetidos en categorías
- **WHEN** un producto de una categoría importante ya apareció en destacados o recientes
- **THEN** la sección de categoría puede volver a mostrarlo porque representa un contexto comercial independiente

#### Scenario: Contenido insuficiente
- **WHEN** una sección tiene menos productos activos que su límite
- **THEN** la landing muestra únicamente los disponibles sin completar con productos inactivos, duplicados artificiales ni controles vacíos

#### Scenario: Sección de categoría vacía
- **WHEN** una categoría importante no contiene productos activos
- **THEN** la landing omite esa sección y conserva el orden relativo de las demás categorías configuradas

### Requirement: Respuesta REST agregada de landing
El API SHALL devolver mediante una única consulta pública la composición vigente de la landing con `featuredProducts`, `latestProducts` y `highlightedCategories`, aplicando límites, orden, visibilidad y deduplicación antes de responder. El endpoint de landing SHALL ser fijo y no aceptar criterios de búsqueda, filtros ni paginación; esas consultas se harán en el endpoint de catálogo completo.

#### Scenario: Consulta pública de landing
- **WHEN** el storefront solicita la composición de la landing
- **THEN** el API devuelve las secciones en el orden configurado con portadas y datos públicos, sin productos inactivos, paginadores ni campos administrativos de destaque

#### Scenario: Landing sin configuración comercial
- **WHEN** no existen destacados o categorías importantes configuradas
- **THEN** el API devuelve esas secciones vacías y mantiene la sección de productos recientes con los productos activos disponibles

### Requirement: Destaques del seed demostrativo
El seed de desarrollo y pruebas SHALL marcar al menos tres productos activos como destacados y exactamente tres categorías activas como importantes con un orden determinista.

#### Scenario: Seed de composición comercial
- **WHEN** se ejecuta el seed demostrativo en un entorno permitido
- **THEN** la respuesta agregada de landing contiene tres destacados, nueve recientes no repetidos y tres categorías importantes configuradas de forma reproducible

### Requirement: Nuevas cargas de catálogo en Cloudinary
El API SHALL permitir seleccionar Cloudinary como proveedor de nuevas cargas del catálogo y MUST almacenar esos assets exclusivamente en la carpeta `codex-storefront`. SHALL conservar el formulario, la UI, el gestor de galería, las mutaciones REST y la autorización exclusiva de `ADMIN`. El navegador MUST enviar los bytes al API, no directamente a Cloudinary. Las cargas MUST NOT modificar inventario, órdenes, facturas o snapshots.

#### Scenario: Carga válida en Cloudinary
- **WHEN** un administrador carga una imagen válida con espacio disponible y Cloudinary es el proveedor seleccionado
- **THEN** el backend almacena el asset en `codex-storefront`, confirma su referencia y metadatos y devuelve una URL HTTPS para la misma UI, sin guardar una copia local de los bytes

#### Scenario: Carpeta dinámica o fija
- **WHEN** se configura explícitamente el modo de carpetas como `dynamic` o `fixed` y se carga una imagen
- **THEN** el adaptador usa los parámetros correspondientes para colocar el asset en `codex-storefront`, sin confundir public ID con carpeta ni aceptar destinos enviados por el cliente

#### Scenario: Carga no autorizada
- **WHEN** un visitante, `CUSTOMER` o `BILLING` intenta subir o modificar imágenes
- **THEN** el API rechaza la operación antes de enviar bytes al proveedor y conserva la galería

### Requirement: Configuración privada de almacenamiento de catálogo
La selección `local|cloudinary` SHALL afectar únicamente nuevas cargas del catálogo y SHALL conservar `local` por defecto hasta activación explícita. Las credenciales MUST residir exclusivamente en el backend y MUST NOT aparecer en código versionado, bundles frontend, respuestas o logs. Seleccionar Cloudinary con configuración incompleta MUST impedir el arranque y los fallos remotos MUST NOT causar fallback silencioso a local.

#### Scenario: Preparación sin activación
- **WHEN** se agregan credenciales al entorno del backend pero el proveedor sigue siendo `local`
- **THEN** las cargas continúan siendo locales y la presencia de credenciales no origina uploads Cloudinary

#### Scenario: Configuración incompleta
- **WHEN** se selecciona Cloudinary sin cloud name, API key, API secret o modo de carpetas válido
- **THEN** el backend rechaza su configuración con diagnóstico seguro sin revelar secretos ni seleccionar otro proveedor

#### Scenario: Preservación de logos empresariales
- **WHEN** se activa Cloudinary para catálogo, se carga un logo o se regenera un PDF histórico
- **THEN** las operaciones empresariales conservan almacenamiento, bytes y huellas previos sin subir logos a `codex-storefront` ni depender del proveedor de catálogo

### Requirement: Compatibilidad de imágenes anteriores
El sistema MUST conservar sin migración automática las referencias locales y de Picsum existentes, portada, orden y texto alternativo. SHALL resolver operaciones según la identidad y origen del asset, independientemente del proveedor seleccionado para nuevas cargas. La activación MUST NOT ejecutar el seed ni descargar o reemplazar imágenes previas. El requisito anterior de sustituir imágenes demo antes de producción sigue vigente como preparación separada.

#### Scenario: Galería mixta
- **WHEN** se agrega una imagen Cloudinary a un producto con imágenes locales o de Picsum
- **THEN** la galería conserva las anteriores y presenta todos los orígenes en el orden persistido, con portada única y el límite existente de cuatro imágenes

#### Scenario: Volver al proveedor local
- **WHEN** se selecciona nuevamente `local` para nuevas cargas
- **THEN** las imágenes Cloudinary previas conservan sus URLs y referencias sin sobrescritura o descarga; su gestión remota usa su origen y requiere conservar su configuración

### Requirement: Confirmación segura de assets remotos
El API MUST validar firma, MIME, formato, tamaño, dimensiones y metadatos antes de enviar bytes, usar identidades únicas sin sobrescritura y validar identidad, tipo de recurso y URL HTTPS retornados antes de confirmar. El máximo de cuatro y la portada única MUST comprobarse transaccionalmente bajo bloqueo de producto, sin mantener bloqueos SQL durante llamadas externas. Los errores de proveedor SHALL usar el envelope REST existente con códigos estables y mensajes seguros.

#### Scenario: Archivo inválido
- **WHEN** se intenta subir un archivo inválido o sobredimensionado
- **THEN** el API devuelve el error correspondiente sin upload ni referencia nueva de galería

#### Scenario: Competencia por el cuarto espacio
- **WHEN** dos cargas remotas compiten por el último espacio
- **THEN** solo una confirma su referencia, la otra recibe `409 PRODUCT_IMAGE_LIMIT_REACHED` y su asset se elimina por compensación o queda registrado para limpieza recuperable, sin superar cuatro imágenes ni duplicar portadas

#### Scenario: Indisponibilidad o respuesta inválida
- **WHEN** Cloudinary falla, agota el tiempo o devuelve identidad o URL inválida
- **THEN** el API responde con `503 IMAGE_STORAGE_UNAVAILABLE`, `504 IMAGE_STORAGE_TIMEOUT` o `502 IMAGE_STORAGE_UPSTREAM_ERROR` según corresponda, sin anunciar éxito ni cambiar a local, y conserva seguimiento de resultados remotos inciertos

### Requirement: Compensación y eliminación remota recuperables
El sistema MUST registrar duraderamente la identidad prevista antes del upload y SHALL reconciliar assets propios no confirmados tras errores o reinicios. La retirada autorizada de una referencia y su trabajo de limpieza MUST confirmarse en una misma transacción. La eliminación física SHALL comprobar propiedad, carpeta y ausencia de referencias con coordinación que impida carreras con cargas en confirmación. Los reintentos SHALL ser acotados y seguros, con reconciliación operativa. El sistema MUST NOT eliminar logos, assets ajenos, referencias externas Picsum ni carpetas completas.

#### Scenario: Upload aceptado y persistencia fallida
- **WHEN** Cloudinary almacena el archivo pero falla PostgreSQL o el API se reinicia antes de confirmar
- **THEN** la galería no adquiere una referencia no confirmada y el seguimiento permite identificar y limpiar el asset propio no referenciado, incluso si se perdió la respuesta

#### Scenario: Limpieza temporalmente fallida
- **WHEN** se confirma una eliminación y falla la limpieza física
- **THEN** la referencia permanece retirada y la limpieza queda pendiente para reintento tras reinicio sin duplicar la eliminación lógica ni borrar assets referenciados

#### Scenario: Asset referenciado o ajeno
- **WHEN** una limpieza encuentra un asset referenciado, ajeno o fuera de la carpeta autorizada
- **THEN** no lo elimina y registra un resultado seguro para revisión sin ejecutar borrados masivos

#### Scenario: Repetición de limpieza
- **WHEN** se repite la limpieza de un asset propio ya ausente
- **THEN** concluye de manera segura sin volver a cargar bytes ni afectar otros assets

### Requirement: Misma experiencia de galería y pruebas aisladas
Las tarjetas y galerías SHALL presentar URLs Cloudinary conservando accesibilidad, fallbacks, temas, borradores, foco y controles actuales. Esta fase MUST NOT agregar transformación, recorte o controles de calidad. Las pruebas normales SHALL aislar base y almacenamiento sin credenciales reales; cualquier prueba real SHALL ser opt-in con autorización específica en cuenta no productiva y limpieza limitada a su asset temporal.

#### Scenario: Renderizado sin rediseño
- **WHEN** se consulta una portada o galería con imágenes Cloudinary
- **THEN** ambas aplicaciones presentan las imágenes con la UI existente y los cuatro temas, sin hosts arbitrarios ni credenciales expuestas

#### Scenario: Respuesta de carga incierta
- **WHEN** la interfaz pierde la respuesta o recibe timeout de una carga
- **THEN** no reintenta automáticamente ni confirma éxito, conserva borradores y permite recuperar el detalle autoritativo mientras el backend reconcilia

#### Scenario: Prueba real autorizada
- **WHEN** se autoriza expresamente una prueba Cloudinary de desarrollo
- **THEN** se carga un asset temporal identificado en `codex-storefront`, se verifica carpeta y visualización y se elimina únicamente ese asset, sin modificar productos o datos de desarrollo ni activar el proveedor automáticamente
