# 24.2 — Configuración de conexión completada

2026-10-05. Tarea completada; sin copia ni activación de Supabase en la app.

## Configuración

Política común para ambos pools del API, migrador de despliegue y herramientas
Drizzle: TLS remoto con verificación por defecto y opt-in privado
DATABASE_TLS_VERIFY_SERVER=false para el curso, incluido NODE_ENV=production.
No modifica TLS global ni otros servicios; emite advertencia del riesgo de
suplantación. Rechaza Transaction pooler Supabase en 6543 y sslmode=disable remoto.
El comando db:migrate usa el mismo runner que despliegue para no omitir protección.
No se cambiaron DATABASE_URL ni archivos privados; la app sigue con PostgreSQL local
y el opt-in runtime todavía no está activado. Sigue pendiente copia/activación.

## Data API habilitada y frontera NestJS

El usuario autorizó conservar Data API y proteger solo tablas de aplicación.
Proposal, design, identity-access/spec y tasks se revisaron antes de implementar.

La inspección remota detectó grants por defecto para anon/authenticated en tablas,
secuencias y funciones de public. Se aplicó supabase-data-access.ts en el destino
vacío autorizado: revocación de grants por defecto para esos roles y PUBLIC en
tablas/secuencias, y grants explícitos de funciones para anon/authenticated. La
consulta posterior no encontró grants restringidos en el ACL de esquema public.
Data API permanece habilitada; Auth/Storage y assets no se modificaron.

El migrador aplica la protección antes/después del DDL en hosts Supabase. Una
allowlist cubre las 24 tablas de aplicación, historial/secuencia Drizzle y dos
funciones de triggers. Habilita RLS sin políticas públicas ni FORCE, revoca grants
anon/authenticated/PUBLIC y falla si encuentra políticas previas que requieran
revisión. No ejecuta nada sobre PostgreSQL local ni tablas ajenas. Nuevas tablas
o funciones de app requieren actualizar esa allowlist. PostgreSQL conserva por
defecto EXECUTE de PUBLIC para funciones futuras; las dos funciones actuales se
revocan explícitamente después del DDL, no se reclama una prohibición global de
funciones ajenas o todavía inexistentes.

El destino sigue con cero tablas de aplicación: no se aplicó RLS a tablas aún
inexistentes ni se afirma haber comprobado lectura REST de datos copiados. En 24.3
se ejecutará el runner protegido y se comprobará RLS/permisos antes de importar.
La cuenta PostgreSQL del backend tiene bypassrls; no se fuerza RLS contra ella y
NestJS mantiene autenticación/autorización propias. service_role permanece
privado; no se añadieron claves Supabase al frontend ni se usa Data API en la app.

## Verificaciones

- Bloqueo advisory real en destino entre dos sesiones: primera adquiere, segunda
  rechaza mientras está ocupado y adquiere después de liberarse; liberación final.
  No se insertaron filas ni se arrancó API/worker Cloudinary.
- Typecheck, lint y build del API exitosos.
- 26 pruebas focalizadas: connection-options, environment y supabase-data-access.
- Dos pruebas de migración con bases locales aleatorias y limpieza del test,
  sin migrar PostgreSQL de desarrollo ni destino Supabase.
- OpenSpec estricto y git diff --check sin errores.
- Lectura privada confirmó DATABASE_URL local y opt-in runtime no activado.
- El primer intento de ejecutar imports TS directamente con Node 22 falló antes de
  conectar; se usó tsx para ejecutar y verificar la protección.

## Archivos

- apps/api/src/database/connection-options.ts y test/database/connection-options.spec.ts.
- apps/api/src/config/environment.ts y apps/api/.env.example.
- apps/api/src/database/database.service.ts, migration-runner.ts y migrate.ts.
- apps/api/drizzle.config.ts y apps/api/package.json.
- apps/api/src/database/supabase-data-access.ts y test/database/supabase-data-access.spec.ts.
- Artefactos OpenSpec revisados y este informe.

Los skills oficiales Supabase guiaron el uso de sesión para advisory locks y la
separación entre grants y RLS, sin cambiar a Supabase Auth ni añadir otro sistema
de migraciones. Changelog 17.11 revisado: las advertencias de ltree, cifrado PGP
legacy, btree_gist/custom operators no corresponden a las extensiones/DDL observados
de la app. No se certifica seguridad de producción real.

Fuentes: [Data API](https://supabase.com/docs/guides/api/securing-your-api),
[conexiones](https://supabase.com/docs/guides/database/connecting-to-postgres) y
[changelog 17.11](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes).
