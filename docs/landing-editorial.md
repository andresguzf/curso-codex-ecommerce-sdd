# Landing editorial — tarea 21.7

La página `/` presenta, en orden, hasta tres productos destacados, hasta nueve recientes sin repetir destacados y hasta tres categorías importantes con hasta tres productos cada una. Las categorías pueden volver a mostrar productos de las primeras secciones: son contextos comerciales independientes.

## Presentación y navegación

- Se conserva el hero tecnológico, la navegación azul y los tokens de ambas variantes del storefront. La decisión de frontend-design distingue destacados con una franja `--ds-accent-soft`; los recientes conservan su cuadrícula y las categorías se separan mediante bordes y enlaces al catálogo. No se añaden números decorativos, estadísticas ficticias, fuentes ni dependencias nuevas.
- Paleta existente: navy `#071c3c`, azul comercial `#134cc5`, lienzo `#edf5ff`, azul tenue `#dceaff`, texto nocturno `#eef7ff` y superficie nocturna `#122d46`. Los colores efectivos se resuelven por tokens según el tema; no se fijan colores claros sobre el modo oscuro.
- Tipografía existente: Trebuchet MS para títulos, Verdana para cuerpo y Courier New para etiquetas/datos. La sección destacada aporta la jerarquía diferenciada sin reformular el hero ni el backoffice.
- La cuadrícula usa una, dos o tres columnas según el ancho. Las tarjetas conservan portada, stock, USD, wishlist y compra pública mediante el flujo de carrito existente.
- Cada categoría ofrece `Explorar <nombre>` hacia `/products?page=1&categoryId=<id>`. “Ver todos los productos” sigue abriendo `/products`, y la búsqueda del hero dirige al catálogo con `page=1` y el término normalizado.
- No hay filtros, ordenamiento ni paginación en la landing. Los criterios heredados en su URL no afectan la composición.

## Datos y estados

Se mantiene una única consulta REST a `GET /api/v1/catalog/landing`, validada mediante Zod y gestionada por TanStack Query. No se realizan peticiones por sección ni se descargan colecciones para ordenar, deduplicar o paginar en el navegador: estas reglas pertenecen al API. Se conserva la revalidación al montar y recuperar foco.

Las secciones editoriales vacías se omiten. Los recientes conservan su estado vacío con acceso al catálogo; una configuración parcial no se completa con productos artificiales. La carga y el error seguro con reintento se mantienen, y las secciones no muestran datos anteriores si la consulta falla. Los títulos tienen identificadores únicos y regiones con nombre accesible; los enlaces y botones conservan foco visible y soporte de teclado.

## Archivos modificados

- `apps/storefront/src/features/catalog/catalog-landing.tsx`: composición de las secciones desde la respuesta existente.
- `apps/storefront/src/features/catalog/landing-product-section.tsx`: sección editorial presentacional reutilizable, con variante destacada y enlace de categoría.
- `apps/storefront/test/catalog-landing.spec.tsx`: composición completa/parcial/vacía, orden, repeticiones contextuales, navegación y compra desde destacados.
- `e2e/frontend/catalog-api-fixture.ts`: respuestas REST controladas completas, parciales y vacías. El fixture predeterminado sigue sin contenido editorial para las verificaciones generales; las nuevas pruebas lo habilitan explícitamente.
- `e2e/frontend/storefront-catalog.spec.ts`: seis escenarios adicionales para composición editorial, responsive, temas, accesibilidad y navegación por teclado.
- `docs/landing-latest-products.md`: enlace desde la evidencia histórica al alcance actual.
- Este documento y `openspec/changes/build-technology-ecommerce-platform/tasks.md`.

## Verificación

- Storefront: 121 pruebas exitosas; tipos, lint y build exitosos.
- Frontends: 87 pruebas exitosas; regresión de temas: ocho; tokens: siete. Las referencias existentes no se actualizan en esta tarea.
- Capturas de composición completa en ambos temas a 375 y 1440 px, con revisión visual de escritorio claro y móvil oscuro; validación automatizada de contraste, foco y ausencia de desbordamiento.
- Validación OpenSpec estricta y revisión de espacios del diff: exitosas.

Las pruebas de navegador utilizan datos controlados. Esta tarea no ejecuta el seed contra la base local y no acredita una auditoría manual integral de accesibilidad. Los datos demostrativos editoriales pertenecen a 21.6; la revisión general de README/AGENTS y validación final corresponde a 21.8, que no se inicia aquí.
