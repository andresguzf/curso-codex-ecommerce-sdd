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

### Requirement: Consulta administrativa paginada de usuarios
El sistema SHALL permitir que `ADMIN` busque, filtre y ordene usuarios mediante una lista paginada por el backend que incluya `items`, `page`, `pageSize`, `totalItems` y `totalPages`.

#### Scenario: Administrador busca clientes activos
- **WHEN** un administrador busca usuarios con rol `CUSTOMER` y estado activo
- **THEN** el sistema devuelve únicamente los usuarios coincidentes junto con metadatos de paginación calculados sobre el resultado filtrado

#### Scenario: Cambio de criterios de usuarios
- **WHEN** el administrador cambia la búsqueda, filtros, orden o tamaño de página
- **THEN** la lista vuelve a la primera página y conserva los criterios vigentes en la URL

### Requirement: Retroalimentación de autenticación
La interfaz SHALL mostrar un mensaje flash accesible después de un login o logout exitoso y SHALL mostrar un mensaje seguro cuando el login falle, sin revelar si una cuenta concreta existe.

#### Scenario: Login exitoso
- **WHEN** un usuario inicia sesión con credenciales válidas
- **THEN** la interfaz confirma el acceso mediante un mensaje flash y presenta la navegación correspondiente a su rol

#### Scenario: Logout exitoso
- **WHEN** un usuario cierra su sesión
- **THEN** la interfaz confirma el cierre mediante un mensaje flash y presenta las opciones para visitantes

### Requirement: Confirmación de acciones destructivas sobre usuarios
La interfaz administrativa MUST solicitar confirmación explícita mediante un diálogo modal accesible antes de desactivar o eliminar lógicamente un usuario.

#### Scenario: Administrador cancela la confirmación
- **WHEN** un administrador inicia la desactivación de un usuario y cancela el diálogo
- **THEN** la interfaz cierra el diálogo sin enviar la operación ni cambiar el usuario

### Requirement: Usuarios demostrativos no productivos
Los entornos de desarrollo y pruebas SHALL poder crear idempotentemente un usuario de ejemplo `ADMIN` y un usuario de ejemplo `CUSTOMER` con credenciales explícitamente no productivas, y MUST impedir que este seed se ejecute automáticamente en producción.

#### Scenario: Seed de usuarios permitido
- **WHEN** se ejecuta el seed en desarrollo o pruebas con su configuración válida
- **THEN** el sistema crea o actualiza exactamente los usuarios demostrativos `ADMIN` y `CUSTOMER` sin duplicarlos y almacena sus contraseñas únicamente como hashes

#### Scenario: Seed de usuarios en producción
- **WHEN** se intenta ejecutar el seed demostrativo de usuarios en producción
- **THEN** el sistema rechaza la operación antes de crear o modificar cuentas y no registra las credenciales en logs
