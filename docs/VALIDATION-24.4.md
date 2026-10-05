# 24.4 — Supabase activo

2026-10-05. Activación autorizada al continuar esta tarea. Fase 24 completada;
no commit/push, seed, archivo OpenSpec ni despliegue Vercel.

## Corte y comprobaciones

- Antes de activar se repitió la comparación de valores de las 25 tablas entre
  origen y destino: seguían iguales. El API original permanecía detenido desde
  24.3. Journal: cinco CONFIRMED y uno DONE, sin trabajos pendientes de limpieza.
- Se conservó el entorno original en tmp/.env.local-before24.4 (0600,
  ignorado) y se editaron con apply_patch únicamente DATABASE_URL y
  DATABASE_TLS_VERIFY_SERVER=false del archivo privado apps/api/.env.
  Conexión directa, no Transaction pooler; opt-in TLS docente ya aprobado.
- API iniciado en :3001 mediante pnpm --filter @technology-ecommerce/api start.
  Confirmó conexión databaseName=postgres y emite la advertencia TLS segura.
  Solo este API/worker usa el destino; origen/volumen Docker permanecen intactos.
- Health, landing, catálogo paginado y detalle REST devolvieron 200.
- Login real y auth/me pasaron para ADMIN, BILLING y CUSTOMER con sus
  credenciales privadas existentes, sin imprimir tokens ni contraseñas.
- ADMIN/BILLING consultaron órdenes, facturas y perfil empresarial (200).
  CUSTOMER consultó carrito, orders/mine e invoices (200, alcance propio).
  El primer smoke intentó invoices/mine, ruta inexistente interpretada como ID
  y rechazada con 400; se corrigió el smoke al endpoint existente /invoices.
  No se cambió ni inventó ningún contrato REST.
- Se iniciaron los frontends en :3000/:3002 para verificación. Browser público
  mostró la landing editorial (destacados, recientes y categorías) y detalle
  Development Monitor 27 con stock/precio/taxonomía y galería de cuatro imágenes.
  Inspección DOM confirmó carga de imagen principal y cuatro miniaturas
  (complete=true, naturalWidth>0), conservando referencias existentes.

No se crearon/editaron productos, órdenes o facturas ni se probaron cargas
Cloudinary o cambios de stock. Login genera sesiones/auditoría reales en destino;
lecturas de carrito pueden crear su agregado normal. Supabase ya no equivale a
la copia histórica local: no volver directamente al origen después de esto.
La UI administrativa autenticada no se auditó manualmente en todas sus pantallas;
las consultas por rol se verificaron por REST. No es una certificación productiva.

## Controles

- 26 pruebas focalizadas, tres archivos: connection-options,
  supabase-data-access y environment, todas pasan.
- typecheck y lint del API pasan.
- OpenSpec estricto y git diff --check pasan.
- Archivos privados/backup ignorados por Git; no se imprimieron credenciales.

Incidencia de ejecución: el primer comando usó vitest run -- seguido de filtros,
que lanzó la suite completa en vez del subconjunto. Hubo fallos/skips en fixtures
de integración con el entorno remoto; se detuvo esa ejecución y se repitieron
solo los tres archivos con `pnpm ... exec vitest run <archivos>` sin separador.
No se afirma que la suite integral pasara. Futuras integraciones deben recibir
URL local explícita y bases temporales, no heredar el destino activo Supabase.

## Archivos de la tarea

- apps/api/.env: cambio privado de conexión/TLS, no versionado.
- README.md y AGENTS.md: 164/164, arquitectura activa y reglas/skills Supabase.
- docs/supabase-course-migration.md: operación mínima, excepción TLS y retorno
  condicionado a reconciliar cambios, sin borrar origen ni assets.
- docs/local-development.md: contexto del entorno ahora activo.
- docs/VALIDATION-24.4.md y openspec/changes/build-technology-ecommerce-platform/tasks.md:
  evidencia y cierre de la tarea.
- tmp/activate24.mjs y tmp/smoke24.mjs: operaciones puntuales privadas ignoradas;
  no introducen harness genérico ni contienen credenciales literales.

Los skills oficiales Supabase guiaron la verificación de conexión directa y
separación entre RLS/grants, sin adoptar Auth/Storage ni cambiar REST/Drizzle.
Changelog actual revisado. Fuente: [conexiones Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres).
