# Landing: productos recientes — tarea 20.7

Verificación realizada el 1 de octubre de 2026. La tarea 21.3 desbloqueó esta integración mediante `GET /api/v1/catalog/landing`.

## Comportamiento implementado

- La portada consume una composición pública REST y presenta únicamente `latestProducts`: hasta nueve productos activos, en el orden descendente decidido por el backend y sin repetir los destacados de la composición.
- No descarga el catálogo completo ni filtra, ordena, recorta o pagina resultados en memoria. El cliente valida la respuesta mediante el esquema Zod estricto, incluyendo límites, estados activos y exclusión de duplicados.
- La consulta usa TanStack Query con clave `['catalog', 'public', 'landing']`, propaga la cancelación y no envía parámetros de búsqueda, filtros o paginación. Los parámetros heredados en la URL de inicio no afectan esta consulta.
- No hay filtros, ordenamiento ni paginador en la landing. “Ver todos los productos” abre `/products`; el buscador del hero dirige a `/products?page=1&search=…`.
- Se muestran estados de carga, error seguro con reintento y ausencia de novedades. Con menos de nueve resultados se muestran únicamente los disponibles.
- Se conservan tarjetas, portada, wishlist y agregar al carrito para visitantes o clientes, con el feedback y navegación existentes.

El criterio de frontend-design conserva la identidad comercial: hero tecnológico, navbar azul, tipografías y tokens existentes. La cuadrícula ocupa el ancho disponible, sin el panel de filtros administrativo, y funciona en los temas claro y oscuro.

Las secciones visuales de destacados y categorías importantes siguen pendientes de 21.7. La galería sigue pendiente de 20.9. Esta tarea no implementa controles administrativos editoriales ni modifica el seed.

## Archivos de esta tarea

- `apps/storefront/src/features/catalog/catalog-api.ts`: lectura REST y validación de la composición.
- `apps/storefront/src/features/catalog/catalog-landing.tsx`: sección de recientes, navegación y estados accesibles.
- `apps/storefront/test/catalog-api.spec.ts`: petición sin parámetros, cancelación, contrato y errores.
- `apps/storefront/test/catalog-landing.spec.tsx`: orden, exclusión de destacados, límites, estados, búsqueda y carrito.
- `e2e/frontend/catalog-api-fixture.ts`: respuestas de composición con cero, dos o nueve productos y registro de solicitudes completadas.
- `e2e/frontend/storefront-catalog.spec.ts`: navegación al catálogo, búsqueda, ausencia de filtros/paginador, accesibilidad y responsive en ambos temas.
- `openspec/changes/build-technology-ecommerce-platform/tasks.md`: 20.7 completada.
- `docs/landing-latest-products.md`: alcance y evidencia de verificación.

## Evidencia

- `pnpm test`: suite del monorepo aprobada; storefront con 107 pruebas.
- `pnpm typecheck`, `pnpm lint` y `pnpm build`: aprobados.
- `pnpm test:e2e:frontends --workers=2`: 63 pruebas aprobadas, incluidas seis nuevas para esta tarea.
- `pnpm test:e2e:themes`: ocho pruebas aprobadas, sin modificar referencias visuales.
- `pnpm test:e2e:design-tokens`: siete pruebas aprobadas.
- Inspección de capturas de la landing a 375 y 1440 px, con temas claro y oscuro; sin desbordamiento horizontal y con la cuadrícula responsive.

Las pruebas de navegador emplean respuestas REST controladas; no acreditan una carga de seed contra la base local. Las reglas de composición transaccional del API se verificaron en 21.3 y están documentadas en `docs/catalog-landing-api.md`.
