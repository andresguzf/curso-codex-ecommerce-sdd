# Entorno local y operación

Esta es la guía operativa del estado implementado del proyecto. Las especificaciones OpenSpec continúan siendo la fuente de verdad para comportamiento y alcance futuro.

## Requisitos previos

- Git.
- Docker Engine o Docker Desktop con Docker Compose v2.
- Node.js `22.21.1` o una versión compatible de Node.js 22.
- Corepack habilitado. El repositorio fija pnpm `10.33.4` en `package.json`.

Comprueba las herramientas:

```bash
docker --version
docker compose version
node --version
corepack enable
pnpm --version
```

## Arranque desde un checkout nuevo

Desde la raíz del repositorio:

1. Instala exactamente las dependencias del lockfile.

   ```bash
   corepack enable
   pnpm install --frozen-lockfile
   ```

2. Crea el volumen persistente de PostgreSQL. Es externo al ciclo de vida del contenedor, por lo que `docker compose down` o recrear el contenedor no elimina los datos.

   ```bash
   docker volume create ecommerce_postgres_data
   ```

3. Crea las configuraciones locales ignoradas por Git.

   ```bash
   cp infra/docker/.env.example infra/docker/.env
   cp apps/api/.env.example apps/api/.env
   cp apps/storefront/.env.example apps/storefront/.env.local
   cp apps/backoffice/.env.example apps/backoffice/.env.local
   ```

4. Sustituye `change-me` por la misma contraseña en `infra/docker/.env` y en la sección de contraseña de `DATABASE_URL` dentro de `apps/api/.env`. Define también tres contraseñas seed distintas o locales de al menos 12 caracteres. No confirmes archivos `.env` en Git.

5. Inicia PostgreSQL y espera a que esté saludable.

   ```bash
   docker compose --env-file infra/docker/.env -f infra/docker/compose.yaml up -d
   docker compose --env-file infra/docker/.env -f infra/docker/compose.yaml ps
   ```

6. Aplica todas las migraciones y carga los datos de desarrollo.

   ```bash
   pnpm --filter @technology-ecommerce/api db:migrate
   pnpm --filter @technology-ecommerce/api db:seed
   ```

7. Inicia las tres aplicaciones.

   ```bash
   pnpm dev
   ```

8. Comprueba el entorno:

   - Storefront: <http://localhost:3000>
   - API: <http://localhost:3001/api/v1>
   - Health/readiness: <http://localhost:3001/api/v1/health>
   - Swagger UI: <http://localhost:3001/api/v1/docs>
   - OpenAPI JSON: <http://localhost:3001/api/v1/openapi.json>
   - Backoffice: <http://localhost:3002>

   ```bash
   curl --fail http://localhost:3001/api/v1/health
   ```

Los frontends ya tienen esos destinos como valores locales predeterminados. Sus `.env.local` son convenientes para hacer explícita la configuración y necesarios cuando cambien hosts o puertos.

## Variables de entorno

### PostgreSQL local

Se configuran en `infra/docker/.env` a partir de `infra/docker/.env.example`.

| Variable | Propósito | Valor local habitual |
|---|---|---|
| `POSTGRES_USER` | Usuario propietario de la base | `postgres` |
| `POSTGRES_PASSWORD` | Contraseña local; debe coincidir con `DATABASE_URL` | Sin valor seguro predeterminado |
| `POSTGRES_DB` | Base principal | `ecommerce_backend_sdd` |
| `POSTGRES_PORT` | Puerto publicado en el host | `5432` |

El contenedor se llama `postgres`, reinicia siempre y usa el volumen externo `ecommerce_postgres_data`. Para conectarte desde pgAdmin ejecutado en otro contenedor de la misma red usa el nombre de servicio `postgres`; desde una aplicación del host usa `localhost` y el puerto publicado.

### API

Se configuran en `apps/api/.env` a partir de `apps/api/.env.example`.

| Variable | Obligatoria o valor predeterminado | Propósito |
|---|---|---|
| `NODE_ENV` | `development` | Entorno: `development`, `test` o `production` |
| `HOST` | `0.0.0.0` | Interfaz HTTP del API |
| `PORT` | `3001` | Puerto HTTP del API |
| `DATABASE_URL` | Obligatoria | URL PostgreSQL con esquema `postgresql://` |
| `AUTH_ACCESS_TOKEN_SECRET` | Desarrollo tiene fallback; obligatoria en producción, mínimo 32 caracteres | Firma de access tokens |
| `AUTH_ACCESS_TOKEN_TTL_SECONDS` | `900` | Vida del access token; entre 1 y 3600 segundos |
| `AUTH_REFRESH_TOKEN_TTL_SECONDS` | `604800` | Vida de renovación; debe superar al access token |
| `AUTH_COOKIE_SECURE` | `false` en desarrollo, obligatorio `true` en producción | Envío de cookies solo por HTTPS |
| `AUTH_COOKIE_SAME_SITE` | `lax` | Política `lax`, `strict` o `none`; `none` exige cookie segura |
| `AUTH_LOGIN_MAX_ATTEMPTS` | `5` | Intentos admitidos dentro de la ventana |
| `AUTH_LOGIN_WINDOW_SECONDS` | `900` | Ventana del limitador de login |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:3000,http://localhost:3002` | Lista exacta de orígenes permitidos, separada por comas |
| `CART_ANONYMOUS_TTL_SECONDS` | `2592000` | Vigencia del carrito visitante; entre 60 segundos y un año |
| `IMAGE_STORAGE_LOCAL_ROOT` | `.local-storage/images` | Directorio de imágenes del adaptador local |
| `IMAGE_STORAGE_MAX_BYTES` | `5242880` | Tamaño máximo por imagen |
| `IMAGE_STORAGE_PUBLIC_BASE_URL` | `http://localhost:3001/api/v1/media/images` | Base pública de imágenes locales |
| `SIMULATED_SHIPPING_PICKUP_COST` | `0.00` | Costo fijo de retiro en tienda, USD |
| `SIMULATED_SHIPPING_STANDARD_COST` | `5.00` | Costo fijo de envío estándar, USD |
| `SIMULATED_SHIPPING_EXPRESS_COST` | `15.00` | Costo fijo de envío express, USD |

