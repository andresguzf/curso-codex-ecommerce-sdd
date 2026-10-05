## Purpose

Define el acceso seguro al e-commerce, las sesiones de usuario y la autorización de clientes, administradores y personal de facturación.

## ADDED Requirements

### Requirement: Sesión HTTPS estable en las aplicaciones Vercel
El sistema SHALL conservar login, refresh, logout, CSRF y autorización propia en ambos frontends desplegados. SHALL usar rewrites de infraestructura REST al API bajo el origen del frontend para evitar dependencia de cookies de terceros entre dominios vercel.app, sin crear lógica comercial en Next.js. Cookies MUST ser HttpOnly/Secure, access tokens sólo en memoria y CORS una allowlist exacta sin wildcard con credenciales. PostgreSQL/JWT/Cloudinary/secretos del trabajo programado MUST permanecer privados del backend, nunca NEXT_PUBLIC ni artefactos/logs de build.

#### Scenario: Refresh conserva la sesión sin almacenar tokens persistentes
- **WHEN** un usuario inicia sesión por HTTPS en storefront o backoffice y recarga la página
- **THEN** recupera la identidad/rol mediante refresh protegido y puede cerrar sesión, sin exponer el refresh token al JavaScript ni persistir el access token en localStorage

#### Scenario: Dominio o rol no autorizado sigue rechazado
- **WHEN** una petición proviene de un origen ajeno a la allowlist o solicita un recurso prohibido para el rol
- **THEN** el API la rechaza y el despliegue no omite CORS, CSRF ni propiedad para permitirla

### Requirement: Identidad propia y frontera de acceso tras migrar a Supabase
El sistema SHALL conservar usuarios, IDs, hashes de contraseña, roles CUSTOMER/ADMIN/BILLING y sesiones existentes al trasladar PostgreSQL a Supabase. NestJS MUST seguir siendo la única frontera de acceso de la aplicación; las credenciales PostgreSQL MUST permanecer privadas y la Data API SHALL permanecer habilitada pero no consumida por la app. Las tablas de aplicación MUST tener RLS habilitado sin políticas públicas y permisos actuales/por defecto restringidos para impedir acceso de anon/authenticated/PUBLIC a tablas, secuencias y funciones de aplicación. La protección MUST aplicarse antes de importar datos; no se alteran Auth/Storage ni se fuerza RLS contra el propietario del backend.

#### Scenario: Continuidad de autenticación sin adoptar Supabase Auth
- **WHEN** la base migrada conserva datos y configuración de sesión y un usuario usa login o refresh mediante REST
- **THEN** el API aplica los mismos roles, hashes y protección CSRF sin convertir usuarios a Supabase Auth ni revivir sesiones expiradas o revocadas

#### Scenario: No existe acceso alternativo a datos protegidos
- **WHEN** un cliente intenta consultar datos de aplicación por Data API o con privilegios anon/authenticated
- **THEN** no obtiene acceso, tampoco a objetos futuros por privilegios por defecto, y la operación autorizada sigue pasando exclusivamente por NestJS

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
- **WHEN** un usuario `BILLING` consulta o administra órdenes o gestiona facturas
- **THEN** el sistema permite las operaciones de órdenes y facturación, incluida la conversión de una orden en factura y la creación de facturas manuales, y deniega gestión de usuarios, catálogo, ajustes directos de inventario y perfil empresarial

### Requirement: Administración de usuarios
El sistema SHALL permitir que `ADMIN` cree, consulte, modifique, active y desactive usuarios, y asigne cualquiera de los tres roles sin eliminar el historial comercial asociado.

#### Scenario: Administrador crea un usuario privilegiado
- **WHEN** un administrador crea un usuario válido con rol `ADMIN` o `BILLING`
- **THEN** el sistema guarda el usuario con el rol solicitado y registra la operación en auditoría

#### Scenario: Protección del último administrador
- **WHEN** una operación dejaría al sistema sin ningún administrador activo
- **THEN** el sistema rechaza la operación

### Requirement: Aislamiento de datos del cliente
El sistema MUST limitar a cada `CUSTOMER` a sus propios datos, carrito asociado, órdenes, facturas y documentos, y MUST aislar cada carrito anónimo mediante la posesión de un identificador opaco válido sin convertirlo en una identidad autorizada para checkout u otros recursos protegidos.

#### Scenario: Cliente consulta una orden ajena
- **WHEN** un cliente solicita una orden perteneciente a otro cliente
- **THEN** el sistema deniega el acceso sin revelar los datos de la orden

#### Scenario: Visitante intenta usar un identificador ajeno
- **WHEN** una persona presenta un identificador de carrito anónimo inválido, manipulado o que no puede verificarse
- **THEN** el sistema no revela ni modifica líneas de otro carrito y no concede acceso a órdenes, facturas o datos de clientes

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
