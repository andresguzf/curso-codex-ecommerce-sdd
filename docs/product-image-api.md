# Administración REST de imágenes (20.2)

Solo `ADMIN` puede realizar estas operaciones; visitantes reciben 401 y `CUSTOMER`/`BILLING`, 403. El API comprueba que la imagen pertenezca al producto y excluye productos eliminados. Swagger interactivo: `/api/v1/docs`.

- `POST /api/v1/products/:productId/images?altText=Teclado&isPrimary=false&sortOrder=1`: cuerpo binario PNG, JPEG o WebP y su `Content-Type`. `altText` es obligatorio (1–500 caracteres después de trim); los otros parámetros son opcionales. La posición es base cero y admite inserción entre imágenes existentes. Por defecto se agrega al final y se convierte en portada si no existe otra. Respuesta 201 con identificador, referencia, texto alternativo, portada, orden, dimensiones verificadas, MIME y fechas.
- `PATCH /api/v1/products/:productId/images/:imageId`: JSON con uno o varios de `altText`, `isPrimary` y `sortOrder`. Elegir portada desmarca la anterior en la misma transacción. Mover una imagen desplaza las demás y normaliza sus posiciones. No acepta URLs, claves de almacenamiento ni metadatos físicos arbitrarios. Respuesta 200 con la imagen actualizada.
- `DELETE /api/v1/products/:productId/images/:imageId`: elimina la referencia y normaliza la colección; responde 204. Para retirar una portada de un producto activo, primero debe seleccionarse otra. La retirada o desmarcado directo se rechaza con 409 `PRODUCT_PRIMARY_IMAGE_REQUIRED`; una imagen ajena/inexistente responde 404 `PRODUCT_IMAGE_NOT_FOUND`.

Las mutaciones bloquean primero el producto y conservan las restricciones PostgreSQL y auditoría atómica con colección anterior/posterior. Las posiciones temporales evitan violar los índices únicos durante reordenamientos. Solicitudes concurrentes se serializan sin permitir dos portadas. El stock y los snapshots históricos no se modifican.

## Almacenamiento y fallos

El adaptador existente comprueba firma, MIME y límite configurado de bytes; una carga excesiva responde 413. Sharp verifica que el archivo pueda interpretarse y obtiene dimensiones; no se confía en datos enviados por el cliente. Una persistencia fallida intenta retirar el archivo recién cargado mediante `deleteIfUnreferenced`, sin ocultar el error original.

Después de confirmar una eliminación se intenta borrar el archivo gestionado únicamente si ya no está referenciado. Las referencias heredadas a Picsum/CDN o placeholders no se eliminan físicamente. Si falla el almacenamiento, se conserva un archivo huérfano antes que revertir/fingir el fallo de una mutación ya confirmada. El evento `product.image.cleanup_pending` identifica la clave; las eliminaciones confirmadas también la conservan en auditoría. La limpieza operativa debe comprobar nuevamente referencias mediante el servicio antes de borrar. No se incorpora un worker de reintentos automático en esta tarea.

## Contratos y verificación

OpenAPI y el cliente TypeScript generado incluyen las tres operaciones. `packages/api-schemas` expone `productGalleryImageSchema` y `updateProductImageRequestSchema`. Los listados/detalles existentes siguen devolviendo su contrato `image`; `coverImage`/`images` públicos corresponden a 20.6. No se implementa UI de galería ni seed adicional aquí.

Pruebas HTTP/PostgreSQL: permisos de los tres roles, carga/lectura, dimensiones, contrato de respuesta, edición, orden, cambio concurrente de portada, eliminación y limpieza, validaciones, cuerpos excesivos, IDs ajenos y fallos simulados de persistencia/almacenamiento. Pruebas Zod: respuestas y solicitudes válidas/negativas.

Verificado el 1 de octubre de 2026: 244 pruebas del backend (36 archivos), 40 pruebas de esquemas (12 archivos), typecheck del monorepo, lint del API/esquemas, generación y comprobación OpenAPI, y comprobación de contratos (cliente y API). La evidencia cubre exclusivamente backend/contratos de 20.2; no acredita las futuras imágenes seed, landing ni galería visual.