`DATABASE_MIGRATIONS_PATH` es una opción operativa avanzada del ejecutable compilado de migraciones. El contenedor del API la configura internamente; en desarrollo se usa la ruta de migraciones del código fuente.

### Datos seed

Estas variables son obligatorias solo al ejecutar `db:seed`:

| Variable | Rol creado | Restricción |
|---|---|---|
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | `ADMIN` | Email válido y contraseña mínima de 12 caracteres |
| `SEED_BILLING_EMAIL` / `SEED_BILLING_PASSWORD` | `BILLING` | Email distinto y contraseña mínima de 12 caracteres |
| `SEED_CUSTOMER_EMAIL` / `SEED_CUSTOMER_PASSWORD` | `CUSTOMER` | Email distinto y contraseña mínima de 12 caracteres |

Las contraseñas se guardan como hashes Argon2id y nunca se incluyen en el resultado del seed ni en los logs.

### Storefront

`apps/storefront/.env.local` admite:

| Variable | Valor local | Propósito |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:3001` | Host del API para clientes REST generales |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001/api/v1` | Base versionada usada por autenticación |
| `NEXT_PUBLIC_BACKOFFICE_URL` | `http://localhost:3002` | Navegación hacia backoffice |

### Backoffice

`apps/backoffice/.env.local` admite:

| Variable | Valor local | Propósito |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:3001` | Host del API para clientes REST generales |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001/api/v1` | Base versionada usada por autenticación |
| `NEXT_PUBLIC_STOREFRONT_URL` | `http://localhost:3000` | Navegación hacia storefront |

Las variables `NEXT_PUBLIC_*` se incorporan al bundle durante el build. Cambiarlas exige reconstruir la aplicación frontend.

## Migraciones

Para comprobar la configuración de Drizzle y aplicar migraciones en desarrollo:

```bash
pnpm --filter @technology-ecommerce/api db:check
pnpm --filter @technology-ecommerce/api db:migrate
```

Para generar una migración después de cambiar el esquema:

```bash
pnpm --filter @technology-ecommerce/api db:generate
```

Revisa siempre el SQL generado antes de aplicarlo. No edites una migración ya desplegada para cambiar su historia.

La imagen de producción del API ejecuta `db:migrate:deploy` antes de iniciar HTTP. El runner usa un advisory lock de PostgreSQL para serializar réplicas y aborta el arranque si una migración falla. Las migraciones aplicadas viven en la tabla `drizzle.__drizzle_migrations`; no hay rollback automático de cambios destructivos.

## Seed de desarrollo

El comando es explícito e idempotente:

```bash
pnpm --filter @technology-ecommerce/api db:seed
```

Actualmente crea o sincroniza:

- Un usuario activo por rol: `ADMIN`, `BILLING` y `CUSTOMER`.
- Tres asignaciones de rol.
- Tres productos tecnológicos (`2 ACTIVE`, `1 INACTIVE`).
- Una imagen Picsum determinista, un balance y el movimiento de apertura o sincronización por producto.

Ejecutarlo nuevamente actualiza los registros naturales sin duplicarlos. `NODE_ENV=production` lo rechaza antes de escribir. El seed ampliado de exactamente 20 productos, 60 imágenes, categorías y etiquetas pertenece a las tareas 20.3–20.5 y todavía no debe describirse como implementado.

Los emails iniciales son los definidos en `apps/api/.env`; la contraseña de cada cuenta es el valor local que configuraste. `ADMIN` administra el sistema completo, `BILLING` solo órdenes y facturas, y `CUSTOMER` usa storefront, carrito, checkout e historial propio.

## Comandos habituales

Desde la raíz:

