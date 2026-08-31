## Purpose

Define documentos PDF consistentes y protegidos para representar órdenes y facturas sin exponer información de otros clientes.

## ADDED Requirements

### Requirement: Exportación PDF de órdenes
El sistema SHALL generar una representación PDF de una orden que incluya número, cliente, fechas, líneas, cantidades, precios, totales, pago, envío y estado.

#### Scenario: Cliente descarga su orden
- **WHEN** un cliente solicita el PDF de una orden propia
- **THEN** el sistema devuelve un archivo PDF correspondiente al snapshot autorizado de la orden

#### Scenario: Cliente solicita una orden ajena
- **WHEN** un cliente solicita el PDF de una orden de otro cliente
- **THEN** el sistema deniega la descarga sin exponer el contenido del documento

### Requirement: Exportación PDF de facturas
El sistema SHALL generar una representación PDF de factura con número, emisor, cliente, origen, líneas, impuestos, moneda, totales, fechas y estado.

#### Scenario: Factura emitida
- **WHEN** un usuario autorizado solicita una factura emitida en PDF
- **THEN** el sistema genera o recupera un documento basado en el snapshot inmutable de la factura

#### Scenario: Factura borrador
- **WHEN** un usuario autorizado exporta una factura `DRAFT`
- **THEN** el documento identifica de forma visible que se trata de un borrador sin número definitivo de emisión

### Requirement: Autorización de documentos
El sistema SHALL permitir a `ADMIN` y `BILLING` exportar documentos administrativos y SHALL restringir a `CUSTOMER` a sus propias órdenes y facturas.

#### Scenario: Usuario no autenticado
- **WHEN** una persona no autenticada solicita un documento protegido
- **THEN** el sistema rechaza la solicitud

### Requirement: Consistencia de regeneración
El sistema MUST producir documentos con los datos históricos guardados, aun cuando cambien posteriormente el producto, cliente, precio o dirección.

#### Scenario: Regeneración posterior
- **WHEN** se vuelve a generar un PDF después de modificar datos maestros relacionados
- **THEN** el contenido comercial del documento coincide con el snapshot de la orden o factura original

