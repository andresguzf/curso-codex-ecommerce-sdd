# 24.1 — Preflight PostgreSQL / Supabase

Fecha: 2026-10-05. Estado: **24.1 completada según el plan simplificado del curso**.
Se comprobó conexión y compatibilidad básica; no se habilita aún una migración.
El origen se inspeccionó
con consultas READ ONLY; no hubo seed, exportación de datos, cambio de conexión,
creación de proyectos, reinicios ni operaciones Cloudinary.

## Origen observado

- Contenedor `postgres`, imagen `postgres:18.6`; servidor PostgreSQL
  `18.6 (Debian 18.6-1.pgdg13+2)`, base `ecommerce_backend_sdd`, UTF8, tamaño 11 MB.
- Puerto publicado 5432; volumen Docker nombrado `ecommerce_postgres_data`, montado
  en `/var/lib/postgresql`. Source reportado por Docker:
  `/var/lib/docker/volumes/ecommerce_postgres_data/_data`; en Docker Desktop esa
  ruta pertenece al entorno Linux administrado, no a un directorio macOS accesible
  directamente. No se cambió ni eliminó el volumen.
- `pg_dump` y `pg_restore` 18.6 disponibles dentro del contenedor; no se instalaron
  herramientas ni se generó un dump. Su disponibilidad no demuestra compatibilidad
  con una versión menor en destino.
- Extensiones: `pg_trgm` 1.6 y `plpgsql` 1.0. Esquemas de aplicación: `public`
  y `drizzle`; 24 y 1 tablas respectivamente.
- Índices: 91 en public y 1 en drizzle; ninguno inválido al consultar.
- Restricciones public: 119 CHECK, 28 FK, 182 NOT NULL, 23 PK y dos constraint
  triggers. Drizzle: dos NOT NULL y una PK. Ninguna sin validar. Los NOT NULL
  se reportan por PostgreSQL 18 como restricciones: no asumir catálogos idénticos
  en un destino de otra versión.
- 11 enums: cart_status, classification_status, idempotency_status,
  inventory_movement_type, invoice_origin, invoice_status, order_status,
  payment_status, product_status, user_role y user_status.
- Dos funciones de aplicación: `check_product_primary_image` y
  `lock_product_image_owner`; tres triggers de portada/bloqueo de producto.
- Secuencia `drizzle.__drizzle_migrations_id_seq`: inicio/incremento 1,
  último valor observado 17. Hay 16 migraciones aplicadas y 16 entradas en
  `migrations/meta/_journal.json`; los saltos de secuencia no se normalizan.
  Último created_at del journal SQL: 1790983838471. La comparación completa de
  hashes/historial durante copia corresponde a 24.5.

## Conteos de referencia

Instantánea de lectura; estos valores pueden cambiar mientras la aplicación siga
operativa. Repetir antes del snapshot final, no usarlos como expectativa permanente.

| Tabla public | Filas |
| --- | ---: |
| audit_entries | 114 |
| cart_items | 10 |
| carts | 12 |
| catalog_image_operations | 6 |
| categories | 6 |
| idempotency_records | 3 |
| inventory_balances | 21 |
| inventory_movements | 29 |
| invoice_lines | 9 |
| invoices | 4 |
| order_items | 5 |
| orders | 3 |
| payments | 3 |
| product_images | 69 |
| product_tags | 48 |
| products | 23 |
| role_assignments | 5 |
| sessions | 84 |
| store_logo_assets | 0 |
| store_profiles | 1 |
| tags | 8 |
| users | 5 |
| wishlist_items | 2 |
| wishlists | 1 |

Balances negativos: cero. Las 84 sesiones son filas, no 84 sesiones vigentes.
No se imprimieron usuarios, hashes, cookies, tokens ni secretos.

## Imágenes y conexiones

- Journal observado: cinco CONFIRMED y una DONE; cero UPLOADING/PENDING/BLOCKED
  en el momento de lectura. No garantiza ausencia de operaciones futuras.
- Referencias: 60 Picsum, cinco Cloudinary y cuatro local/otro; no se descargaron
  ni modificaron assets. El último grupo es clasificación por URL, no prueba de
  existencia física de cada referencia.
- `.env` actual sigue apuntando a base local, entorno development y proveedor
  Cloudinary configurado. No se mostraron ni modificaron credenciales.
- Root local resuelto: `apps/api/.local-storage/images`, cinco archivos regulares,
  1.007.560 bytes; no se verificaron huellas por referencia ni respaldo del volumen.
- Runtime: dos pools de máximo cinco conexiones por instancia; migrador máximo
  una. Ambos pools usan DATABASE_URL; la coordinación de imágenes y el migrador
  requieren advisory locks de sesión. No usar pool transaccional para este flujo.
- El worker Cloudinary se programa cada 30 segundos si hay configuración completa,
  incluso con proveedor local. No se arrancó otra instancia de API ni reconciliador.
  El aislamiento de clones se implementará en 24.6 antes de restaurar journals reales.

## Primer intento de destino — evidencia histórica anterior a la excepción

El usuario proporcionó región `aws-0-us-east-1` y creó el archivo privado
`apps/api/.env.supabase-preflight`. Contiene una URI PostgreSQL de conexión directa
a un host Supabase, puerto 5432 y base `postgres`; no se imprimieron hostname,
usuario ni contraseña. El endpoint directo no permite inferir por sí solo la
región del proyecto ni confirmar su entorno de desarrollo/pruebas.

La resolución DNS devuelve IPv6. Una conexión con node-postgres, timeout de ocho
segundos y `ssl.rejectUnauthorized: true` llegó al intercambio TLS, pero falló con
`SELF_SIGNED_CERT_IN_CHAIN`. No se estableció una sesión PostgreSQL autenticada ni
se ejecutó SQL remoto. El archivo no configura `SUPABASE_PREFLIGHT_CA_PATH` y no
se encontró un certificado CRT/PEM en el repositorio inspeccionado. No se desactivó
TLS/verificación ni se probó conexión insegura. La contraseña no quedó validada.

