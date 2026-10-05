# 24.3 — Respaldo y copia a Supabase

2026-10-05. Completada únicamente la copia; activación pendiente en 24.4.

## Operación realizada

- Se confirmó el destino privado de `.env.supabase-preflight`, inicialmente sin
  objetos de aplicación en `public`/`drizzle`. Conexión directa cifrada con la
  excepción de verificación TLS autorizada para el curso.
- Se detuvo el grupo de procesos del API local (pnpm/Nest watch/servidor del
  puerto 3001). No se inició ningún API ni worker sobre el destino.
- Una transacción de origen mantuvo bloqueos SHARE en las 25 tablas durante
  respaldo/copia/verificación, impidiendo escrituras en ellas. No se cambió
  configuración global de PostgreSQL ni se eliminaron contenedores/volúmenes.
- Se creó respaldo nativo custom con pg_dump 18.6 y se verificó su catálogo con
  pg_restore --list. Se omitieron propietarios, privilegios y suscripciones.
  El origen contiene únicamente los esquemas de usuario public/drizzle;
  el respaldo completo conserva también sus dependencias de extensión.
- Por la diferencia PostgreSQL 18.6 → 17.11, el DDL se creó con el runner Drizzle
  existente, sin restaurar DDL de versión mayor. El runner aplicó la protección
  de acceso antes/después del DDL y antes de importar datos.
- Se importaron datos de public/drizzle con INSERT por columnas y lotes de 100,
  generados por pg_dump, en una sola transacción. Solo se reemplazó el historial
  recién generado por esas migraciones con el historial original; no se borraron
  tablas ni se sobrescribieron datos ajenos. Se preservó la secuencia original.

El primer intento de datos produjo SQLSTATE 42P01 y se revirtió completo: el
dump establece search_path vacío, mientras los triggers existentes resuelven
tablas de aplicación sin calificarlas. Se ajustó únicamente el contexto del
import a `pg_catalog, public`, conservando triggers y restricciones. Antes de
repetir se verificó que todas las tablas públicas siguieran vacías y que los
hashes/fechas del historial Drizzle coincidieran con origen. La segunda copia
se confirmó correctamente. No se desactivaron triggers, FK ni RLS.

## Evidencia

Los conteos y las huellas en memoria de los valores JSON de todas las filas
coincidieron entre origen bloqueado y destino, tanto antes como después del
COMMIT. Esta comparación adicional no introduce un harness ni un requisito
de certificación productiva. No se imprimieron filas, contraseñas, sesiones
privadas, hashes de autenticación ni credenciales.

| Tabla | Registros |
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
| drizzle.__drizzle_migrations | 16 |

La secuencia Drizzle conserva last_value=17, is_called=true. Las 84 sesiones
son registros históricos: la copia no reactiva sesiones revocadas/expiradas.
No hay balances negativos. Se conservaron IDs, relaciones, timestamps,
decimales, snapshots, hashes, numeración, URLs/claves/orden/portada de imágenes
y los seis registros del journal sin ejecutar recuperación remota.

Las 25 tablas tienen RLS habilitado, sin políticas y sin permisos de tablas
para anon/authenticated. Consultar users con cada uno de esos roles produjo
42501 (permission denied). Ambos carecen también de permisos en la secuencia
Drizzle y de EXECUTE sobre las dos funciones de triggers de aplicación.
Data API sigue habilitada según la decisión del usuario; no se usó para la
copia ni se cambiaron Auth/Storage o esquemas gestionados.

## Respaldo privado y estado de entrega

Respaldo final en `tmp/supabase-24.3-2PnFsV/source.dump` (133100 bytes), junto
con data.sql y verification.json. Directorio 0700 y archivos 0600, ignorados
por Git. El primer respaldo también se conserva en tmp/supabase-24.3-03umC4.
Contienen datos privados: no subirlos al repositorio ni compartirlos públicamente.
La operación puntual está en tmp/supabase-copy24.mjs, privada/ignorada; no se
añade un framework de migración al proyecto.

DATABASE_URL de apps/api/.env sigue local. El API permanece detenido hasta
la activación autorizada de 24.4: no iniciar origen y destino simultáneamente
ni modificar datos locales durante esta pausa. Si se realizan nuevas escrituras
locales, esta copia dejará de ser la copia final y deberá reconciliarse antes
de activar. El contenedor postgres y volumen ecommerce_postgres_data en
/var/lib/postgresql permanecen intactos. No se ejecutó seed, no se cambiaron
assets/archivos locales ni Cloudinary/Picsum; no hubo commit/push.

## Archivos versionables de esta tarea

- openspec/changes/build-technology-ecommerce-platform/tasks.md: cierre de 24.3.
- docs/VALIDATION-24.3.md: operación, verificaciones y límites.

Los skills Supabase y Postgres guiaron la separación de DDL/datos, el uso de
grants junto con RLS y la importación por lotes. Se revisaron changelog y
documentación actual; Drizzle continúa siendo la única autoridad de migraciones.
Fuentes: [migración Supabase](https://supabase.com/docs/guides/platform/migrating-to-supabase/postgres),
[pg_dump 18](https://www.postgresql.org/docs/18/app-pgdump.html) y
[observabilidad](https://supabase.com/docs/guides/observability).
