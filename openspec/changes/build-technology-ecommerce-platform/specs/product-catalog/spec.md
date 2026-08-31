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
