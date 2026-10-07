# Hero continuo y tercera escena — 26.6

7 de octubre de 2026. Revisión e implementación confirmadas por el usuario.

## Cambios

El showcase no registra eventos de hover para pausar: el cursor sobre la imagen
no detiene paneo ni alternancia. Seleccionar una foto limpia pausa manual y del
foco del control sin desenfocarlo. La foto inicia su paneo sin pulsar reanudar;
la preferencia de movimiento reducido, página oculta y búsqueda siguen
prevaleciendo. La pausa manual funciona hasta reanudar o seleccionar otra foto.
Esto sustituye las reglas históricas de hover/selección en 26.2 y en el primer
informe `VALIDATION-hero-motion-fix.md`, no cambia ProductGallery.

Tres escenas locales: teclado RGB, gráfica NVIDIA y audífonos inalámbricos
premium sobre soporte, en escritorio oscuro con luces azul/violeta, sin personas.
El nuevo asset fue generado con la herramienta integrada imagegen y copiado a
`apps/storefront/public/images/hero-premium-headphones-v1.png`, no a Cloudinary.
Se inspeccionó la imagen generada: sujeto, iluminación, ancho y márgenes para
recorte conservan la estética de las otras dos fotos.

Primera imagen prioritaria; las otras dos diferidas. El paneo no espera la
carga secundaria; la alternancia espera las tres fotos. Se conservan marco
responsive, pan ±8%/20 segundos por sentido, pausa/reanudar y fallback.

## Verificación

- Storefront: 141 pruebas unitarias en 23 archivos, lint y typecheck correctos.
- Siete pruebas Playwright del hero, con fixtures REST aisladas: claro/oscuro
  a 375/1440, tres assets cargados y carga lazy, selección del tercero sin
  movimiento bajo preferencia reducida, hover sin pausa, seleccionar después
  de pausa manual, selección por teclado manteniendo foco, trayectoria CSS
  de ida/vuelta, fallos de assets y respaldo/búsqueda sin JavaScript.
- Build de producción correcto, OpenSpec estricto válido y diff sin errores.
- Tienda local restaurada después del build; API local permanece activa.

No se regeneraron referencias visuales, alteraron contratos REST, datos,
credenciales, proveedores ni backoffice. No se hicieron cargas Cloudinary,
seed, despliegue, commit/push o archivo. Estas pruebas no certifican Vercel
ni rendimiento real del CDN.

## Archivos

- `use-hero-motion.ts`, `hero-showcase.tsx`, `hero-motion.spec.tsx`,
  `storefront-hero.spec.ts` y el nuevo PNG: interacción y cobertura.
- Proposal, design, spec de product-catalog y tasks: revisión 26.6 y evidencia.
- README, AGENTS y este informe: comportamiento y progreso actualizados.
- Se conservan los cambios anteriores aún locales: `catalog-hero.tsx`,
  `storefront-landing.css` y `VALIDATION-hero-motion-fix.md`.

Estado: 172/174 tareas completadas. Solo quedan pendientes 25.3–25.4.

## Prompt final del asset (herramienta integrada, no CLI)

Use case: product-mockup. Generate ONE ultra-wide panoramic photographic website hero, 21:9 aspect ratio, approximately 1920x824. Hyperrealistic luxury technology product photography: premium over-ear wireless headphones in matte charcoal aluminium, suspended naturally on a sculptural understated desk stand, on a dark elegant desk. No people, no hands. Restrained cyan-blue and violet RGB rim lighting emphasizes the earcups and brushed metal, with tiny warm practical light glints and realistic soft reflections. Minimalist modern dark studio interior, sophisticated editorial lighting, rich material texture, physically believable product, very sharp subject, cinematic tasteful depth of field. The product fits comfortably in the central 65% so a slow horizontal pan and 22% zoom crop do not cut important details. Atmospheric dark charcoal background across the whole wide landscape. Harmonize with existing hero photographs of a RGB mechanical keyboard and NVIDIA graphics card: cool blue-violet accents, refined commercial tech aesthetic. No words, no lettering, no logo, no watermarks, no UI. Deliver only the panoramic image.
