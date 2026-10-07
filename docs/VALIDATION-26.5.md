# Validación final del storefront — tarea 26.5

Fecha: 7 de octubre de 2026. Cambio: `build-technology-ecommerce-platform`.

## Resultado

Fase 26 completada, exclusivamente para la tienda pública. Se conservan el
backoffice, contratos REST, reglas comerciales, sesión, inventario, snapshots
y PDFs. Estado del plan: 171/173 tareas; 25.3–25.4 siguen pendientes.
Esta entrega no despliega ni certifica los proyectos de Vercel.

## Verificación ejecutada

| Comando | Resultado |
|---|---|
| `pnpm --filter @technology-ecommerce/storefront test` | 140 pruebas, 23 archivos |
| `pnpm test:e2e:frontends --workers=2` | 141 pruebas, storefront y backoffice |
| `pnpm test:e2e:themes` | 8 pruebas, 16 referencias comparadas sin regenerar |
| `pnpm test:e2e:design-tokens` | 7 pruebas |
| `pnpm exec playwright test --config=e2e/playwright.config.ts storefront-hero storefront-customer --workers=2` | 19 pruebas focalizadas |
| `pnpm --filter @technology-ecommerce/storefront lint` | Correcto |
| `pnpm --filter @technology-ecommerce/storefront typecheck` | Correcto |
| `pnpm --filter @technology-ecommerce/storefront build` | Correcto; 12 páginas estáticas y rutas dinámicas |
| `openspec validate build-technology-ecommerce-platform --strict` | Correcto |
| `git diff --check` | Sin errores de espacios |

Los casos focalizados también pertenecen a la suite completa: los conteos no
representan pruebas únicas sumables. Chromium/macOS, REST con fixtures aisladas,
sin escrituras en PostgreSQL/Supabase ni cargas o eliminaciones de Cloudinary.
El build valida compilación y rutas, no conectividad del despliegue.

## Revisión visual y funcional

- Claro blanco/lavanda y oscuro carbón/violeta coherentes, sin franjas oscuras
  forzadas en claro; fotografías conservan su color natural. Fuentes locales.
- Capturas a 375/1440 px de landing, catálogo, detalle y recorridos del cliente:
  cuenta, wishlist, compras/facturas, carrito, modal y checkout. Se inspeccionaron
  muestras de ambos temas y tamaños; sin cortes horizontales ni controles
  ilegibles. Las capturas full-page pueden dibujar el header sticky en la
  posición de scroll del caso; no implican un header insertado dentro del formulario.
- Matriz de 16 referencias: ocho storefront revisadas en 26.2–26.3 y ocho
  administrativas conservadas. En 26.5 no se actualizó ningún PNG de referencia.
- Contraste de tokens/axe, foco visible, teclado, enlaces activos, drawers y
  eliminación con confirmación/foco, junto con persistencia independiente del tema.
- Hero: marco reservado, primera imagen prioritaria y segunda diferida,
  selección manual, paneo/alternancia y pausa explícita o por interacción;
  movimiento reducido estático y cambios de preferencia en vivo. Las pruebas
  unitarias complementan la pausa por visibilidad y limpieza de timers.
- Fallo de imágenes mantiene fallback y búsqueda; sin JavaScript hay una foto
  estática y búsqueda GET nativa, no una garantía de toda la app sin JavaScript.
- Carga/vacío/error/reintento, stock no disponible, cantidades y totales,
  flash/modal, borradores conservados al cambiar tema, checkout simulado
  rechazado/pendiente/aprobado y clave de idempotencia. La galería de producto
  permanece manual; no se modifica el gestor administrativo.

## Cambios de esta tarea y archivos

- `README.md` y `AGENTS.md`: estado real del plan, nueva identidad pública,
  comportamiento del hero, límites de verificación y pendientes de Vercel.
  Se alinean con 25.1 el logo SVG fijo y los 47 paths OpenAPI existentes;
  no se cambia el contrato ni la implementación del API.
- `docs/design-tokens.md`, `docs/theme-regression-testing.md` y
  `docs/theme-runtime.md`: dirección vigente y separación explícita de la
  evidencia histórica de fase 19. Las skills React/frontend-design guiaron la
  revisión de aislamiento visual, contraste, foco y movimiento reducido.
- `openspec/changes/build-technology-ecommerce-platform/proposal.md` y
  `tasks.md`: progreso coherente y checkbox 26.5 con evidencia.
- `docs/VALIDATION-26.5.md`: este informe consolidado.

No se modificó código de aplicación en 26.5. Los cambios de código, assets,
fixtures y referencias de 26.1–26.4 ya presentes se preservan; sus informes
individuales mantienen la trazabilidad.

## Límites y advertencias

La automatización y revisión de muestras no son una auditoría manual completa
de accesibilidad, rendimiento real, CDN ni seguridad productiva. Se observaron
avisos de Next sobre LCP del placeholder de producto en fixtures y avisos
NO_COLOR/FORCE_COLOR: no hubo fallos de pruebas, pero no se afirma resolver LCP
productivo. Los datos remotos, CORS/cookies de Vercel y cron no se verificaron
en esta tarea. Las fotos del hero son ilustrativas, no una garantía de SKU.

No se leyó/modificó el entorno privado ni se ejecutaron seed, migraciones,
pruebas remotas, uploads, despliegues, commit/push o archivo. Detenerse tras
26.5; retomar 25.3–25.4 requiere una nueva instrucción y autoridad operativa
para las acciones externas que correspondan.
