# Cobertura de temas — tarea 19.7

Se extienden las cuatro combinaciones existentes (storefront y backoffice, claro y oscuro) a los componentes ya implementados y sus estados. Se mantienen independientes la densidad, tipografía, paleta e identidad visual de cada aplicación.

## Implementación

- `packages/ui/src/theme-coverage.css` adapta las utilidades de colores heredadas a los tokens semánticos: superficies, texto, bordes, estados, hover, foco, selección, placeholder y disabled.
- La capa se limita a documentos con `data-design-system` y `data-theme`; no impone colores a otros consumidores de las primitivas compartidas.
- Navbar, hero, paneles de resumen del carrito/checkout y franjas de acceso conservan su identidad oscura mediante `data-tone-region="inverse"` y tokens propios por aplicación. Los formularios anidados restablecen la paleta normal con `data-tone-region="surface"`.
- Los portales de modales, drawers y mensajes heredan la paleta del documento, no la de una franja oscura.
- Se cubren autenticación, cuenta, deseos, carrito, checkout, catálogo, dashboard, tablas, formularios, autocomplete, paneles, mensajes y confirmaciones.
- Estados de orden/factura/disponibilidad y tonos flash conservan sus textos; errores tienen mensajes y aria-invalid, los controles deshabilitados mantienen su atributo nativo y el foco es visible. Ningún significado depende solo del color.
- No hay gráficos de datos implementados en esta etapa; no se agregan gráficos ficticios ni nuevas funcionalidades de analítica.

## Mantenimiento y pruebas

La prueba estática recorre ambos frontends y las primitivas compartidas para detectar cualquier utilidad de la paleta heredada que quede sin adaptación. Los componentes nuevos deben preferir tokens semánticos directamente; si se incorpora otra utilidad heredada, la prueba exige añadir su adaptación.

Se verifica cambio de tema con un modal abierto, conservación del foco, contraste WCAG AA, alertas, validación de formularios, layout responsive y las vistas de catálogo, dashboard y administración existentes. La matriz ampliada de regresión visual de 19.8 se describe en [theme-regression-testing.md](theme-regression-testing.md).

Verificación completada: 108 pruebas de storefront, 118 de backoffice y 38 de UI compartida; 49 pruebas de navegador; lint, typecheck y build de ambos frontends y UI compartida; validación OpenSpec estricta. Se inspeccionó visualmente el formulario de acceso administrativo oscuro con errores de validación.

## Archivos de esta tarea

Agregados:

- `packages/ui/src/theme-coverage.css`
- `packages/ui/test/theme-coverage.spec.ts`
- `e2e/frontend/theme-components.spec.ts`
- `docs/theme-component-coverage.md`

Actualizados:

- `apps/storefront/src/app/globals.css`
- `apps/backoffice/src/app/globals.css`
- `apps/storefront/src/styles/design-tokens.css`
- `apps/backoffice/src/styles/design-tokens.css`
- `apps/storefront/src/features/layout/storefront-shell.tsx`
- `apps/storefront/src/features/catalog/catalog-hero.tsx`
- `apps/storefront/src/features/catalog/product-card.tsx`
- `apps/storefront/src/features/cart/cart-summary.tsx`
- `apps/storefront/src/features/checkout/checkout-form.tsx`
- `apps/storefront/src/features/auth/auth-shell.tsx`
- `apps/backoffice/src/features/layout/backoffice-shell.tsx`
- `apps/backoffice/src/features/auth/login-form.tsx`
- `apps/backoffice/src/app/login/page.tsx`
- `e2e/playwright.config.ts`
- `openspec/changes/build-technology-ecommerce-platform/tasks.md`