| Comando | Uso |
|---|---|
| `pnpm dev` | Inicia API, storefront y backoffice mediante Turborepo |
| `pnpm build` | Construye todos los paquetes y aplicaciones |
| `pnpm lint` | Ejecuta ESLint en el grafo |
| `pnpm typecheck` | Comprueba TypeScript |
| `pnpm test` | Ejecuta pruebas unitarias, componentes e integración |
| `pnpm test:e2e` | Ejecuta los flujos end-to-end del API |
| `pnpm contract:check` | Comprueba OpenAPI, cliente generado y respuestas reales |
| `pnpm openapi:generate` | Regenera OpenAPI y el cliente TypeScript |
| `pnpm openapi:check` | Comprueba que el contrato generado está sincronizado |
| `pnpm ci:full` | Ejecuta calidad, pruebas, builds y contrato de todo el workspace |
| `pnpm ci:affected` | Ejecuta el pipeline Turborepo para paquetes afectados y contrato |

Comandos por aplicación:

```bash
pnpm --filter @technology-ecommerce/api dev
pnpm --filter @technology-ecommerce/storefront dev
pnpm --filter @technology-ecommerce/backoffice dev
```

## Contenedores de las aplicaciones

Para levantar las tres aplicaciones y un PostgreSQL nuevo con el despliegue reproducible:

```bash
cp infra/deployment/.env.example infra/deployment/.env
docker compose --env-file infra/deployment/.env \
  -f infra/deployment/compose.yaml \
  -f infra/deployment/compose.postgres.yaml \
  up --build -d
```

Antes de ejecutarlo, reemplaza `POSTGRES_PASSWORD`, `DATABASE_URL` y `AUTH_ACCESS_TOKEN_SECRET`. Para una prueba local servida por HTTP establece temporalmente `AUTH_COOKIE_SECURE=false`; en producción debe ser `true` y las aplicaciones deben exponerse mediante HTTPS.

Consulta estado y logs:

```bash
docker compose --env-file infra/deployment/.env \
  -f infra/deployment/compose.yaml \
  -f infra/deployment/compose.postgres.yaml \
  ps

docker compose --env-file infra/deployment/.env \
  -f infra/deployment/compose.yaml \
  -f infra/deployment/compose.postgres.yaml \
  logs api
```

El API migra antes de arrancar y los frontends esperan su health check. Los volúmenes `technology_ecommerce_postgres_data` y `technology_ecommerce_api_images` preservan base de datos e imágenes respectivamente.

## Límites de los simuladores

### Pago

- `SIMULATED_CARD_APPROVED` devuelve siempre `APPROVED`.
- `SIMULATED_CARD_REJECTED` devuelve siempre `REJECTED`.
- La referencia de proveedor es determinista para el intento y el método.
- No existe cobro real, tokenización de tarjeta, pasarela, webhook, conciliación, fraude, reembolso ni chargeback.
- Un rechazo no crea una orden confirmada, no descuenta inventario y mantiene el carrito disponible.
- Checkout exige `CUSTOMER`, revalida stock y usa `Idempotency-Key` para no duplicar compras.

### Envío

- Los únicos métodos son `PICKUP`, `STANDARD` y `EXPRESS`.
- Sus costos fijos configurables se expresan exclusivamente en `USD`.
- `PICKUP` no tiene plazo; `STANDARD` simula 3–5 días y `EXPRESS` 1–2 días.
- No existe integración con transportista, cobertura geográfica real, tracking, etiqueta ni despacho.

### Facturación

- Es facturación comercial interna, no factura electrónica tributaria ni integración fiscal legal.
- Orden, pago y factura son agregados independientes.
- `ADMIN` y `BILLING` pueden crear una factura manual o convertir una orden elegible.
- La conversión desde orden crea la factura y cambia la orden a `INVOICED` atómicamente; una orden no admite dos facturas activas.
- La factura manual no crea una orden ni modifica inventario.
- Emitir, pagar, anular o exportar una factura tampoco modifica inventario ni el pago histórico.
- Los estados son `DRAFT`, `PENDING_PAYMENT`, `PAID` y `VOID`; el PDF de un borrador lleva una marca visible.
- Todos los importes usan `USD`; no hay selector ni conversión de moneda.
- Los PDF se generan bajo demanda desde snapshots y no incluyen firma digital, timbraje fiscal ni almacenamiento documental externo.

## Detener y conservar datos

Para detener el desarrollo local:

```bash
docker compose --env-file infra/docker/.env -f infra/docker/compose.yaml down
```

El volumen externo permanece. Eliminarlo borra de forma irreversible la base local, por lo que no ejecutes `docker volume rm ecommerce_postgres_data` salvo que quieras descartar deliberadamente todos los datos.

## Solución de problemas

- Si el API no conecta, comprueba que la contraseña de `DATABASE_URL` coincida exactamente con `POSTGRES_PASSWORD` y revisa `docker compose ... ps`.
- Si el login o el carrito anónimo fallan desde el navegador, incluye ambos orígenes exactos en `CORS_ALLOWED_ORIGINS` y no omitas el protocolo ni el puerto.
- En HTTP local usa `AUTH_COOKIE_SECURE=false`. `SameSite=None` requiere obligatoriamente una cookie segura y, por tanto, HTTPS.
- Si cambias una variable `NEXT_PUBLIC_*`, reinicia y reconstruye el frontend.
- Si el API falla antes de escuchar el puerto, revisa primero los logs de migración; el arranque se detiene deliberadamente ante un esquema inconsistente.
