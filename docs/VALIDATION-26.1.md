# Validación 26.1 — fundamentos visuales del storefront

Fecha: 2026-10-07. Cambio: `build-technology-ecommerce-platform`.

## Alcance entregado

Se implementó únicamente 26.1, después de aprobar la dirección visual. El claro
usa blanco y lavanda suave; el oscuro combina carbón con paneles violeta y
acentos lavanda/azul. Los aliases de regiones anteriormente inversas siguen
ahora el tema de la tienda, sin imponer franjas navy en claro. Los colores de
control y foco conservan contraste independiente de los bordes decorativos.

Source Sans 3 Variable se usa para texto y controles, Space Grotesk Variable
para títulos y una pila monoespaciada para datos. Las fuentes se empaquetan
localmente desde dependencias fijadas, sin llamadas a Google Fonts. Se conserva
su licencia SIL OFL. Se ajustan ritmo, radio y elevación mediante tokens.

Los selectores están limitados al sistema storefront, incluidos sus portales.
No se modificaron bootstrap, persistencia, claves de temas, lógica React,
contratos REST ni implementación compartida/backoffice. Tampoco se cambiaron
entornos, Supabase, Cloudinary, datos o proyectos de Vercel.

## Verificación

- `pnpm --filter @technology-ecommerce/storefront test`: 135 pruebas aprobadas
  en 22 archivos.
- `pnpm test:e2e:design-tokens`: siete pruebas aprobadas; contraste de texto,
  controles y foco, resolución de aliases y aislamiento administrativo.
- `pnpm test:e2e:frontends --workers=2`: 114 pruebas aprobadas, incluyendo
  persistencia, navegación, modales, formularios, galería y ambos frontends.
- `pnpm test:e2e:themes`: ocho pruebas aprobadas. Las ocho referencias de
  storefront a 375/1440 px se revisaron visualmente y actualizaron por el
  cambio intencional; ninguna referencia de backoffice se modificó.
- Typecheck, lint y build del storefront aprobados.
- Las pruebas de navegador comprueban fuentes cargadas, entrega WOFF2 desde
  el mismo origen, foco y ausencia de desbordamiento horizontal.
- OpenSpec estricto y `git diff --check` aprobados.

Las pruebas de frontend usan fixtures REST: no ejecutan seed ni escrituras en
la base activa. La cobertura automatizada y la revisión de capturas no
constituyen una auditoría manual completa de accesibilidad o certificación
de producción. Se mantienen avisos no bloqueantes de Next sobre prioridad
de la imagen placeholder y de Node sobre NO_COLOR/FORCE_COLOR.

## Archivos de esta tarea

- `apps/storefront/src/styles/design-tokens.css`: paletas, aliases y tipografía.
- `apps/storefront/src/app/globals.css`: fuentes locales y estilos base scoped.
- `apps/storefront/package.json` y `pnpm-lock.yaml`: dos paquetes de fuentes.
- `apps/storefront/public/fonts/LICENSE.txt`: atribuciones y licencia SIL OFL.
- `e2e/frontend/design-tokens.spec.ts`: tokens y aislamiento del backoffice.
- `e2e/frontend/storefront-design.spec.ts`: paleta y entrega local de fuentes.
- `e2e/frontend/theme-components.spec.ts`: expectativas del nuevo tema oscuro.
- Ocho PNG de storefront bajo
  `e2e/frontend/theme-regression.spec.ts-snapshots/`: claro/oscuro, 375/1440,
  workspace/content. Sin cambios a los PNG administrativos.
- `openspec/changes/build-technology-ecommerce-platform/design.md`: paleta
  oscura carbón/violeta aprobada y colores de ambas variantes.
- `openspec/changes/build-technology-ecommerce-platform/proposal.md` y
  `tasks.md`: progreso de 26.1 y referencia a esta evidencia.
- `docs/VALIDATION-26.1.md`: este informe.

Los demás cambios de planificación ya presentes pertenecen a la propuesta
aprobada de fase 26 y se conservaron.

## Próximo límite

26.1 queda completada. 26.2–26.5 siguen pendientes: no se ha implementado el
nuevo shell/hero, generado sus imágenes ni añadido su movimiento/alternancia.
La galería de producto conserva su comportamiento sin autoplay. No se hizo
commit, push ni despliegue. Esperar confirmación antes de comenzar 26.2.
