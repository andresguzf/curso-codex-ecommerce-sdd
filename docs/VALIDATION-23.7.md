# Verificación 23.7 — catálogo Cloudinary, pruebas aisladas y smoke real

Fecha: 2026-10-02. Cambio: `build-technology-ecommerce-platform`. Alcance: únicamente 23.7; sin activar Cloudinary ni iniciar 23.8.

## Suites controladas

- Cinco pruebas nuevas del límite SDK verifican carpeta `dynamic` y `fixed`, bytes decodificables, identidades distintas, `overwrite=false`, aceptación seguida de timeout sin reupload, eliminación individual/ausencia y concurrencia mediante barrera. Los métodos originales del SDK se restauran después de cada prueba unitaria.
- Se ejecutó toda la suite del API: **400 pruebas en 44 archivos**, incluidas las pruebas REST/PostgreSQL anteriores de validación, autorización, respuesta inválida, límite concurrente, journal duradero, fallo de persistencia, recuperación con instancia nueva, exclusión entre workers y confirmaciones, backoff, limpieza repetida y protección de assets referenciados/ajenos, logos, Picsum, seed y PDF. La base de desarrollo no recibe migraciones ni seed; las pruebas crean y eliminan bases aleatorias.
- El contrato existente conserva las identidades Cloudinary y URLs HTTPS. Se añadió una prueba Zod que rechaza campos privados extra (`api_key`, `api_secret`, `signature`, `uploadOptions`). Pasan **48 pruebas de esquemas**, **17 pruebas OpenAPI**, **una del cliente generado** y su comprobación de generación.
- Se añadieron seis escenarios Playwright con NestJS escuchando HTTP real, PostgreSQL migrado y almacenamiento temporal aislados: cuatro recorridos de subida desde el mismo formulario, borrador comercial, miniatura decodificada, selección de portada, tarjeta y carrusel público con teclado, restauración de portada antigua, eliminación y reconciliación; uno de permisos/límite concurrente y compensación con imagen local conservada; uno de respuesta perdida tras aceptar bytes, conservación del borrador y galería, ausencia de reintento automático, reconciliación y posterior intento manual explícito. Se verifican los cuatro temas a 375/1440 px.
- El servidor de navegador reemplaza únicamente el límite SDK dentro del proceso de pruebas. La configuración efectiva usa credenciales ficticias y proveedor controlado; las pruebas normales de galería fuerzan `local` y descartan credenciales Cloudinary heredadas. Los endpoints diagnósticos `__e2e` existen solo en el ejecutable de pruebas ligado a loopback, nunca en `AppModule` ni en el API desplegable.
- La suite de galería local existente pasó nuevamente: **cinco escenarios**. La UI comercial no se rediseñó ni modificó, y no se agregaron controles de calidad.

## Prueba real autorizada

El usuario autorizó expresamente utilizar la cuenta de desarrollo/pruebas y eliminar únicamente un asset temporal. El script opt-in queda fuera de las suites normales y exige `CLOUDINARY_LIVE_TEST_AUTHORIZED=yes` y `CLOUDINARY_LIVE_TEST_NONPRODUCTION=yes`; rechaza configuración productiva y nunca imprime credenciales o cuerpos de error SDK.

