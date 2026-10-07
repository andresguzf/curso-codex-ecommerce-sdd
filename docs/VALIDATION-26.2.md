# Validación 26.2 — shell y hero panorámico del storefront

Fecha: 2026-10-07. Cambio: `build-technology-ecommerce-platform`.

## Entrega y límites

Se implementó únicamente 26.2 utilizando openspec-apply-change, react-rules,
frontend-design e imagegen. La dirección visual aprobada y los tokens de 26.1
guían un navbar persistente (sticky), enlaces activos, controles de cuenta y
carrito, footer y landing coherentes con blanco/lavanda o carbón/violeta.
El navbar conserva su translucidez al desplazar. La lógica de sesión y carrito
no cambia; tampoco los límites y orden editorial 3/9/3, sus consultas REST,
deduplicación, ausencia de filtros/paginador en inicio y búsqueda hacia catálogo.

El título y buscador están separados de la fotografía para mantener legibilidad.
El marco protagonista reserva una proporción 21:9 en escritorio y 16:9 en móvil,
sin deformar imágenes. El desplazamiento lateral usa transform, sobreencuadre
moderado y recorrido de 40 segundos por sentido; alterna cada 14 segundos con
fundido de un segundo. La selección manual pausa; pausa explícita, foco/puntero
(incluido el buscador) y página oculta detienen la animación y el temporizador.
La pausa explícita se conserva al terminar la interacción. Movimiento reducido
inicial o cambiado en vivo elimina pan, autoplay y fundido, sin bloquear selección.
No hay anuncios aria-live continuos. Timers/listeners se liberan al desmontar.

Next Image sirve ambos assets con sizes responsive y optimización existente.
Solo la primera imagen es eager/high; la segunda se monta dos segundos después
de que la primera termine o falle, o al seleccionarla, con lazy/low. Una imagen
fallida deja el respaldo del marco y la búsqueda operativa. El HTML declara
light como respaldo sin JavaScript; el bootstrap existente aplica sistema o
preferencia antes del body. Se verifica fotografía estática y búsqueda GET nativa
sin JavaScript, no se afirma que todos los flujos transaccionales funcionen sin él.

No se modificaron backoffice, primitivas compartidas, ProductGallery, backend,
contratos, datos, .env, Supabase o Cloudinary. No se subieron assets remotos,
ejecutó seed, desplegó, archivó ni hizo commit/push. 26.3–26.5 no se implementan
en esta entrega; la actualización general de README/AGENTS pertenece a 26.5.

## Imágenes generadas

Modo: herramienta integrada image_gen, dos generaciones independientes,
product-mockup; no CLI ni OPENAI_API_KEY. PNG de 1916×821, inspeccionados
visualmente y copiados sin sobrescribir el hero anterior. Fotografías de ambiente
ilustrativas, no representación garantizada de un SKU vendible.

Rutas finales relativas al repositorio:

- `apps/storefront/public/images/hero-rgb-keyboard-v2.png`
- `apps/storefront/public/images/hero-nvidia-gpu-v2.png`

Prompts descriptivos normalizados de las dos generaciones:

1. Hero fotográfico panorámico 21:9 de un teclado mecánico negro premium con
   chasis de aluminio y RGB azul/violeta/cian, escritorio oscuro elegante,
   iluminación moderna de estudio, vista baja de tres cuartos, composición
   centrada con margen lateral para movimiento lento y materiales hiperrealistas.
   Sin personas, manos, textos comerciales, precios, afirmaciones de SKU o marcas
   de agua.
2. Hero fotográfico panorámico 21:9 de una tarjeta gráfica moderna estilo NVIDIA,
   metal negro/aluminio, tres ventiladores y aletas de refrigeración, escritorio
   oscuro minimalista, iluminación azul/violeta con verde sutil, composición
   centrada y margen lateral, fotografía hiperrealista. Sin personas, manos,
   slogans, especificaciones comerciales inventadas, textos ni marcas de agua.

## Verificación

- Storefront typecheck y lint sin advertencias aprobados.
- `pnpm --filter @technology-ecommerce/storefront test`: 140 pruebas, 23 archivos.
- `pnpm test:e2e:themes`: ocho pruebas, referencias del backoffice intactas.
- `pnpm test:e2e:design-tokens`: siete pruebas.
- `pnpm test:e2e:frontends --workers=2`: 121 pruebas, incluidos siete escenarios
  nuevos de hero, composición editorial, sesión/carrito, galería y administración.
- Build del storefront aprobado.
- OpenSpec estricto y `git diff --check` aprobados.

La primera regresión completa tuvo 117 aprobadas y cuatro diferencias visuales
esperadas en shell storefront. Se revisaron las capturas y las ocho referencias
workspace/content de storefront antes de cerrar la nueva línea base; no se
actualizó ninguna administrativa. Las cuatro capturas adicionales de landing
light/dark a 375/1440 px también se revisaron visualmente. Las pruebas comprueban
foco, contraste mediante axe, overflow, pausa/reanudación, movimiento reducido
inicial/en vivo, prioridad/diferimiento, fallo de imágenes y búsqueda sin JS.

Fixtures REST aisladas: no escrituras en la base activa ni uploads Cloudinary.
La cobertura automatizada y revisión de capturas no certifican producción ni
sustituyen una auditoría manual completa de accesibilidad o rendimiento. Persisten
avisos no bloqueantes de Next sobre el placeholder y NO_COLOR/FORCE_COLOR de Node.

## Archivos de esta tarea

- `apps/storefront/src/features/catalog/catalog-hero.tsx`: composición y búsqueda.
- `apps/storefront/src/features/catalog/hero-showcase.tsx`: fotos y controles.
- `apps/storefront/src/features/catalog/use-hero-motion.ts`: preferencias/timers.
- `apps/storefront/src/features/layout/storefront-header.tsx`: navbar semántico.
- `apps/storefront/src/features/layout/storefront-shell.tsx`: enlaces, marca/footer.
- `apps/storefront/src/styles/storefront-landing.css`: estilos públicos scoped.
- `apps/storefront/src/app/globals.css`: import y retirada del estilo activo previo.
- `apps/storefront/src/app/layout.tsx`: tema HTML de respaldo sin JavaScript.
- Los dos PNG de `apps/storefront/public/images/` enumerados arriba.
- `apps/storefront/test/hero-motion.spec.tsx`: cinco pruebas unitarias nuevas.
- `e2e/frontend/storefront-hero.spec.ts`: siete escenarios nuevos y capturas.
- `e2e/playwright.config.ts`: incluir la suite del hero en storefront.
- Ocho PNG storefront en `e2e/frontend/theme-regression.spec.ts-snapshots/`.
- `openspec/changes/build-technology-ecommerce-platform/tasks.md` y `proposal.md`:
  progreso y referencia a evidencia; sin nuevos requisitos.
- `docs/VALIDATION-26.2.md`: este informe.

Los cambios anteriores de planificación y 26.1 se preservan. Estado al cierre:
168/173 completadas; pendientes 25.3–25.4 y 26.3–26.5. Detenerse antes de 26.3.
