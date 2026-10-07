# Verificación de los cuatro temas — tarea 19.8

## Estado vigente — fase 26, 7 de octubre de 2026

El rediseño afecta únicamente la tienda: claro blanco/lavanda, oscuro
carbón/violeta y tipografía local. Su navbar conserva sticky, transparencia al
scroll y enlaces activos, pero sigue el tema sin franja navy forzada en claro.
Los colores navy/cian descritos abajo son historia de 19.8, no la dirección
actual del storefront. El backoffice conserva paleta, fuentes y referencias.

La validación 26.5 ejecuta 141 pruebas de frontend, ocho de regresión visual con
16 referencias, siete de tokens y 19 focalizadas de hero/cliente. Revisa ambos
temas a 375/1440 px, carga/vacío/error, formularios, flash/modales, teclado y
foco, movimiento reducido, pausas y fallback del hero. Usa fixtures REST
aisladas, sin escrituras en Supabase ni cargas de Cloudinary.

Las ocho referencias de tienda fueron revisadas en 26.2–26.3; en 26.5 se
comparan sin regenerarlas. Las ocho administrativas no se modifican. Véanse
[tokens](design-tokens.md) y [evidencia y límites](VALIDATION-26.5.md). Esto no
certifica rendimiento de Vercel, CDN ni una auditoría manual completa WCAG.

## Cobertura histórica de 19.8

Revisión del 1 de octubre de 2026: el selector compartido de tienda y backoffice usa un botón circular de 44 px con luna para activar oscuro y sol para activar claro. Conserva nombre accesible, `aria-pressed`, tooltip, foco y persistencia independiente. Se revisan y actualizan las referencias por este cambio intencional del control, no para ocultar diferencias en el contenido.

La navbar comercial mantiene el azul navy, ahora `--ds-navbar-surface: #020e1d`, con opacidad del 98% al inicio y 82% al superar 24 px de scroll. Conserva posición sticky y desenfoque de fondo; al volver arriba restaura la opacidad inicial. La transición se desactiva con movimiento reducido. Las pruebas comerciales cubren ambos temas y tamaños 375/1440, cambio de opacidad, posición fija y accesibilidad tras desplazar.

La revisión posterior añade estado activo por pathname con `aria-current="page"` y borde/subrayado cian en los enlaces de navbar, cuenta y carrito; Productos, Mis compras y Mis facturas conservan la selección en sus detalles sin activar rutas de prefijo parecido. El selector usa SVG vectorial de 24 px: sol dorado, luna azul-violeta y estrellas, con gradientes internos y relieve sutil en la superficie. No se añaden assets externos ni se cambia la persistencia de temas. Las referencias visuales se revisan por estos dos cambios intencionales.

La matriz nueva cubre storefront y backoffice, claro y oscuro, a 375 y 1440 píxeles. Sus ocho pruebas comparan dieciséis capturas de catálogo, detalle de producto, dashboard ADMIN y tabla administrativa con referencias versionadas. La suite existente complementa esta matriz con landing, dashboard BILLING, formularios, errores, mensajes, modales y drawers, incluidos foco, teclado y tamaños de 320 a 1440 píxeles.

Cada caso nuevo verifica la preferencia inicial del sistema antes de aparecer el body, cambios del sistema sin preferencia guardada, selección por teclado con foco visible, persistencia al recargar y navegar, y aislamiento de la clave de la otra aplicación. Axe comprueba contraste y reglas WCAG AA en las vistas reales. La suite de tokens exige contraste de texto de 4.5:1 y de bordes/foco de 3:1; incluye ahora las regiones inversas de navbar y navegación administrativa. La automatización no sustituye una auditoría manual completa de accesibilidad.

## Ejecutar y revisar

- `pnpm test:e2e:themes`: compara las referencias, sin actualizarlas.
- `pnpm test:e2e:frontends --workers=2`: ejecuta toda la cobertura de navegador, incluida la matriz nueva.
- `pnpm test:e2e:design-tokens`: verifica contratos y contraste de tokens.
- `pnpm test:e2e:themes --update-snapshots`: regenera las referencias únicamente después de revisar y aprobar un cambio visual intencional. Inspeccionar los PNG y su diferencia antes de aceptarlos; nunca actualizar automáticamente para ocultar una regresión.

Las referencias viven en `e2e/frontend/theme-regression.spec.ts-snapshots/`. Se generaron con Chromium de Playwright en macOS (`darwin`); requieren el mismo sistema y versión de navegador. Linux necesita referencias propias revisadas, no reutilizar ni aceptar ciegamente las de macOS. La configuración conserva el sufijo de plataforma y proyecto para evitar comparaciones incompatibles.

Los datos REST son fixtures deterministas: no se escribe en PostgreSQL ni se usan imágenes remotas. Se espera a fuentes e imágenes, se deshabilitan animaciones y se oculta únicamente el indicador de desarrollo de Next mediante `e2e/screenshot.css`. No se enmascaran productos, tablas, precios ni componentes de la aplicación; la comparación exige cero píxeles distintos. Los resultados de frontends y tokens usan directorios separados para evitar colisiones de trazas.

## Archivos de la tarea

- `e2e/frontend/theme-regression.spec.ts`: matriz de preferencias, foco y regresión visual.
- `e2e/frontend/theme-regression.spec.ts-snapshots/`: dieciséis referencias PNG.
- `e2e/frontend/design-tokens.spec.ts`: contraste de regiones inversas.
- `e2e/screenshot.css`: exclusión del indicador de desarrollo.
- `e2e/playwright.config.ts` y `e2e/design-tokens.config.ts`: integración y resultados separados.
- `package.json`: comando específico de temas.
- `docs/theme-regression-testing.md`: cobertura y mantenimiento.
- `docs/theme-component-coverage.md`: enlace a la cobertura ampliada, antes pendiente.
- `openspec/changes/build-technology-ecommerce-platform/tasks.md`: estado de 19.8.

Esta tarea conserva la identidad visual existente, siguiendo las skills React y frontend-design para verificar accesibilidad y apariencia sin introducir un rediseño. README y AGENTS.md quedan para 19.9.

Verificación: 57 pruebas de frontend y siete pruebas de tokens aprobadas; la matriz de ocho casos volvió a pasar con las dieciséis referencias definitivas sin actualizarlas. Comprobación TypeScript estricta de los archivos de pruebas y configuraciones y validación OpenSpec estricta aprobadas. Se inspeccionaron visualmente capturas representativas móviles y de escritorio. No se modificó código de las aplicaciones ni contratos REST.
