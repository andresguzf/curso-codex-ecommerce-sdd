## Purpose

Define el carrito persistente del cliente y un checkout seguro que valida productos, cantidades, totales, pago simulado y método de envío.

## ADDED Requirements

### Requirement: Carrito activo por cliente
El sistema SHALL mantener como máximo un carrito activo por cliente autenticado y SHALL permitir agregar productos, cambiar cantidades y eliminar líneas.

#### Scenario: Agregar un producto disponible
- **WHEN** un cliente agrega una cantidad positiva que no supera el stock disponible
- **THEN** el sistema crea o actualiza la línea correspondiente en su carrito activo

#### Scenario: Cantidad superior al stock
- **WHEN** un cliente intenta agregar o actualizar una cantidad superior a la disponibilidad actual
- **THEN** el sistema rechaza la cantidad e informa la disponibilidad aceptable

### Requirement: Totales del carrito
El sistema SHALL calcular el subtotal y total autoritativos desde precios vigentes y cantidades válidas, y SHALL actualizarlos después de cada cambio del carrito.

#### Scenario: Cambio de cantidad
- **WHEN** el cliente modifica la cantidad de una línea
- **THEN** el sistema devuelve el carrito con los subtotales de línea y total recalculados

### Requirement: Validación final de checkout
El sistema MUST revalidar identidad, estado de productos, precios, cantidades y stock inmediatamente antes de completar el checkout.

#### Scenario: Stock cambia antes de confirmar
- **WHEN** la cantidad disponible deja de cubrir el carrito antes de la confirmación
- **THEN** el sistema no crea la orden, no descuenta stock e informa las líneas que requieren ajuste

### Requirement: Pago y envío simulados
El checkout SHALL permitir seleccionar un método ficticio de pago y un método simulado de envío, guardar sus importes y snapshots en la compra y representar el resultado del pago de forma independiente al estado de la orden.

#### Scenario: Pago simulado aprobado
- **WHEN** el cliente confirma un checkout válido y la simulación aprueba el pago
- **THEN** el sistema crea una orden `PROCESSING`, registra el pago `APPROVED`, descuenta inventario una sola vez y cierra el carrito

#### Scenario: Pago simulado rechazado
- **WHEN** la simulación rechaza el pago
- **THEN** el sistema no crea una orden confirmada, no descuenta inventario y mantiene el carrito disponible para corrección o reintento

### Requirement: Checkout idempotente
El sistema MUST aceptar una clave de idempotencia por intento de checkout y MUST impedir órdenes o descuentos de inventario duplicados ante reintentos equivalentes.

#### Scenario: Repetición de solicitud exitosa
- **WHEN** el cliente repite un checkout con la misma clave de idempotencia
- **THEN** el sistema devuelve el resultado original sin crear otra orden ni otro movimiento de stock

