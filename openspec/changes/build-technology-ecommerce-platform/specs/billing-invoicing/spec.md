## Purpose

Define facturas independientes, auditables y generables manualmente o desde órdenes, con estados, numeración y control de acceso propios.

## ADDED Requirements

### Requirement: Factura generada desde una orden
El sistema SHALL permitir que `ADMIN` o `BILLING` generen una factura desde una orden elegible y SHALL cambiar atómicamente la orden a `INVOICED` sin modificar inventario.

#### Scenario: Conversión exitosa
- **WHEN** un usuario autorizado factura una orden `PROCESSING` que aún no tiene factura activa
- **THEN** el sistema crea la factura con snapshots de la orden y cambia la orden a `INVOICED` en una sola operación

#### Scenario: Facturación duplicada
- **WHEN** se intenta generar otra factura activa desde una orden ya facturada
- **THEN** el sistema rechaza la operación sin crear duplicados

### Requirement: Factura manual
El sistema SHALL permitir que `ADMIN` o `BILLING` creen una factura manual seleccionando un cliente y definiendo líneas, cantidades, precios e impuestos sin requerir una orden y sin alterar inventario.

#### Scenario: Creación manual válida
- **WHEN** un usuario autorizado crea una factura manual con cliente y líneas válidas
- **THEN** el sistema guarda una factura cuyo origen es `MANUAL` y que no referencia una orden

### Requirement: Estados de factura y pago
El sistema SHALL mantener el estado de factura independiente de la orden y SHALL admitir al menos `DRAFT`, `PENDING_PAYMENT`, `PAID` y `VOID` mediante transiciones autorizadas y auditadas.

#### Scenario: Factura de una orden pagada
- **WHEN** se emite una factura desde una orden cuyo pago está aprobado
- **THEN** la factura puede quedar `PAID` sin alterar el estado de pago histórico de la orden

#### Scenario: Factura pendiente
- **WHEN** se emite una factura cuyo pago no está aprobado
- **THEN** la factura queda `PENDING_PAYMENT` hasta que un usuario autorizado registre el pago o la anule

### Requirement: Numeración y snapshots
El sistema SHALL asignar a cada factura emitida un número único y SHALL conservar snapshots inmutables del emisor, cliente, líneas, precios, impuestos, moneda y totales.

#### Scenario: Cambio posterior del cliente o producto
- **WHEN** se modifican datos maestros después de emitir una factura
- **THEN** la factura conserva exactamente los datos con los que fue emitida

### Requirement: Consulta administrativa de facturas
El sistema SHALL permitir que `ADMIN` y `BILLING` listen, busquen, filtren y consulten facturas por cliente, fecha, estado y origen, y SHALL permitir al cliente consultar únicamente las propias.

#### Scenario: Billing consulta pendientes
- **WHEN** un usuario `BILLING` filtra facturas por `PENDING_PAYMENT`
- **THEN** el sistema devuelve las facturas autorizadas que coinciden con el filtro y sus datos de paginación

### Requirement: Perfil de la empresa emisora
El sistema SHALL mantener un único perfil vigente de la tienda con al menos nombre comercial, razón social, identificador fiscal, dirección física y referencia de logo, SHALL permitir que solo `ADMIN` lo modifique y SHALL permitir que `ADMIN` y `BILLING` lo consulten para facturación.

#### Scenario: Administrador actualiza la empresa
- **WHEN** un administrador guarda datos empresariales válidos
- **THEN** el sistema actualiza el perfil vigente, registra la operación y lo usa como emisor para nuevas órdenes y facturas

#### Scenario: Billing intenta modificar la empresa
- **WHEN** un usuario `BILLING` intenta editar el perfil de la tienda
- **THEN** el sistema deniega la modificación sin impedir su consulta autorizada

### Requirement: Snapshot empresarial de la factura
El sistema SHALL copiar en cada factura los datos vigentes del perfil de la empresa al crearla o emitirla y MUST mantener ese snapshot independiente de cambios posteriores del perfil.

#### Scenario: Factura después de cambiar la empresa
- **WHEN** se modifica el perfil de la tienda después de crear o emitir una factura
- **THEN** la factura existente conserva los datos empresariales históricos con los que fue generada

### Requirement: Autocomplete remoto para factura manual
La creación manual de facturas SHALL permitir buscar y seleccionar clientes y productos mediante autocomplete remoto autorizado, SHALL limitar los resultados devueltos y SHALL aceptar únicamente identificadores válidos confirmados por el backend.

#### Scenario: Buscar cliente
- **WHEN** un usuario autorizado escribe un término suficiente en el selector de cliente
- **THEN** el sistema devuelve una lista limitada de clientes coincidentes que el usuario puede consultar y seleccionar

#### Scenario: Buscar producto
- **WHEN** un usuario autorizado escribe un término suficiente en el selector de producto
- **THEN** el sistema devuelve productos coincidentes con sus datos comerciales vigentes sin descargar el catálogo completo

#### Scenario: Selección manipulada
- **WHEN** se envía un identificador de cliente o producto inexistente o no autorizado
- **THEN** el backend rechaza la factura sin confiar en el texto mostrado por el autocomplete

### Requirement: Consulta paginada de facturas en backoffice
El sistema SHALL paginar facturas desde el backend con `items`, `page`, `pageSize`, `totalItems` y `totalPages`, y la interfaz SHALL ubicar la búsqueda sobre la lista y los filtros en un panel colapsable por cliente, fecha, estado y origen.

#### Scenario: Buscar y filtrar facturas
- **WHEN** un usuario autorizado combina búsqueda, filtros y ordenamiento
- **THEN** el sistema devuelve la primera página coincidente y la interfaz conserva los criterios en la URL
