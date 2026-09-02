## Purpose

Define el catálogo tecnológico público y administrativo, incluyendo productos, disponibilidad, búsqueda, ordenamiento y navegación paginada.

## ADDED Requirements

### Requirement: Datos de producto
El sistema SHALL mantener para cada producto un identificador, SKU único, nombre, descripción, precio no negativo, moneda, imagen, fechas de creación y actualización, estado `ACTIVE` o `INACTIVE` y disponibilidad de stock.

#### Scenario: Producto válido
- **WHEN** un administrador crea un producto con todos los datos obligatorios válidos
- **THEN** el sistema guarda el producto y asigna sus identificadores y fechas de auditoría

#### Scenario: SKU duplicado
- **WHEN** un administrador intenta guardar un SKU ya utilizado
- **THEN** el sistema rechaza la operación con un error de validación

### Requirement: Catálogo público
El sistema SHALL mostrar un hero, una lista de productos activos y el detalle de cada producto, incluyendo precio, imagen, descripción y stock disponible.

#### Scenario: Producto inactivo
- **WHEN** un visitante consulta el catálogo público
- **THEN** el sistema excluye todos los productos inactivos o eliminados lógicamente

#### Scenario: Producto sin stock
- **WHEN** un producto activo tiene disponibilidad cero
- **THEN** el catálogo muestra el producto como agotado y no permite agregarlo al carrito

### Requirement: Búsqueda, filtros y ordenamiento
El sistema SHALL permitir buscar productos por nombre, descripción o SKU, filtrar al menos por estado y disponibilidad cuando el contexto lo autorice, y ordenar por campos admitidos.

#### Scenario: Búsqueda combinada con filtros
- **WHEN** un usuario aplica búsqueda, filtros y ordenamiento
- **THEN** el sistema devuelve únicamente los productos coincidentes en el orden solicitado y conserva esos criterios al navegar páginas

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
- **THEN** la interfaz muestra la primera página del catálogo filtrada por ese término y refleja la búsqueda en la URL

### Requirement: Filtros colapsables del catálogo público
El catálogo público SHALL presentar sus filtros en un sidebar izquierdo colapsable y SHALL ofrecer un control equivalente adaptado a pantallas pequeñas, conservando búsqueda, filtros, orden y página en la URL.

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
El sistema SHALL permitir múltiples imágenes ordenadas por producto, MUST mantener exactamente una imagen principal entre las imágenes de un producto publicable y SHALL conservar texto alternativo descriptivo para cada imagen.

#### Scenario: Producto con galería válida
- **WHEN** un administrador guarda un producto con una portada y varias imágenes adicionales válidas
- **THEN** el sistema conserva una única portada, el orden de la galería y el texto alternativo de todas las imágenes

#### Scenario: Cambio de portada
- **WHEN** un administrador selecciona otra imagen de la galería como principal
- **THEN** el sistema desmarca la portada anterior y mantiene exactamente una imagen principal

#### Scenario: Producto sin portada
- **WHEN** se intenta activar o publicar un producto con imágenes pero sin una portada válida
- **THEN** el sistema rechaza la operación e identifica el requisito de imagen principal

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
La landing SHALL mostrar como máximo los nueve productos activos más recientes ordenados por fecha de creación descendente, SHALL omitir controles de paginación y SHALL ofrecer un enlace visible hacia el catálogo completo.

#### Scenario: Existen más de nueve productos activos
- **WHEN** una persona visita la landing y existen más de nueve productos activos
- **THEN** la página muestra exactamente los nueve más recientes, no muestra paginador y permite ir a “Ver todos los productos”

#### Scenario: Existen menos de nueve productos activos
- **WHEN** existen menos de nueve productos activos
- **THEN** la landing muestra todos los disponibles sin completar con productos inactivos ni presentar paginación

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
La landing SHALL presentar primero hasta tres productos activos destacados ordenados por fecha de destaque descendente, después hasta nueve productos activos recientes que no aparezcan en destacados y finalmente entre dos y tres secciones de categorías importantes ordenadas, cada una con hasta tres productos activos recientes.

#### Scenario: Landing con contenido completo
- **WHEN** existen al menos tres destacados activos, nueve productos recientes adicionales y tres categorías importantes con productos
- **THEN** la landing muestra en orden tres destacados, nueve recientes sin repetir los destacados y tres secciones de categoría con tres productos cada una

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
El API SHALL devolver mediante una única consulta pública la composición vigente de la landing con `featuredProducts`, `latestProducts` y `highlightedCategories`, aplicando límites, orden, visibilidad y deduplicación antes de responder.

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
