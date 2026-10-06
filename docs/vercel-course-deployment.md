# Vercel Hobby — tres aplicaciones, misma Supabase y Cloudinary

Preparación 25.2 y despliegue parcial 25.3 del curso. El proyecto API ya tiene
dominio; la corrección de runtime ESM requiere verificar el nuevo despliegue.
No se ha cambiado la conexión local. El corte y los otros dos proyectos siguen
pendientes en 25.3; pruebas con dominios finales, a 25.4.

## Proyectos

Importar el mismo repositorio tres veces, con Production Branch `main`:

| Proyecto | Root Directory | Framework | Región |
| --- | --- | --- | --- |
| API | `apps/api` | NestJS | `iad1` |
| Tienda | `apps/storefront` | Next.js | `iad1` |
| Administración | `apps/backoffice` | Next.js | `iad1` |

Activar **Include source files outside of the Root Directory in the Build Step**
en los tres proyectos para resolver `packages/` y el lockfile del workspace.
Seleccionar Node.js **22.x**. Cada `vercel.json` fija instalación con
`pnpm install --frozen-lockfile` y build `pnpm build`; no indicar Output Directory
manual ni crear otro backend. El API conserva `src/main.ts` y soporte nativo
[NestJS](https://vercel.com/docs/frameworks/backend/nestjs).

El API usa ESM nativo: `type: module` en su package.json y TypeScript
`module/moduleResolution: NodeNext`. Los imports relativos de TypeScript llevan
`.js` (o `/index.js`) para resolver el código compilado. No convertir el entrypoint
a CommonJS ni confiar en `require(ESM)`: `@nestjs/config` 12 es ESM y el runtime
de Vercel rechazó su carga con `ERR_REQUIRE_ESM`, incluso tras seleccionar 22.x.
Los paquetes externos y los contratos REST no cambian. La prueba
`test/deployment/esm-runtime.spec.ts` compila y arranca HTTP sin base de datos,
con `require(ESM)` deshabilitado; consulta evidencia parcial en
[VALIDATION-25.3.md](VALIDATION-25.3.md).

No añadir `functions["src/main.ts"]`: la validación de CLI 62.1.0 lo rechaza
con `unmatched-function-pattern` antes de compilar NestJS. Mantener Root Directory
`apps/api` y framework NestJS. Con Fluid Compute, Hobby tiene 300 segundos por
defecto; comprobar ese valor en Settings → Functions antes de activar el cron.
El rastreo del módulo compilado incluye el PNG histórico sin `includeFiles`.
La entrega efectiva se verificará en el despliegue, no solo con el build local.
[Duración de Functions](https://vercel.com/docs/functions/configuring-functions/duration).

Los dos frontends usan `output: undefined` cuando `VERCEL=1`: el adaptador Next.js
de Vercel empaqueta sus propias Functions. Fuera de Vercel se conserva
`output: "standalone"` para self-hosting. Forzar standalone en el build remoto
provocó `ENOENT .next/next-server.js.nft.json` al ejecutar `onBuildComplete`,
después de compilar y pasar TypeScript; no es un error de variables REST.
No crear un archivo NFT vacío ni desactivar el tracing del monorepo.

`iad1` está cerca de la región Supabase us-east-1 indicada por el usuario;
no implica cambiar la región de Supabase. Consultar [regiones de Functions](https://vercel.com/docs/functions/configuring-functions/region).

## Variables, únicamente en Production

Usar los archivos `.env.vercel.example` de cada aplicación como inventario,
**no subir archivos privados ni publicar valores `REPLACE_*`**.

| Aplicación | Variables |
| --- | --- |
| Solo API, secretas | `DATABASE_URL`, `AUTH_ACCESS_TOKEN_SECRET`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CRON_SECRET` |
| API, configuración privada | `DATABASE_TLS_VERIFY_SERVER`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_FOLDER_MODE`, `IMAGE_STORAGE_CATALOG_PROVIDER`, `IMAGE_STORAGE_MAX_BYTES`, `IMAGE_STORAGE_PUBLIC_BASE_URL`, `AUTH_COOKIE_SECURE`, `AUTH_COOKIE_SAME_SITE`, `CORS_ALLOWED_ORIGINS`, `NODE_ENV` |
| Frontends, pública | `NEXT_PUBLIC_API_BASE_URL` vacío, `NEXT_PUBLIC_API_URL=/api/v1`, enlace HTTPS hacia la otra aplicación |
| Frontends, routing/SSR | `API_REST_ORIGIN=https://<dominio-api>`, sin ruta, credenciales, query ni barra final |

Conservar secretos JWT/Cloudinary y la misma base existentes. Cloudinary sigue
en `codex-storefront`, modo dynamic confirmado, y las URLs Picsum quedan intactas.
No incluir `SEED_*`, claves Supabase frontend ni `NEXT_PUBLIC_*` con secretos.
Vercel establece `VERCEL` y `VERCEL_ENV`. Las variables públicas se fijan al
compilar; cambiarlas requiere un nuevo build de ese frontend.

## Conexión y presupuesto

Copiar la URI **real** de Supabase → Connect → **Session pooler, 5432**.
El puerto 6543 corresponde a Transaction pooler y no conserva los locks de
sesión necesarios. No construir host/usuario a partir de la región.
[Conexiones Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres).

La prueba privada está disponible sin cambiar `.env`:

```sh
pnpm --filter @technology-ecommerce/api vercel:preflight
```

Lee `apps/api/.env.vercel-preflight`; hereda únicamente la política TLS explícita
de `.env` si falta allí, nunca su URI. Verifica TLS cliente→pooler y exclusión/
liberación de un advisory lock aleatorio entre dos conexiones. No ejecuta
migraciones, seed, workers, escrituras de datos ni Cloudinary.

TLS verifica por defecto. La demo autorizada usa explícitamente
`DATABASE_TLS_VERIFY_SERVER=false`: tráfico cifrado, **sin comprobar identidad
del servidor**, con riesgo de suplantación; no afecta HTTPS de Cloudinary.

En Vercel: máximo dos conexiones de consulta + dos de coordinación = **cuatro
por instancia**, reutilizadas y con cierre de inactividad corto. No son cuatro
globales: N instancias pueden consumir hasta 4N; reservar además las conexiones
locales/administrativas/migrador. Antes del corte, revisar Pool Size/Max Clients
de Supabase y límites efectivos de la cuenta; no ampliar planes automáticamente.

## Sesiones y URLs

Cada Next.js reescribe `/api/v1/:path*` hacia `API_REST_ORIGIN`, sin Route
Handlers ni Server Actions. El navegador usa su propio origen; las lecturas
SSR usan REST hacia el API. Las URLs locales actuales funcionan sin esta variable.

API: allowlist exacta `https://<tienda>,https://<backoffice>`, sin comodines.
Cookies refresh **Secure + HttpOnly**, SameSite=Lax, host-only y path
`/api/v1/auth`; los rewrites permiten cookies bajo el dominio de cada frontend.
El token CSRF se obtiene por REST y se manda como `X-CSRF-Token` en refresh/
logout. Access token Bearer solo en memoria. No se garantiza SSO entre dominios:
cada frontend conserva su propia cookie/sesión.

El SVG empresarial fijo lo sirve el API. La única imagen local histórica
autorizada está incluida como recurso inmutable con su hash y clave; sus
respuestas Vercel usan el rewrite de media, sin reescribir PostgreSQL ni subirla.
Fotos Cloudinary/Picsum mantienen sus URLs. Cargas nuevas van a Cloudinary,
máximo 4 MiB. No depender del filesystem mutable de una Function.

## Previews y migraciones

`ignoreCommand` omite builds que no sean Production; el API también rechaza
arranque Vercel no Production antes de crear servicios/pools. No copiar secretos
a Preview/Development ni usar Force Deploy para saltarse esta protección.
Para probar previews hará falta autorización y recursos aislados, fuera de esta
preparación. [Ignored Build Step](https://vercel.com/kb/guide/how-do-i-use-the-ignored-build-step-field-on-vercel).

Las migraciones **no** se ejecutan en build, arranque ni petición. En 25.3:
revisar journal remoto contra el repositorio; si hay pendientes, respaldo y
autorización antes de ejecutar `pnpm --filter @technology-ecommerce/api
db:migrate:deploy` con secretos privados en el proceso y el directorio de
migraciones correcto. El esquema actual ya fue trasladado en fase 24: no
suponer que necesita una nueva copia, seed o migración.

## Secuencia siguiente, todavía no ejecutada

1. Confirmar cuenta/equipo, nombres y URLs; revisar presupuestos y protección
   de acceso de los proyectos. Publicar API y comprobar health.
2. Completar allowlist/URLs reales; publicar ambos frontends con rewrites.
3. Cortar el ejecutor periódico local antes de habilitar el remoto. **No** hay
   cron activo en estos `vercel.json`. El fragmento
   `infra/deployment/vercel/api-cron.example.json` prepara `08:00 UTC` diario;
   incorporarlo al API únicamente durante el corte autorizado de 25.3.
   `CRON_SECRET` protege el endpoint y la función admite hasta 300 segundos.
4. Validar dominios/sesión/galería/documentos en 25.4. No hacer compras,
   reconciliación real destructiva ni cargas de prueba sin autorización propia.

Retorno: deshabilitar primero el cron remoto antes de volver al ejecutor local;
conservar Supabase, Cloudinary, credenciales y originales. No revertir esquema,
borrar assets, recrear base ni cambiar proveedor silenciosamente.
