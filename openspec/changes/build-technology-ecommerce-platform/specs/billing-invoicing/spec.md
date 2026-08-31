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

