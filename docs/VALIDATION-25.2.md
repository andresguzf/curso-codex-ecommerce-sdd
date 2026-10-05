# 25.2 — Configuración de Vercel y Session pooler

Fecha: 2026-10-05. Estado: completada la preparación; **no se desplegó**.

## Implementación

- Tres `vercel.json`, raíces independientes `apps/api`, `apps/storefront` y
  `apps/backoffice`, frameworks nativos, región `iad1`, instalación congelada
  y builds pnpm. Configuración inicial API: 300 segundos y archivo histórico
  explícitamente incluido; corregida durante 25.3 como se describe abajo.
- Tres inventarios `.env.vercel.example` con placeholders, secretos solo API.
  Guía de workspace externo/Node 22.x, variables, dominios, migración controlada,
  presupuesto por instancia y retorno en `docs/vercel-course-deployment.md`.
- Rewrites REST desde ambos Next.js, base pública vacía y `/api/v1` para sesión.
  Cliente compartido resuelve navegador→mismo origen y SSR→API privado; mantiene
  URLs locales explícitas. No se introdujeron Route Handlers/Server Actions.
- Allowlist exacta, cookies Secure/HttpOnly host-only y CSRF existentes conservados.
  Builds preview omitidos; API rechaza arranque no Production en Vercel antes de
  crear pools/servicios. Secretos no deben configurarse en Preview/Development.
- Cron diario preparado **solo como fragmento de ejemplo**, no activado.
  El corte de ejecutores y publicación corresponden a 25.3.
- Caché Turbo contempla variables de routing/públicas; git/ESLint ignoran
  `.next-*` para builds aislados, sin afectar archivos fuente ni servidores locales.

## Verificación

- URI privada provista por el usuario: host Session pooler real y puerto 5432.
  `pnpm --filter @technology-ecommerce/api vercel:preflight` pasó: TLS
  cliente→pooler cifrado, excepción explícita del curso (`verifyServer=false`),
  exclusión y liberación entre dos sesiones usando un advisory lock aleatorio.
  Máximo configurado runtime: dos conexiones de consulta + dos de coordinación
  por instancia; el total escala con instancias, no es un límite global.
- La primera comprobación de cifrado inspeccionó `pg_stat_ssl`, que refleja
  pooler→PostgreSQL, no cliente→pooler; se corrigió para inspeccionar el socket
  TLS del cliente y se repitió satisfactoriamente. No hubo cambios de tablas/datos.
- 31 pruebas API focalizadas pasan (entorno, conexión, despliegue y asset
  inmutable), incluyendo rewrites locales/remotos, rechazo de previews,
  cookies y CSRF. API build/typecheck/lint correctos.
- 16 pruebas del cliente compartido pasan; typecheck/lint correctos.
- 31 pruebas backoffice pasan (galería, perfil y subida), incluida miniatura
  relativa con base pública vacía. Ambos frontends: typecheck/lint correctos.
- Builds production Next.js de ambas aplicaciones correctos en
  `.next-vercel-check`, con URL API sintética y variables públicas same-origin;
  no se sobrescribieron sus directorios `.next` de desarrollo. Un primer lint
  incluyó esos outputs generados; se corrigieron los ignores y la repetición pasó.
- Los tres `vercel.json` validan contra el esquema oficial descargado de Vercel
  con Ajv (sin reinterpretar framework/propiedades). OpenAPI sincronizado;
  OpenSpec estricto y `git diff --check` correctos.
- Nest incluyó el recurso PNG en `dist`: 1.007.288 bytes y SHA-256
  `b9d0f53fc42fa0a81b27259c832a1b23a0d81ebf5e68f5d8b4d1e2d736525a85`.
  Archivo privado preflight comprobado como ignorado por Git, sin mostrar URI.

## Archivos de esta tarea

- `apps/{api,storefront,backoffice}/{vercel.json,.env.vercel.example,.env.example}`.
- `apps/{storefront,backoffice}/{next.config.ts,eslint.config.mjs}`.
- `apps/api/src/{main.ts,config/deployment-runtime.ts}`,
  `apps/api/test/deployment/{vercel-config.spec.ts,vercel-preflight.ts}` y
  `apps/api/package.json`.
- `packages/api-client/{src/client.ts,test/same-origin-client.spec.ts}`.
- `apps/backoffice/test/product-gallery-panel.spec.tsx`.
- `infra/deployment/vercel/api-cron.example.json`, `turbo.json`, `.gitignore`.
- `docs/vercel-course-deployment.md`, este informe y OpenSpec `tasks.md`.

## Límites

### Corrección durante 25.3 — 2026-10-05

El primer build remoto de `612605e` falló en CLI 62.1.0 antes de compilar:
`functions["src/main.ts"]` produjo `unmatched-function-pattern`. La validación
JSON de 25.2 no detectaba esta incompatibilidad del detector de Functions.
Se retiró únicamente el bloque `functions`, manteniendo framework NestJS,
región, instalación/build y restricción de previews. Hobby con Fluid Compute
usa 300 segundos por defecto; verificar el valor efectivo en el panel antes
de habilitar cron. El análisis local Node File Trace del módulo compilado
incluye el PNG histórico sin advertencias ni `includeFiles`; la lectura conserva
su huella y bytes. Se ajustaron la prueba de configuración y la guía. La tarea
25.3 sigue pendiente hasta completar/verificar el despliegue real.
Verificación de la corrección: ocho pruebas focalizadas, build/typecheck/lint
del API, OpenSpec estricto y diff check correctos; rastreo repetido del módulo
compilado con el PNG incluido y cero advertencias.

No se modificó `.env`, conexión activa, Supabase Auth/Storage, registros ni assets.
No migración, seed, compra, upload, reconciliación, corte de workers, cron activo,
creación de proyectos, contratación, publicación, commit ni push.
El test de conexión usa locks efímeros, no escrituras persistentes.
Los dominios/budgets efectivos y comportamiento del bundle en Vercel se verificarán
en 25.3–25.4; builds locales no certifican cold starts, proxies ni la cuenta Hobby.
README/AGENTS consolidados de despliegue siguen perteneciendo a 25.4.
