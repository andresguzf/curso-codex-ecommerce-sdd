# Storefront comercial — tarea 19.3

## Resultado

La tienda aplica los tokens de 19.1 y el runtime de temas de 19.2 a la landing,
catálogo completo, tarjetas, clasificaciones, detalle y controles de compra.
Mantiene la fotografía tecnológica del hero y el navbar azul oscuro fijo en
ambos temas. No usa tablas, KPI ni navegación administrativa.

Dirección visual: canvas azul hielo `#edf5ff` o azul nocturno `#081b30`,
superficies `#ffffff` o `#122d46`, acento comercial `#134cc5` o `#93c5fd`
y tipografía de títulos Trebuchet MS frente a Verdana para lectura.
El hero fotográfico es la pieza expresiva; el resto prioriza imagen, nombre,
precio USD, stock y acción de compra.

Las tarjetas dan espacio propio al título y stock, permiten envolver precio y
botón sin desbordar, y ofrecen foco visible también en la imagen enlazada.
El detalle conserva su imagen grande y acciones de carrito y deseos.
Los filtros, drawer móvil, paginador, carga y errores usan colores semánticos,
sin modificar las primitivas ni la apariencia del backoffice.
El header incluye un enlace directo a Productos; en móvil el carrito usa SVG
y badge con nombre accesible completo, y los accesos de sesión son compactos.
No se cambian contratos REST, autorización, stock ni comportamiento de compras.

## Archivos de esta tarea

- `apps/storefront/src/app/globals.css`: tipografía y tematización acotada de primitivas.
- `apps/storefront/src/features/layout/storefront-shell.tsx`: shell, footer y enlace a catálogo.
- `apps/storefront/src/features/auth/session-controls.tsx`: espaciado móvil y región vacía sin ocupar espacio.
- `apps/storefront/src/features/cart/cart-shortcut.tsx`: icono SVG y presentación móvil compacta.
- `apps/storefront/src/features/catalog/catalog-landing.tsx`: superficies, textos y acciones comerciales.
- `apps/storefront/src/features/catalog/catalog-page.tsx`: encabezado, búsqueda, resultados y paginación tematizados.
- `apps/storefront/src/features/catalog/catalog-filters.tsx`: controles semánticos y sidebar bajo el navbar.
- `apps/storefront/src/features/catalog/product-card.tsx`: jerarquía, imagen enlazada, precio, disponibilidad y compra.
- `apps/storefront/src/features/catalog/product-grid.tsx`: estado vacío coherente con el tema.
- `apps/storefront/src/features/catalog/product-classifications.tsx`: categoría y badges en ambos temas.
- `apps/storefront/src/features/catalog/product-detail.tsx`: imagen, superficies, textos y acciones.
- `apps/storefront/src/features/wishlist/wishlist-button.tsx`: controles de deseos coherentes con el producto.
- `apps/storefront/test/product-card-design.spec.tsx`: jerarquía comercial, ausencia de acciones administrativas, agotado y pendiente.
- `apps/storefront/test/product-detail.spec.tsx`: superficie semántica y ausencia de tabla administrativa.
- `apps/storefront/test/storefront-shell.spec.tsx`: navegación comercial y superficie del shell.
- `e2e/frontend/catalog-api-fixture.ts`: respuesta REST de detalle para las pruebas.
- `e2e/frontend/storefront-design.spec.ts`: landing, catálogo y detalle claro/oscuro, móvil/escritorio.
- `e2e/playwright.config.ts`: inclusión de las nuevas pruebas.
- `openspec/changes/build-technology-ecommerce-platform/tasks.md`: 19.3 completada.
- `docs/storefront-design.md`: resumen y evidencia de esta tarea.

## Verificación

- Storefront: 108 pruebas en 19 archivos, lint y typecheck correctos.
- Build de producción correcto.
- Suite completa de navegador: 25 pruebas correctas entre ambos frontends.
- Repetición final del storefront después del ajuste móvil: 12 pruebas correctas.
- Cuatro escenarios nuevos a 375 y 1440 px, en claro y oscuro, con revisión
  de capturas de landing, catálogo, drawer y detalle, sin desbordamiento ni
  infracciones de accesibilidad detectadas por axe.
- Regresión responsive existente a 320, 375, 768 y 1440 px correcta.
- OpenSpec estricto y comprobación del diff correctos.

Las pruebas de navegador usan respuestas REST controladas, no escriben en
PostgreSQL ni ejecutan el seed. Las capturas quedan en `test-results/` (ignorado).
Next.js conserva una advertencia no bloqueante de LCP para la imagen de fallback
en el listado; no hay errores de compilación ni pruebas fallidas.

## Límite

19.4 no se inicia. Las secciones editoriales de destacados/categorías, retirada
de filtros de la landing y galería siguen perteneciendo a las tareas específicas
20/21. Esta tarea aplica el diseño, sin adelantarse a esos cambios funcionales.
Los cambios locales anteriores de 19.1/19.2 se conservan. No se hace commit ni push.
