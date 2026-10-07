# Corrección de movimiento del hero

7 de octubre de 2026, posterior al cierre de 26.5.

## Causa y corrección

La sección completa del hero enviaba interacción al hook de movimiento.
Así, el cursor y foco sobre «Reanudar» mantenían la pausa aunque el botón
retirara la pausa explícita. Había además una amplitud de ±1.5% en 40 segundos
por sentido y el paneo esperaba la carga de ambas imágenes.

- La pausa del buscador se limita a su formulario. Se conserva la pausa por
  interacción directa con el showcase y por visibilidad/movimiento reducido.
- Reanudar limpia las pausas de puntero/foco del control actual; no mueve
  el foco ni exige sacar el cursor. Una interacción posterior puede pausar otra vez.
- La primera imagen cargada puede panear sin esperar el asset secundario;
  la alternancia sigue esperando ambas fotos cargadas.
- Paneo lineal continuo alternado de ±8%, escala 1.22 y 20 segundos por sentido.
  El recorte ampliado evita descubrir bordes vacíos; marco responsive intacto.
- Se mantienen alternancia cada 14 segundos, fundido, selección manual,
  fallback y estado estático con movimiento reducido, sin vídeo ni nuevas cargas.

## Verificación

141 pruebas unitarias en 23 archivos; lint y typecheck correctos. Siete
pruebas Chromium del hero aprobadas: ambos temas a 375/1440, movimiento
reducido, carga/fallo, búsqueda sin JS y pausa/reanudación. El caso de
autoplay ahora comprueba reanudación con el botón enfocado y trayectoria
CSS real: posiciones a 0/10/20/30/40 segundos con retorno y desplazamiento
superior a 100 px en escritorio. Build y OpenSpec estricto correctos.

No se regeneraron snapshots ni se modificó backoffice, API, datos o entorno.
No se verifica aquí Vercel ni se ejecuta commit/push automáticamente.

Archivos: `catalog-hero.tsx`, `hero-showcase.tsx`, `use-hero-motion.ts`,
`storefront-landing.css`, `hero-motion.spec.tsx`, `storefront-hero.spec.ts`,
README, AGENTS y este informe. Las evidencias 26.1–26.5 son históricas;
esta corrección no completa las tareas pendientes 25.3–25.4.
