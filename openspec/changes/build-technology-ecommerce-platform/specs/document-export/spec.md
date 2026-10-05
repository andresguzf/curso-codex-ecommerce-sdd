## Purpose

Define documentos PDF consistentes y protegidos para representar órdenes y facturas sin exponer información de otros clientes.

## ADDED Requirements

### Requirement: Logos y documentos históricos portables en Vercel
El sistema SHALL generar PDF con el SVG empresarial fijo versionado incluido en el artefacto para los nuevos snapshots, sin carga manual ni almacenamiento mutable o Cloudinary. MUST resolverlo por identidad histórica y verificar su huella, conservando versiones incluidas cuando cambie el diseño. Para documentos anteriores MUST preservar bytes, claves, huellas y snapshots; no subir logos a codex-storefront, sustituirlos por el logo vigente, truncar documentos o borrar originales. Una transferencia de archivos históricos existentes MUST ser autorizada específicamente. MUST comprobar entrega PDF dentro de límites de Function y no declarar la exportación histórica funcional si depende de archivos sólo presentes en la máquina local.

#### Scenario: PDF histórico después de cambiar de instancia
- **WHEN** se exporta una orden o factura cuyo snapshot contiene un logo administrado y el runtime es una instancia nueva
- **THEN** obtiene los bytes por su referencia y verifica la huella: del recurso versionado incluido para el SVG fijo o del almacenamiento histórico preservado para un logo anterior, sin consultar el logo actual ni depender de archivos creados en otra instancia

#### Scenario: Portabilidad incompleta no se oculta
- **WHEN** faltan assets históricos o la estrategia durable aún no está resuelta
- **THEN** se conserva el error explícito y el despliegue no se marca completado ocultando ni sustituyendo el logo histórico; la retirada autorizada de la carga manual no elimina la obligación de preservar documentos anteriores

### Requirement: Diseño empresarial tabular de órdenes y facturas PDF
Los PDF SHALL presentar un layout empresarial legible con paleta azul oscuro, fondo claro, márgenes y jerarquía tipográfica consistentes, independiente del tema de la UI. SHALL incluir cabecera con logo histórico cuando exista, datos de empresa, tipo de documento, número, fecha y estado; un bloque separado de cliente/dirección disponible en el snapshot; y una tabla con encabezados, columnas y filas para producto/SKU, cantidad, precio unitario, impuestos e importe. Los importes SHALL alinearse a la derecha y los textos largos SHALL ajustarse sin superposición. SHALL mostrar subtotal, impuestos, envío cuando corresponda y total en USD en un bloque destacado, junto con pago/envío u origen según el documento. MUST usar exclusivamente valores históricos, sin recalcular la operación comercial, inventar impuestos, direcciones, descuentos o datos fiscales. DRAFT MUST seguir identificándose visiblemente como borrador sin número definitivo.

#### Scenario: Factura con tabla y totales
- **WHEN** un actor autorizado exporta una factura manual o derivada
- **THEN** obtiene un PDF con cabecera, cliente, tabla de todas sus líneas e importes históricos alineados, estado/origen y totales legibles, no una lista de texto corrido

#### Scenario: Orden con envío y pago
- **WHEN** un actor autorizado exporta una orden
- **THEN** obtiene el mismo sistema visual con tabla de productos, dirección, pago/envío y desglose que incluye el costo de envío histórico sin añadirlo dos veces

### Requirement: Tablas PDF multipágina sin pérdida de contenido
El generador SHALL paginar según el espacio disponible y la altura real del texto, repetir los encabezados de tabla en continuaciones y numerar páginas. MUST conservar todas las líneas y sus textos, sin límites de recorte ni omisión silenciosa. SHALL separar tablas, totales y pie, evitando solapamientos; los textos o filas que excedan una página MUST continuar de forma legible sin perder datos. La implementación SHALL verificarse mediante extracción de contenido y revisión visual de PDFs renderizados, incluyendo órdenes/facturas cortas, largas y nombres extensos.

#### Scenario: Documento con muchos ítems
- **WHEN** una orden o factura tiene más filas que las que caben en una página
- **THEN** se generan todas las páginas necesarias con encabezados repetidos, números de página y todos los ítems/totales sin cortes, omisiones ni superposiciones

#### Scenario: Texto largo o caracteres españoles
- **WHEN** nombres, SKU o direcciones requieren varias líneas o contienen caracteres españoles
- **THEN** el PDF mantiene texto legible, columnas alineadas y alturas ajustadas sin invadir otras celdas, totales o pie

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
