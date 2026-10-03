# Verificación 23.6 — entrega de imágenes del catálogo

Fecha: 2026-10-02. Cambio: `build-technology-ecommerce-platform`. Alcance: solo tarea 23.6.

## Cambios y compatibilidad

- El storefront permite optimizar únicamente URLs HTTPS de `res.cloudinary.com` con la estructura `/<cloud>/image/upload/v<version>/codex-storefront/<archivo>`, sin puerto alternativo ni parámetros. El resolver añade validación de versión numérica y rechaza credenciales embebidas y fragmentos. No se habilitan transformaciones, firmas, recursos de vídeo ni carpetas ajenas. La URL emitida por el adaptador existente satisface esta estructura tanto en modo fixed como dynamic.
- Se conservan los hosts demo, referencias locales y placeholder. `dangerouslyAllowLocalIP` sigue habilitado únicamente en desarrollo; las redirecciones locales continúan deshabilitadas allí. No se ampliaron permisos de IP en producción o pruebas. Referencia de configuración: [documentación oficial de Next.js](https://nextjs.org/docs/app/api-reference/components/image#remotepatterns).
- No cambió el contrato REST: `image`, `coverImage` e `images` ya admiten las referencias devueltas por el adaptador. Tampoco cambian el cliente generado, formularios, gestor de galería, diseño, controles ni calidad/compresión. El backoffice mantiene las miniaturas nativas existentes y su fallback accesible.
- Las reglas React se aplicaron conservando la UI y los hooks existentes: no se añadió estado remoto duplicado ni effects para eventos, y no se actualizaron dependencias.

## Verificación

- Diez escenarios nuevos de navegador comprueban tarjetas y detalle con bytes PNG decodificables, carrusel por teclado, foco, fallback, móvil/escritorio y los cuatro temas. El backoffice conserva el borrador comercial ante un `504 IMAGE_STORAGE_TIMEOUT`, recupera la galería y envía una sola petición sin reintento automático.
- El matcher real de Next.js y el resolver se prueban con URLs permitidas y rechazadas; las restricciones de IP se verifican en development, production y test.
- Los procesos de navegador usan puertos 3200/3202 y `.next-image-delivery-e2e`, sin reutilizar los servidores del usuario. El directorio aislado se ignora en Git y ESLint. La prueba existente de navegación usa el `baseURL` del proyecto en lugar de fijar el puerto 3000.
- Un primer recorrido completo detectó esa aserción de puerto y un fallo intermitente de foco tras eliminar una imagen. Sin modificar ni debilitar la aserción de foco, los doce casos repetidos (tres recorridos de los cuatro temas/tamaños) pasaron. Esto no demuestra ausencia absoluta de intermitencias ni sustituye una auditoría manual de accesibilidad.

## Comandos

```sh
pnpm --filter @technology-ecommerce/storefront test
pnpm --filter @technology-ecommerce/backoffice exec vitest run --maxWorkers=2
pnpm --filter @technology-ecommerce/api-schemas test
pnpm --filter @technology-ecommerce/storefront typecheck
pnpm --filter @technology-ecommerce/backoffice typecheck
pnpm --filter @technology-ecommerce/storefront lint
pnpm --filter @technology-ecommerce/backoffice lint
pnpm exec playwright test --config=e2e/image-delivery.config.ts --workers=2
pnpm exec playwright test --config=e2e/image-delivery.config.ts --grep 'administrative image deletion' --repeat-each=3 --workers=2
pnpm test:e2e:design-tokens
openspec validate build-technology-ecommerce-platform --strict
git diff --check
```

Resultado final: 114 pruebas de navegador aprobadas (incluyen las diez nuevas y las regresiones visuales/temas sin actualizar snapshots), doce repeticiones focalizadas de eliminación y siete pruebas de tokens. Suites unitarias: storefront 133 pruebas en 21 archivos, backoffice 198 en 28 y contratos Zod 47 en 13. Typecheck y lint de ambas aplicaciones, OpenSpec estricto y `git diff --check` aprobados. La primera ejecución unitaria concurrente del backoffice tuvo un timeout de autocomplete de factura; la suite completa pasó con dos workers, sin modificar esa prueba ni su código.

## Archivos de esta tarea

- `apps/storefront/next.config.ts` y `apps/storefront/src/features/catalog/product-image-url.ts`: entrega restringida y fallback compatible.
- `apps/storefront/test/product-image-config.spec.ts` y `apps/storefront/test/product-image.spec.ts`: configuración real de Next.js, restricciones y resolver.
- `e2e/frontend/storefront-cloudinary.spec.ts`, `e2e/frontend/backoffice-cloudinary.spec.ts` y `e2e/frontend/cloudinary-image-fixture.ts`: escenarios de entrega y fallo controlados.
- `e2e/frontend/catalog-api-fixture.ts`: opciones opt-in de URL remota y timeout, sin cambiar comportamiento por defecto.
- `e2e/frontend/storefront-catalog.spec.ts`: puerto derivado del entorno de prueba.
- `e2e/playwright.config.ts` y `e2e/image-delivery.config.ts`: inclusión de escenarios y ejecución aislada.
- `.gitignore`, `apps/storefront/eslint.config.mjs` y `apps/backoffice/eslint.config.mjs`: exclusión del output aislado.
- `openspec/changes/build-technology-ecommerce-platform/tasks.md` y este informe: estado y evidencia.

## Límites

Estos escenarios usan respuestas REST e imágenes controladas; las rutas Cloudinary y `/_next/image` se interceptan en el navegador. Verifican renderizado, no una petición upstream del optimizador ni una cuenta real. Las pruebas de API REST real, PostgreSQL aislado, recuperación remota y la prueba real opt-in corresponden a 23.7. No se usaron credenciales Cloudinary, no se modificó `.env`, no se activó el proveedor ni se ejecutaron migraciones o seed contra desarrollo. Se conservaron los cambios previos de 23.1–23.5. Sin commit/push ni archivo del cambio.
