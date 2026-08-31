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

