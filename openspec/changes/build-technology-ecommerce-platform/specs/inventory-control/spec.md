## Purpose

Define la disponibilidad de productos y las operaciones consistentes y auditables que aumentan, descuentan o restituyen existencias.

## ADDED Requirements

### Requirement: Bloqueos y trazabilidad de inventario en Supabase
El sistema SHALL conservar balances y movimientos y verificar bloqueos/transacciones reales en destino. Los pools que usen advisory locks de sesión MUST usar conexión directa o pool de sesión, nunca pool transaccional; conexiones TLS y presupuesto por procesos MUST estar validados antes del corte.

#### Scenario: Exclusión entre ejecutores con conexión admitida
- **WHEN** procesos distintos compiten por un advisory lock de coordinación en destino
- **THEN** se mantiene exclusión durante la operación y el bloqueo se libera al terminar o perder la sesión

#### Scenario: Rechazo de conexión incompatible
- **WHEN** se configura un modo transaccional, se desactiva TLS o se omite verificación del servidor sin el opt-in explícito de la excepción del curso
- **THEN** el preflight bloquea el corte en lugar de debilitar seguridad o ejecutar operaciones sin las garantías de sesión

### Requirement: Excepción TLS explícita para el curso
El sistema SHALL verificar certificado e identidad del servidor PostgreSQL por defecto. Para el curso, incluido su despliegue demo con NODE_ENV=production, SHALL permitir un opt-in privado explícito `DATABASE_TLS_VERIFY_SERVER=false` para mantener TLS cifrado sin CA ni verificación del servidor, con advertencia segura del riesgo de suplantación. MUST NOT usar fallback automático a este modo, desactivar TLS ni alterar globalmente la verificación TLS de otros servicios. La excepción no constituye una certificación de seguridad para producción real.

#### Scenario: Conexión del curso sin archivo CA
- **WHEN** se activa explícitamente la excepción para el curso
- **THEN** se permite la conexión PostgreSQL cifrada sin verificar certificado/hostname y se advierte que la identidad del servidor no está autenticada

#### Scenario: Despliegue docente con entorno production
- **WHEN** el despliegue demo del curso utiliza NODE_ENV=production y se activa explícitamente la excepción desde runtime, preflight o migrador
- **THEN** se permite únicamente PostgreSQL cifrado sin verificación del servidor, con advertencia del riesgo y sin desactivar la verificación TLS de otros servicios

#### Scenario: Un certificado inválido no activa una excepción
- **WHEN** falla la verificación y no existe opt-in explícito
- **THEN** la conexión falla de forma segura sin reintentar con verificación deshabilitada

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
