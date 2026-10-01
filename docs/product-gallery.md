# Galería accesible de producto — tarea 20.9

Implementación y verificación del 1 de octubre de 2026.

## Comportamiento

El detalle consume la colección `images` del contrato REST existente, conserva su orden y empieza en la imagen marcada como portada. Seleccionar otra imagen no modifica la portada persistida ni produce una mutación REST.

- Imagen grande completa, sin recortes, dentro de un marco cuadrado de dimensiones reservadas. Se reutilizan los tokens comerciales, tipografías y paleta azul del storefront, en claro y oscuro.
- Miniaturas seleccionables con `aria-pressed`, nombres accesibles y controles anterior/siguiente. La navegación manual es circular.
- Flechas izquierda/derecha e Inicio/Fin en la imagen enfocada. En miniaturas, las mismas teclas desplazan la selección y el foco al botón correspondiente; los controles anterior/siguiente conservan el foco.
- Deslizamiento horizontal de al menos 50 px para navegar. Los movimientos verticales, cortos o cancelados no cambian la imagen; `touch-pan-y` conserva el desplazamiento vertical de la página.
- Posición actual anunciada en una región `aria-live="polite"`, texto alternativo del API en la imagen grande y miniaturas decorativas dentro de botones con nombre.
- Sin autoplay, intervalos, animaciones obligatorias ni efectos de sincronización del estado. La selección es estado local y se reinicia al cambiar de producto o colección mediante una key.
- Portada inicial con carga inmediata, miniaturas con carga diferida y otras imágenes grandes montadas únicamente cuando se seleccionan, con carga diferida. `fill`, `sizes` y el marco estable evitan variaciones de tamaño durante la carga o navegación.
- Una sola imagen no presenta botones, miniaturas, contador ni un punto de foco innecesario. Una colección vacía o una URL que falla utiliza el fallback local existente, conservando un nombre accesible.

No cambia el contrato del API ni el almacenamiento de imágenes. Las tarjetas siguen presentando exclusivamente la portada. No incorpora zoom ni lightbox, que no forman parte de esta tarea.

## Archivos de esta tarea

- `apps/storefront/src/features/catalog/product-gallery.tsx`: componente de galería manual.
- `apps/storefront/src/features/catalog/product-detail.tsx`: integración en el detalle.
- `apps/storefront/test/product-gallery.spec.tsx`: ocho pruebas de portada, selección, teclado, foco, gestos, fallback, carga diferida y ausencia de autoplay tras un minuto simulado.
- `apps/storefront/test/product-detail.spec.tsx`: comprobación del texto alternativo de la portada del API.
- `e2e/frontend/catalog-api-fixture.ts`: configuración de una o múltiples imágenes para pruebas.
- `e2e/frontend/storefront-gallery.spec.ts`: seis escenarios de navegador para móvil/escritorio, ambos temas, navegación, foco visible, tamaño estable y accesibilidad.
- `e2e/playwright.config.ts`: inclusión de la nueva suite de galería.
- Cuatro referencias revisadas en `e2e/frontend/theme-regression.spec.ts-snapshots/`: `storefront-{light,dark}-{375,1440}-content-storefront-darwin.png`. Se actualizan solo las capturas del detalle por el nuevo marco y ajuste sin recorte; se conservan las referencias del catálogo completo y del backoffice.
- `openspec/changes/build-technology-ecommerce-platform/tasks.md`: 20.9 completada tras la verificación.
- `docs/product-gallery.md`: alcance y evidencia.

## Verificación

- Storefront: 115 pruebas aprobadas en veinte archivos.
- `pnpm typecheck`, `pnpm lint` y `pnpm build`: aprobados.
- `pnpm test:e2e:frontends --workers=2`: 69 pruebas aprobadas, incluidas las seis nuevas de galería y la regresión de los cuatro temas.
- `pnpm test:e2e:design-tokens`: siete pruebas aprobadas.
- `pnpm test:e2e:themes`: ocho pruebas aprobadas, tras revisar y actualizar únicamente las cuatro referencias del detalle.
- Validación OpenSpec estricta y `git diff --check`: aprobados. Progreso: 139/145 tareas.
- Inspección visual de capturas de galería con múltiples imágenes y de las cuatro nuevas referencias de detalle, a 375/1440 px y en claro/oscuro. Verificación automatizada con axe, ausencia de desbordamiento horizontal y dimensiones estables al navegar.

Las pruebas de navegador usan REST controlado y eventos Touch sintéticos; no sustituyen una revisión manual en dispositivos físicos o con lectores de pantalla. Las capturas usan el fallback local para no depender de imágenes externas. Las referencias son Chromium/macOS.

La consolidación de pruebas y actualización de README/AGENTS.md corresponde a 20.10; no se implementa en esta tarea.
