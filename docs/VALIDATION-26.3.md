# Validación 26.3 — catálogo y detalle del storefront

Fecha: 2026-10-07. Cambio: `build-technology-ecommerce-platform`.

## Entrega

Únicamente tarea 26.3, con openspec-apply-change, react-rules y frontend-design.
Se extiende la dirección aprobada blanco/lavanda y carbón/violeta al catálogo,
tarjetas, filtros, orden, paginación, detalle y galería. Tailwind y tokens locales
mantienen superficies coherentes; no se añade una biblioteca de animaciones.

La cabecera del catálogo deja atrás la franja cian y el panel con sombra. Las
tarjetas tienen bordes decorativos suaves, títulos/precios de jerarquía comercial
y el SKU bajo la fotografía, sin una etiqueta oscura sobre ella. Conservan una
sola portada, fallback seguro, stock, USD y callbacks de compra/deseos. La imagen
reserva su proporción y ajusta sizes al grid responsive; el hover no desplaza la
tarjeta. El componente compartido dentro del storefront también se refleja en
la landing y wishlist, sin implementar los demás flujos de 26.4.

Filtros desktop y drawer móvil mantienen criterios, validación, aplicación,
limpieza, búsqueda/orden y páginas en URL. Separadores suaves no sustituyen los
bordes de controles con contraste. El foco es visible también en el formulario
portallado. El paginador conserva su algoritmo y nombres accesibles; sus botones
tienen altura mínima de 44 px, con estados actual, deshabilitado y hover.

El detalle presenta galería y ficha de compra en dos columnas en escritorio y
apiladas en móvil. Tipografía, espaciado, precio, categoría y etiquetas siguen la
identidad pública. ProductGallery conserva portada inicial, colección ordenada,
miniaturas, flechas, Inicio/Fin, gestos, anuncios de selección y fallback. No se
añaden timers ni autoplay, ni se cambia la portada al navegar.

Las pruebas de carga/error del detalle detectaron la ausencia previa de h1 en
esas vistas. Se agrega un encabezado principal visible sin cambiar solicitudes,
reintentos ni estados de negocio. No se deshabilitan reglas de accesibilidad.

## Verificación

- Storefront typecheck y lint aprobados.
- `pnpm --filter @technology-ecommerce/storefront test`: 140 pruebas en 23 archivos.
- `pnpm test:e2e:design-tokens`: siete pruebas aprobadas.
- `pnpm test:e2e:frontends --workers=2`: 129 pruebas aprobadas, incluidas las ocho
  de regresión de temas con referencias administrativas intactas.
- `pnpm test:e2e:themes`: ocho pruebas aprobadas en una pasada independiente.
- Build optimizado del storefront, OpenSpec estricto y `git diff --check` aprobados.

Ocho escenarios nuevos verifican catálogo pendiente/vacío/error/reintento,
detalle pendiente/error/404/recuperación y stock agotado en ambos temas a
375/1440 px. La cobertura existente conserva filtros/orden/paginación backend,
URL, historial/recarga, compra, clasificaciones, galería manual y sesión.
Se comprueban axe (incluido contraste), foco y ausencia de overflow.

Se revisaron capturas de catálogo, detalle, drawer y galería con miniaturas.
Las cuatro diferencias iniciales de regresión corresponden al rediseño aprobado;
solo se actualizan las ocho referencias storefront workspace/content, nunca las
administrativas. La primera suite completa detectó cuatro fallos del h1 previo,
corregidos en el componente y cubiertos también por pruebas unitarias.

Fixtures REST aisladas, sin API conectado a Supabase ni escrituras/cargas reales.
La revisión de capturas y pruebas automatizadas no son certificación productiva
ni auditoría manual completa de accesibilidad/rendimiento. Persisten avisos de
desarrollo no bloqueantes sobre el placeholder LCP y NO_COLOR/FORCE_COLOR.

## Archivos modificados en esta tarea

- `apps/storefront/src/features/catalog/catalog-page.tsx`: cabecera, búsqueda,
  separadores y presentación del paginador.
- `apps/storefront/src/features/catalog/catalog-filters.tsx`: panel y marcadores
  semánticos para estilos, icono compatible con ambos temas.
- `apps/storefront/src/features/catalog/product-card.tsx`: portada, SKU,
  tipografía, bordes y ritmo de precio/acción.
- `apps/storefront/src/features/catalog/product-classifications.tsx`: ficha de
  categoría/etiquetas con superficies y espaciado coherentes.
- `apps/storefront/src/features/catalog/product-detail.tsx`: layout responsive,
  jerarquía comercial y h1 en carga/error.
- `apps/storefront/src/features/catalog/product-gallery.tsx`: marco, espaciado y
  marcador de miniaturas; navegación manual intacta.
- `apps/storefront/src/app/globals.css`: adaptaciones scoped de controles,
  formulario portallado y contador del carrusel.
- `apps/storefront/test/product-card-design.spec.tsx`: SKU fuera de foto y bordes.
- `apps/storefront/test/product-detail.spec.tsx`: encabezado en carga/error.
- `e2e/frontend/catalog-api-fixture.ts`: stock configurable exclusivamente de prueba.
- `e2e/frontend/storefront-design.spec.ts`: ocho escenarios y aserciones visuales.
- Ocho PNG en `e2e/frontend/theme-regression.spec.ts-snapshots/`, prefijo
  `storefront-{light|dark}-{375|1440}-{workspace|content}-storefront-darwin.png`.
- `openspec/changes/build-technology-ecommerce-platform/tasks.md` y `proposal.md`:
  progreso y referencia a este informe al cerrar la verificación.
- `docs/VALIDATION-26.3.md`: evidencia y límites.

Se preservan cambios previos de planificación y 26.1–26.2. No se modifican
backoffice, primitivas compartidas, API, contratos, .env, base activa ni imágenes
remotas. Sin seed, despliegue, commit/push ni archivo. README/AGENTS se actualizarán
en 26.5. Detenerse antes de 26.4.

Estado al cierre: 169/173 tareas completadas; pendientes 25.3–25.4 y 26.4–26.5.
