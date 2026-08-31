## Purpose

Define la disponibilidad de productos y las operaciones consistentes y auditables que aumentan, descuentan o restituyen existencias.

## ADDED Requirements

### Requirement: Balance y movimientos de inventario
El sistema SHALL mantener un balance por producto y SHALL registrar cada variación mediante un movimiento con tipo, cantidad, motivo, referencia, autor y fecha.

#### Scenario: Ajuste administrativo
- **WHEN** un administrador aplica un ajuste válido con su motivo
- **THEN** el sistema actualiza el balance y crea un movimiento auditable relacionado con el administrador

### Requirement: Prevención de stock negativo
El sistema MUST comprobar y modificar inventario de forma atómica, MUST impedir balances negativos y MUST resolver correctamente compras concurrentes sobre las mismas existencias.

#### Scenario: Dos compras compiten por la última unidad
- **WHEN** dos checkouts intentan adquirir simultáneamente la última unidad disponible
- **THEN** como máximo uno completa el descuento y el otro recibe un error de disponibilidad sin que el balance sea negativo

### Requirement: Descuento por compra
El sistema SHALL descontar inventario una sola vez al confirmar una compra con pago simulado aprobado y SHALL asociar el movimiento a la orden creada.

#### Scenario: Compra exitosa
- **WHEN** se confirma una orden válida de dos unidades
- **THEN** el sistema reduce el balance en dos y registra un único movimiento de salida vinculado a esa orden

### Requirement: Independencia respecto de facturación
El sistema MUST NOT modificar inventario al crear, emitir, pagar, anular o exportar una factura, sea manual o derivada de una orden.

#### Scenario: Factura desde orden
- **WHEN** una orden ya confirmada se convierte en factura
- **THEN** el inventario permanece sin cambios y no se crea un segundo movimiento de salida

#### Scenario: Factura manual
- **WHEN** un usuario autorizado crea una factura manual
- **THEN** el sistema no reserva, descuenta ni repone inventario

### Requirement: Disponibilidad pública
El sistema SHALL exponer la disponibilidad vigente al catálogo y SHALL impedir acciones de compra cuando la cantidad disponible sea cero.

#### Scenario: Agotamiento posterior a una compra
- **WHEN** una compra reduce la disponibilidad a cero
- **THEN** las consultas posteriores muestran el producto agotado y rechazan nuevas cantidades

### Requirement: Consulta administrativa paginada de inventario
El sistema SHALL permitir que `ADMIN` busque, filtre y ordene balances y movimientos de inventario mediante listas paginadas por el backend con `items`, `page`, `pageSize`, `totalItems` y `totalPages`.

#### Scenario: Buscar balance de producto
- **WHEN** un administrador busca un producto y aplica un filtro de disponibilidad
- **THEN** el sistema devuelve únicamente los balances coincidentes de la página solicitada junto con sus metadatos

#### Scenario: Consultar movimientos paginados
- **WHEN** un administrador consulta los movimientos de un producto con filtros permitidos
- **THEN** el sistema aplica los criterios antes de paginar y devuelve los movimientos auditables de esa página