Falta descargar el certificado CA oficial de Database Settings → SSL Configuration
del proyecto, guardar su ruta en `SUPABASE_PREFLIGHT_CA_PATH` dentro del mismo
archivo privado y confirmar entorno de desarrollo/pruebas. Después se comprobarán
versión, extensiones, objetos existentes, permisos y presupuesto remoto con
consultas READ ONLY. PostgreSQL origen 18.6 exige revisar cualquier destino menor,
sin asumir compatible la restauración. **24.1 sigue pendiente**; no avanzar a 24.2
ni marcar compatibilidad por inferencia.

Para continuar, identificar proyecto de desarrollo/pruebas, región y conexión
copiada de Connect (directa o Session pooler, no Transaction pooler). Conservar
DATABASE_URL local. Guardar la URI completa con contraseña, correctamente
codificada, en un archivo privado ignorado como `apps/api/.env.supabase-preflight`
con clave `SUPABASE_PREFLIGHT_DATABASE_URL`; no pegar secretos en el chat.
Esta clave es solo entrada privada para la inspección, no una variable runtime
ya implementada. Guardar también el certificado CA oficial si lo requiere la
conexión. Identificar modo y ubicación del certificado sin compartir su secreto.
Solicitar confirmación del proyecto antes de usar la conexión para consultas
remotas de solo lectura; esto no autoriza cambios de seguridad ni migración.

## Resultado final — conexión autorizada sin verificar certificado

Tras simplificar la fase a cuatro tareas y autorizar expresamente la excepción
TLS para el curso, se repitió la conexión directa del archivo privado mediante
node-postgres con `ssl: { rejectUnauthorized: false }` únicamente en ese cliente
de inspección. No se cambió `.env`, la URI privada ni variables TLS globales.
Esta ejecución aplica el opt-in autorizado por el usuario, no activa un fallback
ante error. El flag runtime `DATABASE_TLS_VERIFY_SERVER` se implementará en 24.2.
El cifrado no autentica la identidad del servidor y admite riesgo de suplantación.

Resultados reales de consultas en una transacción REPEATABLE READ READ ONLY:

- Autenticación y consulta PostgreSQL exitosas, conexión directa puerto 5432;
  no se utilizó pool transaccional. Región declarada por usuario: us-east-1
  (`aws-0-us-east-1`); no se consultó Management API para certificar región/plan.
- Destino PostgreSQL **17.11**, UTF8, `max_connections=60`. Este valor del servidor
  no es garantía de 60 conexiones disponibles para la app: Supabase también
  utiliza conexiones. Runtime actual tiene hasta diez por instancia, migrador una.
- `pg_stat_ssl` confirmó cifrado **TLSv1.3**, `TLS_AES_256_GCM_SHA384`.
- `pg_trgm` **1.6** disponible pero no instalada; la migración existente 0012
  incluye `CREATE EXTENSION IF NOT EXISTS pg_trgm`. `plpgsql` 1.0 instalada.
- Cero tablas y cero objetos pg_class en public/drizzle al consultar. Esto cumple
  la comprobación básica de tablas conflictivas; no equivale a inventario de todos
  los objetos/privilegios gestionados de Supabase ni a verificación de Data API.

**Decisión de compatibilidad:** origen 18.6 → destino 17.11 es cambio hacia una
versión mayor anterior. No se certifica restauración directa de un dump DDL de 18
sobre 17. La revisión básica de migraciones existentes no encontró uso de uuidv7,
PERIOD ni WITHOUT OVERLAPS; tablas/enums, pg_trgm, funciones PL/pgSQL y triggers
de portada deben crearse mediante las migraciones Drizzle en destino vacío y
después importar datos e historial de origen sin duplicar DDL. Ese camino ya está
previsto en 24.3; su ejecución efectiva seguirá siendo la comprobación de
compatibilidad final. No se ejecutaron migraciones ni CREATE EXTENSION ahora.

La tarea 24.1 queda completa: conexión, versión, extensión requerida y ausencia
de tablas conflictivas comprobadas y diferencia de versión registrada con ruta
de copia prevista. Quedan pendientes 24.2–24.4: configuración, copia y activación.
No hubo arranque API, trabajadores de imágenes, escrituras SQL, seed, cambios de
assets, descarga de datos personales ni cambio de conexión de la aplicación.

## Reproducción del inventario local

```sh
docker exec -i postgres psql -X -v ON_ERROR_STOP=1 -U postgres \
  -d ecommerce_backend_sdd < infra/database/preflight-source.sql
docker exec postgres pg_dump --version
docker exec postgres pg_restore --version
docker inspect postgres --format '{{json .Mounts}}'
```

El SQL es exclusivo de origen y depende del esquema actual; no ejecutarlo sin
revisión en un proyecto Supabase vacío. Incluye definiciones de índices,
restricciones, funciones, triggers y enums sin leer datos personales. Dos consultas
exploratorias iniciales usaron nombres incorrectos (`status`/`quantity`); PostgreSQL
abortó sus transacciones READ ONLY, se corrigieron a `state`/`available_quantity`
y se verificó el script final. No hubo mutaciones.

Referencias oficiales verificadas:
[conexiones](https://supabase.com/docs/guides/database/connecting-to-postgres) y
[migración PostgreSQL](https://supabase.com/docs/guides/platform/migrating-to-supabase/postgres).
Para obtener el CA y verificar el servidor, consultar
[configuración SSL oficial](https://supabase.com/docs/guides/platform/ssl-enforcement).
