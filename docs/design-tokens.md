# Tokens visuales — base 19.1 y actualización 26.5

El [catálogo visual](design-system.html) puede abrirse directamente en el navegador.
Carga los mismos archivos CSS que importan las aplicaciones; no duplica sus colores.
Las muestras son estáticas, sin API, compras, sesiones ni escrituras.

## Dirección y límites

- Tienda: blanco/lavanda en claro y carbón/violeta en oscuro, azul secundario,
  tarjetas amplias y bordes sutiles. Space Grotesk para títulos, Source Sans 3
  para lectura (fuentes locales) y monospace para datos. La fase 26 reemplaza
  la antigua banda azul y las fuentes del sistema, sin cambiar el backoffice.
- Administración: slate/navy, azul operativo, radios pequeños y mayor densidad;
  Arial para lectura y títulos, monospace para identificadores e importes.
  La firma es un borde lateral discreto en el panel de trabajo.
- Se conservan identidades independientes, no una misma apariencia con distinto
  logo. Cada tema tiene valores propios; las regiones inversas de tienda siguen
  el tema y no fuerzan franjas oscuras en claro.
- No se necesitan fuentes remotas. Los fallbacks del sistema conservan
  legibilidad sin red. Las muestras no necesitan imágenes ni animaciones.

## Contrato de composición

Los tokens `--ds-*` se activan únicamente bajo un elemento con ambos atributos:

```html
<section data-design-system="storefront" data-theme="dark">…</section>
<section data-design-system="backoffice" data-theme="light">…</section>
```

Cada aplicación posee su archivo `src/styles/design-tokens.css`. Comparten nombres
semánticos para componer primitivas, no valores ni una apariencia cerrada.
Desde 19.2 se activan en el `html` mediante bootstrap, switch, Zustand y
persistencia independiente; ver [infraestructura de temas](theme-runtime.md).
Los estilos legados `--admin-*` tienen aliases semánticos. La adopción completa
en componentes reales se completó en 19.3/19.4/19.7 y se renovó para tienda en 26.

Tailwind puede consumirlos con clases como `bg-[var(--ds-surface)]`,
`text-[var(--ds-text)]` y `rounded-[var(--ds-radius-panel)]`, sin valores de marca
en componentes compartidos. El HTML de documentación usa CSS presentacional
para poder abrirse sin un servidor ni una compilación Tailwind.

| Familia | Tokens |
|---|---|
| Superficies | `canvas`, `surface`, `surface-subtle` |
| Texto y límites | `text`, `text-muted`, `border` |
| Acciones | `accent`, `accent-hover`, `accent-text`, `accent-soft`, `focus` |
| Estados | `success`, `warning`, `danger`, `info` y sus variantes `*-soft` |
| Deshabilitado | `disabled`, `disabled-text` |
| Forma y elevación | `radius-control`, `radius-panel`, `elevation` |
| Espaciado | `space-unit`, `space-control`, `space-panel`, `space-stack` |
| Densidad | `control-height`, `row-height`, `density` |
| Tipografía | `font-body`, `font-display`, `font-data`, `text-body`, `text-title`, `line-body` |

Todos los nombres de la tabla llevan el prefijo `--ds-`.

| Combinación | Canvas | Superficie | Acento | Texto | Densidad |
|---|---|---|---|---|---|
| Tienda clara | `#ffffff` | `#ffffff` | `#6554ae` | `#252737` | Amplia |
| Tienda oscura | `#0d0d12` | `#1c1726` | `#bca7ef` | `#f3f1f7` | Amplia |
| Administración clara | `#eef2f6` | `#ffffff` | `#1d4ed8` | `#172235` | Compacta |
| Administración oscura | `#0e1421` | `#182235` | `#8cb4fa` | `#e8edf5` | Compacta |

No usar `border` como superficie ni `accent-text` fuera de una acción de acento;
cada pareja tiene un propósito de contraste. Los estados incluyen texto y símbolo,
no solo color. Los controles deshabilitados también conservan lectura suficiente.

## Verificación reproducible

`pnpm test:e2e:design-tokens` ejecuta siete pruebas Chromium sin iniciar aplicaciones
ni tocar PostgreSQL: contrato completo de 37 tokens, independencia de las cuatro
combinaciones, texto con contraste mínimo 4.5:1, foco y bordes 3:1, axe sin reglas
desactivadas, foco con Tab y ausencia de desbordamiento a 375 y 1440 px.
Las capturas quedan en `test-results/` (ignorado). Los archivos TypeScript de estas
pruebas también se comprueban por separado; lint, tipos y builds de las dos apps
verifican la integración de los imports CSS.

Esta verificación corresponde al catálogo y sus parejas de tokens, no acredita
por sí sola todas las pantallas ni la persistencia de temas. La cobertura de
vistas reales se documenta en [regresión](theme-regression-testing.md) y la
[validación final de fase 26](VALIDATION-26.5.md).

### Resultado histórico de 19.1

30 de septiembre de 2026: siete pruebas del catálogo exitosas, auditoría axe y
contrastes correctos en las cuatro combinaciones. Revisión visual de las capturas
375/1440 px realizada: sin cortes ni desbordamiento; composición amplia de tienda
y compacta de administración distinguibles. Se corrigió la semántica ARIA de las
muestras de color, sin desactivar reglas de accesibilidad.

Lint y tipos de ambas apps correctos; builds de producción independientes exitosos,
comprobación TypeScript del nuevo config/spec/helper E2E exitosa, `git diff --check`
sin errores y validación OpenSpec estricta válida. No se modificaron datos ni API.

Archivos de la tarea: los dos `src/styles/design-tokens.css`, sus imports en los dos
`src/app/globals.css`, `docs/design-system.html`, este documento,
`e2e/design-tokens.config.ts`, `e2e/frontend/design-tokens.spec.ts`, `package.json`
(comando reproducible y conexión con la suite E2E) y checkbox 19.1 de `tasks.md`.
No se inició 19.2 ni se realizó commit o push.
