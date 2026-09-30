# Infraestructura de temas — tarea 19.2

Cada aplicación activa sus tokens mediante `data-design-system` y `data-theme`
en `html`. Un script síncrono en el head lee una preferencia válida antes de que
se cree el body; si no existe, consulta `prefers-color-scheme`. No usa datos de
sesión, API, cookies, PostgreSQL ni Server Actions.

El botón fijo inferior derecho alterna claro/oscuro, tiene nombre accesible,
`aria-pressed`, foco visible y soporte de teclado. Se habilita después de conectar
el store. Zustand se crea por instancia de provider, sin tocar DOM ni storage
durante render ni compartir estado mutable entre peticiones SSR.

## Persistencia y sincronización

- Tienda: `technology-ecommerce:storefront:theme`.
- Backoffice: `technology-ecommerce:backoffice:theme`.
- Solo se guardan los literales `light` o `dark`. Valores corruptos se ignoran.
- Sin selección explícita, los cambios de preferencia del sistema se aplican.
- Una elección explícita prevalece al navegar, recargar y cambiar el sistema.
- Los eventos storage de la misma aplicación se sincronizan; los de la otra se
  ignoran. Borrar la preferencia vuelve a usar la del sistema.
- Si storage está bloqueado, el bootstrap y el control siguen funcionando en
  memoria. La persistencia entre recargas no puede garantizarse en ese caso.
- Las suscripciones se limpian al desmontar. La sincronización externa no escribe
  de vuelta en storage ni crea bucles.

Se retiró `AdminThemeController`: Admin y Billing ya no fuerzan un tema por rol.
Esto es una preferencia visual de la aplicación, independiente de permisos y
logout. Los aliases `--admin-*` apuntan a los tokens semánticos vigentes para
mantener legibles los componentes existentes; se corrigió el texto muted del
filtro de etiquetas en claro al habilitar ese tema para Admin.

## Límites de esta entrega

La infraestructura, superficies base y control están activos. No se afirma que
todo el storefront ya esté rediseñado en oscuro: la adopción de componentes y
las cuatro apariencias completas corresponde a 19.3, 19.4, 19.7 y 19.8. No se
construyó dashboard ni se cambió lógica de autenticación o negocio.

## Verificación

- `pnpm --filter @technology-ecommerce/ui test`: 34 pruebas correctas, seis nuevas
  sobre bootstrap, persistencia, sistema, eventos externos, storage bloqueado,
  limpieza y teclado.
- Suites de storefront y backoffice: 105 y 99 pruebas correctas.
- `pnpm exec playwright test --config=e2e/playwright.config.ts --workers=2`:
  21 pruebas correctas, incluidas cuatro nuevas de temas sobre las aplicaciones.
  Verifican el tema cuando aparece el body, recarga, navegación cliente, claves
  independientes, cambios del sistema, elección explícita y ausencia de avisos
  de hidratación. REST usa fixtures; no escribe en PostgreSQL.
- Las 17 regresiones previas de catálogo/accesibilidad también pasaron. Se
  corrigió el contraste detectado sin desactivar reglas axe.
- Lint, typecheck y builds de UI y ambas aplicaciones; tipos adicionales de las
  nuevas pruebas E2E; `git diff --check` y validación OpenSpec estricta.

Archivos de la tarea:

- `packages/ui/src/theme-bootstrap.ts`, `theme-provider.tsx`, `index.ts` y
  `packages/ui/test/theme.spec.tsx`.
- `apps/storefront/src/app/layout.tsx`, `providers.tsx`, `globals.css` y
  `apps/storefront/src/features/layout/storefront-shell.tsx`.
- `apps/backoffice/src/app/layout.tsx`, `providers.tsx`, `globals.css`;
  eliminado el controlador obsoleto `src/features/theme/admin-theme-controller.tsx`.
- `e2e/playwright.config.ts`, `e2e/frontend/theme-scenarios.ts`,
  `storefront-theme.spec.ts` y `backoffice-theme.spec.ts`.
- Este documento, actualización de `docs/design-tokens.md` y checkbox 19.2
  de `openspec/changes/build-technology-ecommerce-platform/tasks.md`.

Se preserva el trabajo previo de 19.1. No se inició 19.3 ni se hizo commit o push.
