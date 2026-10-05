## Purpose

Define documentos PDF consistentes y protegidos para representar órdenes y facturas sin exponer información de otros clientes.

## ADDED Requirements

### Requirement: Documentos históricos independientes del alojamiento PostgreSQL
El sistema SHALL preservar snapshots empresariales, referencias y huellas de logos al migrar a Supabase. Los archivos locales y sus volúmenes MUST conservarse; generar PDFs MUST seguir usando snapshots y bytes históricos, sin Supabase Storage ni sustitución por el perfil vigente.

#### Scenario: Exportación histórica después del corte
- **WHEN** un actor autorizado exporta una orden o factura migrada
- **THEN** el documento mantiene datos e identidad empresarial históricos y verifica el logo referenciado, sin consultar un emisor nuevo ni cambiar importes

#### Scenario: Archivo histórico perdido no se oculta
- **WHEN** falta un logo declarado en un snapshot migrado
- **THEN** se devuelve el error explícito existente sin sustituirlo por el logo vigente

### Requirement: Exportación PDF de órdenes
El sistema SHALL generar una representación PDF de una orden que incluya número, cliente, fechas, líneas, cantidades, precios, totales, pago, envío y estado.

#### Scenario: Cliente descarga su orden
- **WHEN** un cliente solicita el PDF de una orden propia
- **THEN** el sistema devuelve un archivo PDF correspondiente al snapshot autorizado de la orden

#### Scenario: Cliente solicita una orden ajena
- **WHEN** un cliente solicita el PDF de una orden de otro cliente
- **THEN** el sistema deniega la descarga sin exponer el contenido del documento

### Requirement: Exportación PDF de facturas
El sistema SHALL generar una representación PDF de factura con número, emisor, cliente, origen, líneas, impuestos, código de moneda `USD`, totales, fechas y estado, sin aplicar conversiones de divisa.

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

### Requirement: Identidad empresarial en documentos
Los PDF de órdenes y facturas SHALL incluir el nombre comercial, razón social, identificador fiscal y dirección del snapshot empresarial del documento correspondiente y SHALL incrustar visualmente la versión inmutable del logo cuando el snapshot la referencie. El generador MUST verificar la huella del asset y MUST NOT consultar el perfil vigente, descargar una URL remota ni sustituir un logo histórico por uno nuevo.

#### Scenario: Documento histórico tras actualizar la empresa
- **WHEN** un usuario autorizado regenera el PDF de una orden o factura creada antes de actualizar el perfil de la tienda
- **THEN** el PDF conserva la identidad empresarial histórica del snapshot y no mezcla datos del perfil vigente

#### Scenario: Logo histórico sustituido en el perfil
- **WHEN** un administrador reemplaza el logo vigente y se regenera un PDF cuyo snapshot contiene la referencia anterior
- **THEN** el PDF vuelve a incrustar visualmente los bytes verificados de la versión anterior

#### Scenario: Logo ausente o asset alterado
- **WHEN** el snapshot no contiene logo, o contiene uno cuyo asset falta o no coincide con su huella
- **THEN** el documento sin logo se genera normalmente, mientras que el asset faltante o alterado produce un error explícito sin recurrir al logo vigente
