# Supabase — operación del curso

La fase 24 traslada solo PostgreSQL. Storefront :3000 y backoffice :3002
consumen NestJS :3001 mediante REST. No usamos Supabase Auth/Storage/Data API
como backend de la app. Data API sigue habilitada con acceso restringido a las
tablas de aplicación. Drizzle mantiene esquema e historial.

## Configuración privada

En apps/api/.env, obtener DATABASE_URL del diálogo Connect de Supabase:

```dotenv
DATABASE_URL=postgresql://postgres:REPLACE_PRIVATE_PASSWORD@db.REPLACE_PROJECT_REF.supabase.co:5432/postgres
DATABASE_TLS_VERIFY_SERVER=false
```

No copiar placeholders literalmente. Codificar caracteres especiales de la
contraseña en la URI. Conexión directa actual verificada desde esta máquina;
Session pooler en 5432 es alternativa para un alojamiento solo IPv4. Copiar
su URI completa de Connect: host/usuario no se deducen de la región.
Transaction pooler en 6543 no sirve para nuestros locks de sesión.

false es una excepción explícita del curso: cifra tráfico, pero no verifica
identidad del servidor y admite riesgo de suplantación. El código verifica por
defecto (true); no deshabilita TLS global ni HTTPS/Cloudinary. Esta configuración,
incluso bajo NODE_ENV=production de una demo, no certifica seguridad productiva.
La cuenta postgres del curso tiene bypass RLS; NestJS autoriza los roles propios.

Conservar las demás variables del API, secreto JWT, cookies/CORS y Cloudinary.
Los frontends no reciben credenciales de PostgreSQL ni requieren cambios de env.
Para arrancar desde la raíz:

```bash
pnpm --filter @technology-ecommerce/api db:migrate
pnpm --filter @technology-ecommerce/api build
pnpm --filter @technology-ecommerce/api start
```

En desarrollo puede usarse dev en vez de start. El migrador usa TLS común,
advisory lock y protección RLS/grants antes/después del DDL. Su allowlist debe
actualizarse al añadir objetos. No activar políticas públicas ni modificar
esquemas gestionados. No ejecutar seed contra la copia activa.

## Copia efectuada y verificaciones

Origen 18.6 → destino 17.11: respaldo custom con pg_dump; DDL mediante las
migraciones existentes; importación transaccional de datos public/drizzle,
incluido historial original/secuencia. No se restauraron roles globales o
esquemas gestionados. Se copiaron 23 productos existentes, no se sustituyeron
por el seed de 20. Detalles en VALIDATION-24.3.md y VALIDATION-24.4.md.

El API local original se detuvo antes de copiar. Únicamente el API activo con
Supabase ejecuta ahora recuperación de imágenes; no iniciar otro API/worker con
la base anterior. Los archivos locales y Cloudinary/Picsum se conservan.

Respaldo privado: tmp/supabase-24.3-2PnFsV/source.dump, datos auxiliares en ese
directorio y entorno anterior en tmp/.env.local-before24.4. Todo ignorado por
Git, con permisos restringidos. Son datos confidenciales; proteger/copiar a
un almacenamiento privado seguro si se necesita recuperación duradera. tmp no
es una política automática de backups.

Health /api/v1/health identifica database.name=postgres en el destino.
Swagger sigue en /api/v1/docs. Login usa credenciales propias de la app,
no usuarios de Supabase Auth.

## Regreso al origen

Antes de cualquier escritura nueva, un retorno consiste en detener el API,
restaurar DATABASE_URL y su opción TLS del entorno anterior y reiniciar una
sola instancia. No restaurar todo el env a ciegas si otras variables cambiaron.

**Ese retorno inmediato ya no es válido después del smoke de login:** se
crearon sesiones/auditoría en Supabase. Si se requiere regresar, detener
escrituras/worker, respaldar Supabase y reconciliar los cambios con origen
mediante una operación expresamente autorizada. No cambiar de URI para volver
a datos antiguos ni borrar el volumen ecommerce_postgres_data.

## Pruebas

Controles unitarios focalizados, sin lanzar integración sobre el destino activo:

```bash
pnpm --filter @technology-ecommerce/api exec vitest run test/database/connection-options.spec.ts test/database/supabase-data-access.spec.ts test/config/environment.spec.ts
pnpm --filter @technology-ecommerce/api typecheck
pnpm --filter @technology-ecommerce/api lint
openspec validate build-technology-ecommerce-platform --strict
```

No agregar `--` entre vitest run y los filtros: puede lanzar toda la suite.
Las pruebas de integración necesitan URL local explícita y bases aleatorias
de sus fixtures; no reutilizar DATABASE_URL activo de Supabase ni credenciales
de assets reales. Esta fase verifica funcionamiento básico, no certifica
despliegue en Vercel, carga, concurrencia o seguridad de producción real.

Referencias: [conexiones Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres)
y [seguridad Data API](https://supabase.com/docs/guides/api/securing-your-api).
