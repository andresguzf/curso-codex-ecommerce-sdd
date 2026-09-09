## Purpose

Define el carrito público y persistente para visitantes o clientes autenticados, y un checkout protegido que valida identidad, productos, cantidades, totales siempre expresados en `USD`, pago simulado y método de envío, sin conversión ni selección de moneda.

## ADDED Requirements

### Requirement: Carrito público por cliente o visitante
El sistema SHALL permitir agregar productos, cambiar cantidades, consultar y eliminar líneas sin registro ni login, y SHALL mantener como máximo un carrito activo por cliente autenticado o por identificador anónimo vigente.

#### Scenario: Visitante agrega un producto
- **WHEN** una persona sin sesión agrega una cantidad positiva que no supera el stock disponible
- **THEN** el sistema crea o actualiza una línea en un carrito anónimo persistente sin exigir registro ni login

#### Scenario: Agregar un producto disponible
- **WHEN** un cliente autenticado agrega una cantidad positiva que no supera el stock disponible
- **THEN** el sistema crea o actualiza la línea correspondiente en su carrito activo

#### Scenario: Cantidad superior al stock
- **WHEN** un cliente intenta agregar o actualizar una cantidad superior a la disponibilidad actual
- **THEN** el sistema rechaza la cantidad e informa la disponibilidad aceptable

### Requirement: Persistencia y aislamiento del carrito anónimo
El sistema SHALL persistir el carrito anónimo en PostgreSQL, SHALL identificarlo mediante una credencial opaca almacenada en una cookie protegida y MUST impedir que una persona consulte o modifique un carrito anónimo sin poseer su identificador válido.

#### Scenario: Visitante vuelve posteriormente
- **WHEN** un visitante conserva la cookie válida y vuelve al storefront dentro del período de vigencia
- **THEN** el sistema recupera el mismo carrito y sus líneas desde PostgreSQL

#### Scenario: Identificador anónimo inválido
- **WHEN** una solicitud presenta un identificador inexistente, vencido o manipulado
- **THEN** el sistema no expone ningún carrito ajeno y puede crear un carrito anónimo vacío para continuar navegando

#### Scenario: Carrito anónimo vencido
- **WHEN** un carrito anónimo supera el período de retención configurado
- **THEN** el sistema puede eliminarlo mediante una limpieza segura sin afectar carritos de clientes ni inventario

### Requirement: Vinculación del carrito al autenticarse
El sistema SHALL vincular el carrito anónimo al cliente cuando este inicia sesión y no tiene un carrito activo, o SHALL fusionarlo transaccionalmente con su carrito activo sumando líneas coincidentes hasta la disponibilidad vigente e informando cualquier ajuste de cantidad.

#### Scenario: Cliente sin carrito previo
- **WHEN** un visitante con carrito inicia sesión como `CUSTOMER` y no existe otro carrito activo para esa cuenta
- **THEN** el sistema asocia el carrito existente al cliente sin perder sus líneas ni totales

#### Scenario: Cliente con carrito previo
- **WHEN** un visitante con carrito inicia sesión como `CUSTOMER` y la cuenta ya tiene un carrito activo
- **THEN** el sistema fusiona ambos carritos en una sola operación, mantiene un único carrito activo y devuelve las cantidades y totales resultantes

#### Scenario: Suma superior al stock durante la fusión
- **WHEN** la suma de una línea anónima y una línea autenticada supera el stock disponible
- **THEN** el sistema conserva hasta la cantidad disponible e informa que esa línea fue ajustada sin reservar ni descontar inventario

### Requirement: Totales del carrito
El sistema SHALL calcular el subtotal y total autoritativos desde precios vigentes y cantidades válidas, y SHALL actualizarlos después de cada cambio del carrito.

#### Scenario: Cambio de cantidad
- **WHEN** el cliente modifica la cantidad de una línea
- **THEN** el sistema devuelve el carrito con los subtotales de línea y total recalculados

### Requirement: Validación final de checkout
El sistema MUST exigir una sesión `CUSTOMER` antes de aceptar el checkout y MUST revalidar identidad, estado de productos, precios, cantidades y stock inmediatamente antes de completarlo.

#### Scenario: Visitante intenta iniciar checkout
- **WHEN** una persona con carrito anónimo intenta continuar al checkout sin iniciar sesión
- **THEN** la interfaz solicita registro o login, conserva el carrito y permite retomar el checkout después de autenticarse

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

### Requirement: Indicador global del carrito
El storefront SHALL mostrar en la navegación la cantidad total de unidades del carrito activo, SHALL actualizarla después de agregar, cambiar o eliminar una línea y SHALL permitir abrir el detalle del carrito desde ese indicador.

#### Scenario: Cantidad actualizada
- **WHEN** una operación válida de un visitante o cliente cambia las cantidades del carrito
- **THEN** el indicador de navegación muestra la suma vigente de unidades de todas las líneas

#### Scenario: Abrir el carrito
- **WHEN** una persona activa el indicador global del carrito
- **THEN** el storefront navega al detalle del carrito activo y muestra sus líneas y cantidades vigentes

### Requirement: Retroalimentación de operaciones del carrito
La interfaz SHALL mostrar un mensaje flash accesible después de agregar un producto, cambiar una cantidad o eliminar una línea, y SHALL presentar de forma clara los errores de disponibilidad o validación.

#### Scenario: Producto agregado
- **WHEN** un visitante o cliente agrega correctamente un producto disponible
- **THEN** la interfaz confirma la operación, actualiza totales e indicador y navega al detalle del carrito con la cantidad vigente

#### Scenario: Cantidad rechazada
- **WHEN** el backend rechaza una cantidad superior al stock disponible
- **THEN** la interfaz conserva la última cantidad válida e informa la disponibilidad aceptable sin confirmar éxito

### Requirement: Confirmación antes de eliminar una línea
La interfaz MUST solicitar confirmación explícita mediante un diálogo modal accesible antes de eliminar un producto del carrito.

#### Scenario: Cliente confirma eliminación
- **WHEN** un cliente confirma la eliminación de una línea del carrito
- **THEN** la interfaz envía la operación, recalcula totales e indicador y muestra el mensaje flash correspondiente

#### Scenario: Cliente cancela eliminación
- **WHEN** un cliente cancela el diálogo de eliminación
- **THEN** la interfaz no envía la operación y mantiene intacto el carrito

### Requirement: Agregar al carrito desde deseos
El storefront SHALL permitir agregar al carrito un producto de la lista de deseos sujeto a las mismas validaciones de producto activo, cantidad y stock, sin eliminarlo automáticamente de deseos.

#### Scenario: Producto deseado disponible
- **WHEN** un cliente agrega desde deseos una cantidad válida de un producto activo con stock
- **THEN** el sistema actualiza el carrito, mantiene el producto en deseos y devuelve los totales e indicador vigentes
