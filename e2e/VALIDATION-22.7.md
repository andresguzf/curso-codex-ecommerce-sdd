# Validación del gestor administrativo de imágenes — 22.7

Fecha: 1 de octubre de 2026. Cambio: `build-technology-ecommerce-platform`.

## Alcance y aislamiento

El gestor de productos de `ADMIN` está implementado: consulta completa, subida binaria JPEG/PNG/WebP, vista previa temporal, texto alternativo, portada única, orden por arrastre y teclado, eliminación confirmada, recuperación de errores, contador y bloqueo compartido de mutaciones. Se mantienen los borradores comerciales y los campos URL/clave únicamente en creación. El máximo es cuatro imágenes totales: una portada y hasta tres adicionales. No incluye compresión, recorte, ajustes de calidad ni integración nueva de Cloudinary.

`pnpm test:e2e:gallery` levanta NestJS real en 3101, backoffice en 3102 y storefront en 3100. Reutiliza el servidor de pruebas de facturación, que crea una base PostgreSQL con nombre aleatorio validado y aplica migraciones; las fixtures no son el seed de desarrollo. Los archivos viven en un directorio temporal creado con `mkdtemp`. Al terminar se cierran conexiones, se elimina únicamente esa base temporal y se retiran sus archivos. No se escribe en `ecommerce_backend_sdd`, no se ejecuta su seed y no se detienen los servicios habituales 3000/3001/3002.

Las consultas REST y las mutaciones de navegador no usan fixtures de respuestas. Para conservar la URL local de imágenes admitida por Next.js en 3001 sin tocar su API habitual, exclusivamente las descargas de miniaturas administrativas y las solicitudes del optimizador de imágenes se transportan hacia los bytes reales del almacenamiento de la API aislada en 3101. Se comprueba la decodificación de cada miniatura subida y de la portada pública (`naturalWidth > 0`). No se genera una imagen ficticia ni se modifica el contenido; las descargas pendientes se esperan antes de destruir el contexto. Esta prueba no certifica el optimizador Next.js ni un CDN de producción.

## Escenarios y evidencia

- Cuatro recorridos completos: claro/oscuro y 375/1440 px. Producto y categoría creados mediante REST; login real de Admin; tres archivos añadidos a la portada inicial; contador 4/4 y selector bloqueado; quinta imagen rechazada con `409 PRODUCT_IMAGE_LIMIT_REACHED`.
- Portada cambiada, orden modificado mediante teclado con foco restaurado, texto alternativo editado y eliminación primero cancelada y luego confirmada. Conservación del borrador, recarga de la galería y portada persistida.
- Portada activa protegida por REST, archivo accesible, orden y portada coherentes en detalle público por slug, tarjeta usando únicamente la portada y detalle visual con tres miniaturas. Se comprueban accesibilidad automatizada y ausencia de overflow en la vista administrativa.
- Un recorrido negativo rechaza POST/PATCH/DELETE para anónimo, Billing y Customer con 401/403.
- Nueva integración PostgreSQL/REST verifica carga, límite, portada, reordenamiento, eliminación y equivalencia del detalle por ID/slug sin alterar inventario.
- Nueva prueba de componente verifica aborto de una eliminación pendiente al perder identidad y ausencia de éxito privado para otra sesión. Las suites anteriores cubren duplicados, formatos, errores, pérdida de respuestas, regularización de galerías antiguas y producto inactivo sin imágenes.

## Controles ejecutados

- `pnpm test`: paquetes satisfactorios; API 315 pruebas. Repetición actualizada del backoffice: 198 pruebas satisfactorias.
- `pnpm --filter @technology-ecommerce/storefront test`: 131 pruebas satisfactorias, incluidas las tres protecciones de entorno del optimizador.
- `pnpm test:e2e:gallery`: cinco pruebas satisfactorias en la repetición final.
- `pnpm test:e2e:frontends --workers=2`: 104 pruebas satisfactorias.
- `pnpm test:e2e:themes --output=test-results/gallery-final-themes`: ocho pruebas satisfactorias, sin actualizar snapshots.
- `pnpm test:e2e:design-tokens`: siete pruebas satisfactorias.
- `pnpm contract:check`: cliente generado y contratos satisfactorios.
- `pnpm lint`, `pnpm typecheck` y comprobación TypeScript explícita de los nuevos archivos Playwright: satisfactorios.
- Builds aislados de API y backoffice durante el arranque de Playwright; build aislado de storefront.
- `git diff --check` y validación estricta de OpenSpec.

Durante la preparación se corrigieron fixtures que omitían imagen/categoría/slug, selectores de tarjeta y ruta del detalle, y una descarga de imagen todavía pendiente al cerrar el contexto. También se excluye del lint el directorio generado de pruebas del storefront. Dos esperas de componentes fallaron durante ejecuciones simultáneas intensivas; la repetición separada completa pasó sin cambiar el comportamiento de la aplicación ni elevar tolerancias para ocultar fallos.

La ejecución final de `pnpm test:e2e:gallery` obtuvo cinco escenarios exitosos. Se reemplazó el PNG inicial por bytes raster válidos y se comprobó que la portada se decodifica realmente (`naturalWidth > 0`). Next.js también evidenció su bloqueo de IP privada para el proveedor local: se habilita `dangerouslyAllowLocalIP` exclusivamente con `NODE_ENV=development`, sin seguir redirecciones; permanece deshabilitado en producción y pruebas. Tres pruebas de configuración verifican esa separación y la allowlist existente. El recorrido aislado conserva el transporte de imágenes descrito arriba y no certifica la optimización de producción.

Las capturas del nuevo recorrido se guardan en `test-results/gallery-real/admin-<tema>-<ancho>.png` (artefactos temporales ignorados). Las pruebas no equivalen a certificación de producción ni a auditoría manual completa de accesibilidad.

Estado final: 152/152 tareas completadas, fases 1–22 terminadas; cambio todavía sin archivar. El transporte browser de imágenes se valida contra archivos reales, pero el preload SSR del optimizador conserva la URL local 3001 y puede registrar 404 por claves exclusivas de la base aislada; no se considera una prueba del optimizador ni se oculta ese límite.

## Archivos de esta tarea

- `e2e/product-gallery.config.ts` y `e2e/frontend/product-gallery-real.spec.ts`: suite nueva con API real.
- `apps/api/test/e2e/invoice-browser-server.ts`: almacenamiento temporal y origen adicional de storefront para pruebas aisladas.
- `apps/api/test/product-catalog/product-administration.integration.spec.ts`: escenario integral REST.
- `apps/backoffice/test/product-image-deletion.spec.tsx`: pérdida de identidad durante DELETE.
- `apps/storefront/next.config.ts`, `apps/storefront/eslint.config.mjs` y `.gitignore`: salida Next.js aislada y exclusión de artefactos generados.
- `apps/storefront/test/product-image-config.spec.ts`: protección de la configuración de imágenes locales por entorno.
- `package.json`: comando dedicado e inclusión serial en `test:e2e`.
- `README.md`, `AGENTS.md`, `docs/catalog-image-contract.md`, este informe y `openspec/changes/build-technology-ecommerce-platform/tasks.md`: evidencia y seguimiento.

No se atribuyen a 22.7 cambios anteriores ya presentes en el árbol de trabajo. No se ejecutaron commit, push ni archivo de OpenSpec.
