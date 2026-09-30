# Backoffice empresarial — tarea 19.4

## Resultado

La aplicación administrativa utiliza la identidad y los tokens de 19.1–19.2
en claro y oscuro, sin copiar la composición comercial del storefront.
Se conservan los permisos, operaciones REST, formularios y criterios de URL.

Dirección visual: slate claro `#eef2f6`, navy nocturno `#0e1421`,
superficies `#ffffff` y `#182235`, acento azul `#1d4ed8` o `#8cb4fa`.
Arial para lectura y títulos; datos tabulares para importes e indicadores.
La navegación mantiene su base navy, reemplaza los acentos cyan por azul,
reduce la cabecera lateral y marca la página actual con una banda azul.

La capa administrativa aplica tokens a las primitivas Tailwind existentes,
incluyendo superficies, textos, estados, controles y foco.
Reemplaza las excepciones oscuras con colores independientes por una
adaptación semántica común para ambos temas. Se conservan los alias
`--admin-*` consumidos por componentes anteriores.

Las tablas tienen encabezados pequeños, filas compactas, cifras tabulares
y desplazamiento horizontal contenido. Los formularios utilizan controles
compactos con campos invalidos y deshabilitados distinguibles.
En móvil los campos conservan tamaño de texto adecuado para lectura.
La preferencia de movimiento reducido elimina transiciones de controles.

`AdminMetricCard` es una tarjeta presentacional de indicadores con nombre,
valor y descripción. Se utiliza para el stock real del producto en inventario;
no agrega consultas ni inventa métricas. El resumen REST y el dashboard inicial
siguen pendientes en 19.5–19.6.

La revisión responsive detectó que el historial vacío de inventario podía
tener desplazamiento horizontal sin un elemento enfocable. La tabla compartida
ahora expone una región nombrada y enfocable, con foco visible en el backoffice.

## Archivos modificados o creados

- `apps/backoffice/src/app/globals.css`: importa la apariencia administrativa y conserva alias semánticos.
- `apps/backoffice/src/styles/admin-appearance.css`: adaptación de colores, densidad, controles, tablas, estados y movimiento reducido.
- `apps/backoffice/src/features/layout/backoffice-shell.tsx`: navegación sobria y página actual accesible.
- `apps/backoffice/src/features/layout/admin-metric-card.tsx`: tarjeta de indicador reutilizable.
- `apps/backoffice/src/features/inventory/inventory-management.tsx`: uso de la tarjeta para stock real.
- `apps/backoffice/test/admin-metric-card.spec.tsx`: valor cero, asociación de etiqueta, valor y superficie.
- `apps/backoffice/test/backoffice-shell.spec.tsx`: página actual y superficie semántica, conservando pruebas de roles.
- `apps/backoffice/test/inventory-management.spec.tsx`: comprobación del valor en su nueva estructura semántica.
- `packages/ui/src/data-table.tsx`: región de desplazamiento nombrada y enfocable.
- `packages/ui/test/components.spec.tsx`: comprobación de accesibilidad de esa región.
- `e2e/frontend/catalog-api-fixture.ts`: respuestas REST controladas de órdenes, facturas e historial de inventario.
- `e2e/frontend/backoffice-design.spec.ts`: ocho combinaciones de rol, tema y viewport.
- `e2e/playwright.config.ts`: inclusión de los nuevos escenarios.
- `openspec/changes/build-technology-ecommerce-platform/tasks.md`: 19.4 marcada.
- `docs/backoffice-design.md`: resumen, alcance y evidencia.

## Verificación

- Backoffice: 101 pruebas en 21 archivos.
- Storefront: 108 pruebas en 19 archivos, como regresión del cambio compartido.
- UI: 34 pruebas en 6 archivos.
- Navegador: 33 pruebas correctas entre ambas aplicaciones.
- Ocho escenarios nuevos: ADMIN/BILLING, claro/oscuro y 375/1440 px.
  Comprueban tablas, encabezados compactos, ausencia de acciones de compra,
  navegación permitida, formulario de producto para ADMIN, factura manual para
  ambos roles e indicador de inventario exclusivo de ADMIN.
- Axe no detecta infracciones en esas vistas; no existe desbordamiento de página.
- Revisión de capturas de escritorio y móvil, incluyendo stock real en inventario.
- Lint, tipos y build: 15 tareas Turborepo correctas, incluyendo dependencias.
- Validación OpenSpec estricta y comprobación del diff correctas.

Los escenarios usan datos REST controlados; no escriben en PostgreSQL ni
ejecutan seed. Capturas y trazas quedan en `test-results/`, ignorado por Git.
Se mantiene la advertencia no bloqueante de Next.js sobre LCP del fallback
de imagen del storefront, ajena a este rediseño.

## Límite de entrega

19.5 no se inicia. No se implementa el endpoint de dashboard ni sus métricas
agregadas; tampoco se marca la cobertura completa de temas de 19.7.
README y AGENTS.md siguen reservados para 19.9.
Los cambios previos se preservan. No se realiza commit ni push.
