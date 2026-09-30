# Verificación de accesibilidad y responsive — tarea 18.2

Ejecutar `pnpm test:e2e:accessibility` para las 15 pruebas específicas o
`pnpm test:e2e:frontends` para incluir también las dos regresiones de navegación
del catálogo. Playwright inicia las interfaces locales cuando no están en ejecución.
Las respuestas REST son fixtures controladas: estas pruebas no escriben en PostgreSQL
ni reemplazan las pruebas de autenticación y negocio contra el API real.

## Cobertura verificada

- Chromium, anchos de 320, 375, 768 y 1440 px.
- Storefront: visitante en landing y catálogo; cliente en carrito.
- Backoffice: Admin con el tema oscuro actual y Billing con el tema claro actual.
- Shells, navbar, hero, navegación administrativa móvil y lateral, filtros izquierdos
  y derechos, drawers, confirmaciones destructivas y mensajes de éxito/error.
- Auditoría axe-core 4.13.0 con reglas WCAG 2 A/AA, WCAG 2.1 A/AA y buenas prácticas,
  incluyendo contraste calculado en el navegador, sin desactivar reglas.
- Tab, Shift+Tab, Enter y Escape; foco visible, salto al contenido sin que el header
  lo tape, retorno al control de apertura y conservación del foco al colapsar filtros.
- Drawers por encima del header, fondo inerte, scroll bloqueado, cierre al pasar
  a escritorio, y respeto de movimiento reducido.
- Modal centrado en móvil, foco inicial en Cancelar, ciclo de foco y bloqueo de scroll.
- Regiones persistentes `aria-live="polite"` para éxito y `assertive` para error;
  los componentes compartidos también prueban información y advertencias.
- Ausencia de desbordamiento horizontal del documento; las tablas conservan su
  desplazamiento interno. Capturas de landing, filtros y navegación se guardan
  en `test-results/` (ignorado por Git) para revisión visual.

Resultado: 15 pruebas específicas y 2 regresiones de catálogo exitosas; 28 pruebas
de UI compartida, 105 de storefront y 99 de backoffice exitosas. Lint y typecheck
de esos tres paquetes y comprobación TypeScript de las nuevas pruebas exitosos.

La comprobación automatizada de semántica y regiones de anuncio no constituye una
certificación ni una prueba auditiva con lectores de pantalla físicos. La matriz
completa de cuatro temas futuros pertenece a 19.8 y no se marca realizada aquí.

## Correcciones y archivos de esta tarea

- Contraste de navegación móvil y margen del salto al contenido:
  `apps/backoffice/src/features/layout/backoffice-shell.tsx`.
- Margen del salto al contenido del storefront:
  `apps/storefront/src/features/layout/storefront-shell.tsx`.
- Retorno de foco entre controles de filtros, asociación `aria-controls` y cierre
  del drawer al ampliar pantalla:
  `apps/storefront/src/features/catalog/catalog-filters.tsx`,
  `packages/ui/src/icon-button.tsx`.
- Enlace distinguible sin depender solo del color:
  `apps/storefront/src/features/catalog/catalog-page.tsx`.
- Contraste del botón de checkout en reposo y hover:
  `apps/storefront/src/features/cart/cart-summary.tsx`.
- Portal, semántica válida de diálogo, aislamiento del fondo y administración de foco:
  `packages/ui/src/filter-drawer.tsx`, `apps/storefront/src/app/globals.css`.
- Bloqueo/restauración del scroll de confirmaciones:
  `packages/ui/src/confirmation-dialog.tsx`.
- Pruebas y fixtures:
  `packages/ui/test/filter-drawer.spec.tsx`,
  `e2e/frontend/accessibility-helpers.ts`,
  `e2e/frontend/storefront-accessibility.spec.ts`,
  `e2e/frontend/backoffice-accessibility.spec.ts`,
  `e2e/frontend/catalog-api-fixture.ts`.
- Ejecución reproducible y dependencia de pruebas:
  `e2e/playwright.config.ts`, `package.json`, `pnpm-lock.yaml`.
- Evidencia y avance:
  `e2e/ACCESSIBILITY.md`,
  `openspec/changes/build-technology-ecommerce-platform/tasks.md`.

Los cambios pendientes de la tarea 18.1 se conservaron sin modificarlos.
