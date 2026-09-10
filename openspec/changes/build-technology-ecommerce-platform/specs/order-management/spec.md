## Purpose

Define el ciclo de vida de las órdenes de compra, su historial, estados operativos, snapshots y permisos de consulta y administración.

## ADDED Requirements

### Requirement: Creación de orden confirmada
El sistema SHALL crear una orden con número único, cliente, líneas, precios, código de moneda fijo `USD`, totales, dirección, envío y pago como snapshots inmutables cuando un checkout sea exitoso, sin admitir una moneda seleccionable por orden.

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
El sistema SHALL permitir que `ADMIN` y `BILLING` consulten y administren todas las órdenes mediante sus transiciones operativas válidas, incluidas la finalización, la cancelación elegible y la conversión atómica de una orden en factura. Esta administración MUST preservar los snapshots históricos y MUST NOT conceder a `BILLING` permisos para editar usuarios, catálogo, perfil empresarial ni realizar ajustes directos de inventario.

#### Scenario: Billing administra una orden
- **WHEN** un usuario `BILLING` solicita una transición válida sobre una orden
- **THEN** el sistema aplica la misma regla operativa, transacción y auditoría exigidas para `ADMIN` sin permitir la modificación de sus snapshots históricos

#### Scenario: Billing intenta alterar datos históricos
- **WHEN** un usuario `BILLING` intenta editar cliente, productos, cantidades, precios, dirección, envío o pago capturados en una orden
- **THEN** el sistema deniega la modificación y conserva intactos los snapshots de la orden

### Requirement: Cancelación consistente
El sistema SHALL registrar el motivo y autor de una cancelación y SHALL coordinar la restitución de inventario exactamente una vez cuando la orden ya hubiera descontado existencias.

La cancelación SHALL estar disponible para `ADMIN` y `BILLING` sobre órdenes `PROCESSING` o `INVOICED` sin facturas activas asociadas. Toda factura cuyo estado sea distinto de `VOID` SHALL considerarse activa y MUST anularse mediante el flujo de facturación antes de cancelar la orden. Cancelar MUST NOT modificar automáticamente la factura ni el pago histórico. La restitución automática y transaccional producida por esta operación MUST NOT conceder a `BILLING` acceso a ajustes manuales ni a la administración general del inventario.

#### Scenario: Orden con factura activa
- **WHEN** un usuario `ADMIN` o `BILLING` intenta cancelar una orden que tiene una factura no anulada
- **THEN** el sistema rechaza la cancelación sin cambiar la orden, el inventario, la factura ni el pago e informa que primero debe anularse la factura

#### Scenario: Orden facturada con factura anulada
- **WHEN** un usuario `ADMIN` o `BILLING` cancela con motivo una orden `INVOICED` cuyas facturas asociadas están anuladas
- **THEN** el sistema cancela la orden y restituye el stock consumido exactamente una vez, conservando la factura anulada y el pago histórico sin modificaciones

#### Scenario: Reintento de cancelación
- **WHEN** un usuario `ADMIN` o `BILLING` repite o envía concurrentemente la cancelación de la misma orden
- **THEN** el sistema conserva el primer motivo y autor registrados y no duplica la restitución ni la auditoría de cancelación

#### Scenario: Cancelación de orden confirmada
- **WHEN** un usuario `ADMIN` o `BILLING` cancela una orden elegible que consumió inventario
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
