## Purpose

Define el acceso seguro al e-commerce, las sesiones de usuario y la autorización de clientes, administradores y personal de facturación.

## ADDED Requirements

### Requirement: Registro público de clientes
El sistema SHALL permitir el registro público con credenciales válidas y SHALL asignar exclusivamente el rol `CUSTOMER`, sin aceptar una elevación de rol solicitada por el cliente.

#### Scenario: Registro exitoso
- **WHEN** una persona envía datos válidos con un correo no registrado
- **THEN** el sistema crea una cuenta activa con rol `CUSTOMER`

#### Scenario: Intento de elegir un rol privilegiado
- **WHEN** el registro público incluye `ADMIN` o `BILLING` como rol solicitado
- **THEN** el sistema rechaza o ignora el rol solicitado y nunca crea una cuenta privilegiada

### Requirement: Autenticación y sesión
El sistema SHALL permitir login, renovación controlada de sesión y logout, y MUST invalidar el acceso cuando la cuenta esté inactiva o bloqueada.

#### Scenario: Inicio de sesión válido
- **WHEN** un usuario activo presenta credenciales correctas
- **THEN** el sistema crea una sesión autenticada asociada a su identidad y rol

#### Scenario: Cierre de sesión
- **WHEN** un usuario autenticado solicita logout
- **THEN** el sistema invalida su sesión y rechaza el uso posterior de sus credenciales de sesión revocadas

### Requirement: Autorización basada en tres roles
El sistema SHALL reconocer únicamente `CUSTOMER`, `ADMIN` y `BILLING`, y SHALL comprobar los permisos en cada operación protegida del API.

#### Scenario: Cliente intenta entrar al back office
- **WHEN** un usuario `CUSTOMER` solicita una operación administrativa
- **THEN** el sistema deniega la operación sin depender de los controles visuales del frontend

#### Scenario: Billing accede a facturación
- **WHEN** un usuario `BILLING` consulta órdenes o gestiona facturas
- **THEN** el sistema permite la operación dentro de los permisos de facturación y deniega gestión de usuarios, catálogo e inventario

### Requirement: Administración de usuarios
El sistema SHALL permitir que `ADMIN` cree, consulte, modifique, active y desactive usuarios, y asigne cualquiera de los tres roles sin eliminar el historial comercial asociado.

#### Scenario: Administrador crea un usuario privilegiado
- **WHEN** un administrador crea un usuario válido con rol `ADMIN` o `BILLING`
- **THEN** el sistema guarda el usuario con el rol solicitado y registra la operación en auditoría

#### Scenario: Protección del último administrador
- **WHEN** una operación dejaría al sistema sin ningún administrador activo
- **THEN** el sistema rechaza la operación

### Requirement: Aislamiento de datos del cliente
El sistema MUST limitar a cada `CUSTOMER` a sus propios datos, carrito, órdenes, facturas y documentos.

#### Scenario: Cliente consulta una orden ajena
- **WHEN** un cliente solicita una orden perteneciente a otro cliente
- **THEN** el sistema deniega el acceso sin revelar los datos de la orden

