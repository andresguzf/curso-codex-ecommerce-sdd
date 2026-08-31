## Purpose

Define el ciclo de vida de las órdenes de compra, su historial, estados operativos, snapshots y permisos de consulta y administración.

## ADDED Requirements

### Requirement: Creación de orden confirmada
El sistema SHALL crear una orden con número único, cliente, líneas, precios, moneda, totales, dirección, envío y pago como snapshots inmutables cuando un checkout sea exitoso.

#### Scenario: Orden creada desde checkout
- **WHEN** un checkout concluye exitosamente
- **THEN** el sistema crea una única orden `PROCESSING` cuyos datos históricos no cambian cuando se edita el catálogo o el perfil del cliente

### Requirement: Estados independientes de orden
El sistema SHALL administrar el estado operativo de la orden de manera independiente a los estados de pago y factura, admitiendo al menos `PROCESSING`, `INVOICED`, `COMPLETED` y `CANCELLED` con transiciones válidas.

#### Scenario: Transición inválida
- **WHEN** un usuario intenta aplicar una transición no permitida para el estado actual
- **THEN** el sistema rechaza la transición y conserva el estado anterior

### Requirement: Historial de compras del cliente
El sistema SHALL permitir que cada cliente liste y consulte exclusivamente sus propias órdenes, con filtros y paginación cuando existan múltiples resultados.

#### Scenario: Consulta de mis compras
- **WHEN** un cliente autenticado solicita su historial
- **THEN** el sistema devuelve sus órdenes ordenadas de la más reciente a la más antigua sin incluir órdenes de otros clientes

### Requirement: Administración de órdenes
El sistema SHALL permitir que `ADMIN` consulte y gestione todas las órdenes, mientras que `BILLING` SHALL poder consultarlas y ejecutar únicamente operaciones relacionadas con su facturación.

#### Scenario: Billing intenta cancelar una orden
- **WHEN** un usuario `BILLING` intenta cancelar o completar una orden fuera del flujo de facturación
- **THEN** el sistema deniega la operación

### Requirement: Cancelación consistente
El sistema SHALL registrar el motivo y autor de una cancelación y SHALL coordinar la restitución de inventario exactamente una vez cuando la orden ya hubiera descontado existencias.

#### Scenario: Cancelación de orden confirmada
- **WHEN** un administrador cancela una orden elegible que consumió inventario
- **THEN** el sistema cambia la orden a `CANCELLED` y registra los movimientos compensatorios sin duplicarlos en reintentos

### Requirement: Consulta de órdenes con herramientas de backoffice
El sistema SHALL paginar desde el backend las listas de órdenes con `items`, `page`, `pageSize`, `totalItems` y `totalPages`, y la interfaz administrativa SHALL ofrecer búsqueda sobre la lista y filtros colapsables por cliente, fecha, estado y facturación.

#### Scenario: Billing filtra órdenes pendientes de facturar
- **WHEN** un usuario `BILLING` combina una búsqueda con filtros de estado y solicita una página
- **THEN** el sistema devuelve únicamente las órdenes autorizadas de esa página y los metadatos del conjunto filtrado

#### Scenario: Cambio de filtros de órdenes
- **WHEN** un usuario autorizado cambia la búsqueda, filtros, orden o tamaño de página
- **THEN** la interfaz vuelve a la primera página y conserva los criterios en la URL

### Requirement: Snapshot del emisor en la orden
El sistema SHALL copiar en cada orden confirmada los datos vigentes de la empresa emisora necesarios para su representación comercial y MUST conservar ese snapshot aunque el perfil de la tienda cambie posteriormente.

#### Scenario: Cambio posterior de empresa
- **WHEN** un administrador modifica los datos de la empresa después de confirmar una orden
- **THEN** la orden existente mantiene la razón social, identificador fiscal, dirección y demás datos del emisor capturados al confirmarse