Se consultó el modo mediante la [configuración de la Admin API de Cloudinary](https://cloudinary.com/documentation/admin_api#get_config): la cuenta es **dynamic**. El valor local aún no era un modo explícito válido; la primera preparación se detuvo antes de subir. Se adaptó el smoke para usar el modo verificado exclusivamente en su proceso, sin editar `.env` ni activar el proveedor.

Se subió **un solo PNG de 80×60 px**, generado para pruebas, con la identidad:

```text
operationId: e6404e48-9e90-438c-843c-3e8ff3ff8413
publicId: codex-storefront/e6404e48-9e90-438c-843c-3e8ff3ff8413
mode: dynamic
SHA-256: 70ab14231b0e5529e04bb3d76b6c1305eac106f0ed96ac022a4df7a356f861c2
```

El adaptador verificó identidad, carpeta/tag, URL HTTPS y metadatos; los bytes servidos coincidieron con los enviados, y Chromium decodificó y mostró la imagen real sin interceptar el CDN. Captura temporal: `test-results/cloudinary-live/render.png`, ignorada en Git.

La eliminación individual se ejecutó en `finally`. La primera aserción de ausencia comparaba erróneamente con `null`, aunque `findUpload` devuelve `undefined`: el comando reportó fallo de verificación pese a que ya había eliminado el asset. Se corrigió esa aserción y se añadió una prueba unitaria. **No se repitió el upload**. Una consulta real del public ID devolvió 404 y el modo de verificación solo lectura del script confirmó `absent=true` para la misma operación, con código de salida 0. El `.env` permaneció idéntico byte a byte.

No se borraron carpetas, productos ni imágenes anteriores. La eliminación del PNG temporal es definitiva; no hace falta recuperarlo, ya que era una fixture generada. El smoke no crea registros en PostgreSQL ni modifica el proveedor activo.

## Comandos ejecutados

```sh
IMAGE_STORAGE_CATALOG_PROVIDER=local CLOUDINARY_FOLDER_MODE= pnpm --filter @technology-ecommerce/api test --maxWorkers=2
pnpm --filter @technology-ecommerce/api typecheck
pnpm --filter @technology-ecommerce/api lint
pnpm --filter @technology-ecommerce/api-schemas test
pnpm contract:check
pnpm test:e2e:cloudinary
pnpm test:e2e:gallery
openspec validate build-technology-ecommerce-platform --strict
git diff --check
```

Solo tras autorización explícita (no ejecutar automáticamente):

```sh
CLOUDINARY_LIVE_TEST_AUTHORIZED=yes CLOUDINARY_LIVE_TEST_NONPRODUCTION=yes pnpm --filter @technology-ecommerce/api test:cloudinary:live
# Verificación posterior del mismo asset; esta variante no sube ni elimina nada:
CLOUDINARY_LIVE_TEST_AUTHORIZED=yes CLOUDINARY_LIVE_TEST_NONPRODUCTION=yes CLOUDINARY_LIVE_TEST_VERIFY_OPERATION=e6404e48-9e90-438c-843c-3e8ff3ff8413 pnpm --filter @technology-ecommerce/api test:cloudinary:live
```

Cada nueva ejecución que suba otro asset necesita autorización propia. La autorización de este informe no habilita ejecuciones futuras ni activación.

## Archivos de esta tarea

- `apps/api/test/e2e/controlled-cloudinary.ts`: límite SDK controlado, bytes, fallos y barrera de concurrencia.
- `apps/api/test/e2e/controlled-cloudinary.spec.ts`: cinco pruebas unitarias nuevas, incluida ausencia `undefined`.
- `apps/api/test/e2e/invoice-browser-server.ts`: selección explícita aislada y diagnóstico solo de pruebas; configuración local independiente de secretos heredados.
- `apps/api/test/e2e/cloudinary-live.ts`: smoke de un solo asset con autorización, comprobación de modo, renderizado y limpieza; variante posterior solo lectura.
- `e2e/cloudinary-gallery.config.ts`: suite HTTP/PostgreSQL real aislada en 3100/3101/3102.
- `e2e/frontend/cloudinary-gallery-real.spec.ts`: seis escenarios sin simular respuestas REST.
- `packages/api-schemas/test/product-images.spec.ts`: compatibilidad del contrato y rechazo de campos privados.
- `package.json`: comando `test:e2e:cloudinary` y encadenado serial en la suite general.
- `apps/api/package.json`: comando opt-in `test:cloudinary:live`.
- `openspec/changes/build-technology-ecommerce-platform/tasks.md` y este informe: estado/evidencia de 23.7.

## Límites y entrega

Las suites controladas interceptan únicamente el transporte visual de imágenes: las miniaturas y el optimizador reciben bytes del asset almacenado por el SDK de prueba; Picsum usa bytes de fixture. Los contratos, permisos, sesiones, mutaciones, PostgreSQL y reconciliación son reales. No certifican el optimizador de producción ni la cuenta Cloudinary ante fallos reales. La regresión local conserva el límite histórico de preload SSR a la URL 3001: puede registrar 404 para claves exclusivas de la base aislada, sin sustituir respuestas REST.

La prueba remota verifica solo un asset y modo dynamic; fixed se prueba con transporte controlado, no con una segunda cuenta. No constituye certificación de producción ni auditoría manual completa de accesibilidad. Se conservaron los cambios previos de 23.1–23.6; no se editó `.env`, se activó Cloudinary, se modificó el catálogo de desarrollo, se archivó OpenSpec ni se hizo commit/push. README y AGENTS.md corresponden a 23.8 y permanecen pendientes de esa tarea.
