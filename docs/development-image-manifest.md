# Manifiesto temporal de imágenes (20.3)

`apps/api/src/database/seed/product-image-manifest.ts` prepara **60 asociaciones de imagen para 20 SKU**, una portada y dos imágenes adicionales en posiciones 0, 1 y 2. El manifiesto por sí solo no escribe en PostgreSQL. Desde 20.4, el seed explícito consume estas referencias: consulta [ejecución e idempotencia del catálogo](development-catalog-seed.md).

Los veinte productos se agrupan en portátiles, monitores, teclados y teléfonos. Se conservan los SKU originales `DEV-LAPTOP-001`, `DEV-MONITOR-001` y `DEV-KEYBOARD-001` para permitir una migración idempotente sin duplicarlos. Nombre y tipo son referencias de asociación; precios, categorías, etiquetas y stock inicial se definen en `catalog-seed.ts` desde 20.4.

## Selección visual y limitaciones

Se revisó la [galería oficial de Picsum](https://picsum.photos/images) el 1 de octubre de 2026. Se eligieron **12 fotografías diferentes reutilizadas entre productos**, no sesenta fotografías únicas. Cada producto usa tres IDs diferentes y cada asociación tiene una clave de almacenamiento y un futuro `public_id` de Cloudinary propios.

| IDs revisados | Contenido observado | Asociación |
| --- | --- | --- |
| 0, 1, 2, 5, 6, 8, 9, 48 | Portátiles abiertos, vistas de uso, teclados integrados y vista posterior | Portátiles; escenas complementarias de pantallas/teclados |
| 3 | Teléfono sostenido frente a un portátil | Teléfonos |
| 26 | Teléfono, auriculares y accesorios sobre fondo gris | Teléfonos |
| 42 | Teléfono sobre una mesa de cafetería | Teléfonos |
| 60 | Escritorio con monitor, teclado externo, mouse y tabletas | Portadas de monitores y teclados |

Picsum ofrece placeholders, no un catálogo semántico de productos. Estas fotografías son **ilustraciones temporales del tipo o contexto de uso**, no fotos del modelo anunciado. Por ejemplo, las imágenes adicionales de monitores ilustran pantallas de portátiles y las de teclados combinan un teclado externo con teclados integrados; no acreditan tamaño, distribución mecánica, conectividad ni especificaciones del producto. Las portadas de monitores y teclados muestran esos dispositivos externos. El texto alternativo describe lo realmente observado, identifica el producto asociado y declara “Ilustración temporal”; nunca inventa marcas, características o ángulos del modelo.

No se seleccionaron paisajes ni se usaron URLs aleatorias. Una clave SKU/posición no debe reasignarse a otro producto. Los datos de revisión incluyen fecha, descripción y página de la galería fuente.

## Referencias y fallbacks

- URL fija: `https://picsum.photos/id/{id}/1200/900.webp`, siguiendo la [documentación de IDs y WebP](https://picsum.photos/).
- Dimensiones de entrega: 1200 × 900, formato WebP y MIME `image/webp`. No son las dimensiones del original del proveedor.
- Clave temporal estable: `development/products/{sku}/cover.webp` o `gallery-1.webp`/`gallery-2.webp`.
- Futuro `public_id`: `technology-ecommerce/products/{sku}/cover` o `gallery-1`/`gallery-2`, sin extensión.
- Fallback local: `/images/product-placeholder.svg`, ya existente en el storefront, con texto “Imagen no disponible de {producto}”. No depende de Picsum ni debe tratarse como una foto real. La presentación de nuevas galerías y su fallback se verificará en 20.6/20.9; este manifiesto no modifica componentes ni crea assets de fallback en backoffice.

## Uso exclusivamente no productivo

La única función pública de lectura exige explícitamente `development` o `test`; rechaza `production`, `staging`, valores desconocidos o ausentes antes de devolver imágenes. El verificador usa el mismo guard antes de acceder a la red. No se importa desde módulos REST, frontends ni arranque del API. El seed explícito conserva su propio bloqueo de producción y valida el entorno del manifiesto antes de conectarse a PostgreSQL.

Pruebas deterministas sin red:

```sh
pnpm --filter @technology-ecommerce/api exec vitest run test/database/product-image-manifest.spec.ts
```

Verificación externa explícita, sin guardar fotografías en disco ni consultar PostgreSQL:

```sh
NODE_ENV=development pnpm --filter @technology-ecommerce/api seed:images:check
```

Comprueba las 12 URLs diferentes y los endpoints oficiales `info`: ID, respuesta satisfactoria, MIME, formato y dimensiones efectivas. CI no depende de la disponibilidad de Picsum; ejecutar este comando al renovar las referencias. La disponibilidad verificada hoy no garantiza la del proveedor en el futuro.

## Sustitución antes de producción

1. Preparar fotografías propias o aprobadas del modelo real y revisar sus permisos de uso; no asumir que revisar una foto de Picsum autoriza su uso comercial.
2. Cargar mediante el futuro adaptador Cloudinary con el `cloudinaryPublicId` estable de cada asociación. Consultar primero la clave para evitar duplicar assets al reejecutar; las credenciales viven solo en configuración privada.
3. Registrar la clave/URL gestionadas y metadatos reales devueltos por el adaptador. No fabricar URLs Cloudinary ni copiar el hotlink como asset productivo.
4. Conservar SKU, posición y condición de portada; mantener el texto alternativo si continúa describiendo la nueva imagen y corregirlo cuando cambie su contenido visual. Revisar cada sustitución.
5. Verificar una portada por producto activo, tres imágenes ordenadas, carga/fallback accesibles y ausencia de referencias `picsum.photos`/`development/` en los datos que se publiquen.

Este procedimiento documenta la transición; no instala Cloudinary ni ejecuta cargas o migraciones de assets en 20.3. El adaptador para nuevas cargas se implementó posteriormente en fase 23 ([guía operativa](catalog-cloudinary-storage.md)), sin ejecutar esta migración del manifiesto. El reemplazo de Picsum antes de producción permanece como preparación separada y autorizada; no reutilizar las claves previstas como si ya fueran identidades gestionadas por el adaptador actual.

## Evidencia histórica de 20.3 (1 de octubre de 2026)

- Revisión visual de los 12 IDs elegidos en las páginas 1–3 de la galería oficial.
- Verificación externa exitosa: 20 productos, 60 asociaciones y 12 fotografías distintas; todas las URLs entregaron `image/webp`, formato WebP y dimensiones 1200 × 900.
- Ejecución del verificador con `NODE_ENV=production` rechazada con salida 1 antes de iniciar verificaciones externas.
- Diez pruebas deterministas nuevas: conteos, portada/orden, claves únicas, asociación, descripciones, metadatos, fallback local, inmutabilidad y seis casos de entorno rechazado.
- Suite completa del API: 254 pruebas exitosas en 37 archivos; typecheck, lint y build exitosos. OpenSpec válido en modo estricto.
- Sin cambios en la base local ni en las aplicaciones frontend; 20.4 y las tareas posteriores siguen pendientes.
