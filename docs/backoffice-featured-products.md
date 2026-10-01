# Productos destacados — tarea 21.4

El administrador puede destacar o retirar el destaque desde el botón de estrella del listado de `/products` y desde «Destacar producto» en el formulario de edición. El listado muestra «Destacado» o «No destacado», con los colores semánticos existentes del backoffice claro y oscuro.

## Comportamiento

- La creación conserva su contrato actual: primero se crea el producto y después se administra su destaque desde el listado o la edición. No se amplía `POST /products` ni se añade otra ruta.
- La acción del listado envía únicamente `PATCH /api/v1/products/:productId` con `isFeatured`. El formulario incluye este campo únicamente si cambió frente al producto abierto.
- Nunca se envía `featuredAt`. La API implementada en 21.2 asigna la fecha al pasar de no destacado a destacado, conserva la fecha al editar otros campos y la limpia al retirar el destaque.
- No se puede destacar un producto inactivo. Si un producto previamente destacado se desactivó, sí puede retirarse su destaque. Las reglas de stock y clasificación no cambian.
- Las solicitudes pendientes bloquean los botones de destaque. Los resultados producen mensajes flash; los errores no cambian anticipadamente el estado del listado ni exponen detalles internos.
- Los permisos REST continúan siendo exclusivos de `ADMIN`; `BILLING` y `CUSTOMER` no obtienen administración editorial.

## Actualización de caché

Las mutaciones de edición y destaque invalidan los productos administrativos y la clave `['catalog', 'public', 'landing']` del cliente de consultas actual.

Storefront y backoffice son aplicaciones independientes, incluso en puertos distintos durante desarrollo. Invalidar un cliente de consultas no comunica cambios automáticamente al otro. Por eso la consulta pública de landing revalida al montarse y al recuperar el foco, sin depender de una preferencia en localStorage, mensajes entre orígenes ni datos privados persistidos. No se incorpora sincronización en tiempo real entre aplicaciones.

La composición completa ya existe en REST (21.3), pero su presentación pública de destacados y categorías pertenece a 21.7; esta tarea no implementa esas secciones.

## Archivos de esta tarea

- `apps/backoffice/src/features/products/product-management.tsx`: acción de estrella, estado visible, mutación, feedback e invalidación.
- `apps/backoffice/src/features/products/product-form.tsx`: selección editorial en edición y separación de los datos comerciales y editoriales al validar.
- `apps/backoffice/src/features/products/product-api.ts`: mensaje seguro para productos inactivos.
- `packages/ui/src/icon-button.tsx`: icono de estrella compartido.
- `apps/storefront/src/features/catalog/catalog-landing.tsx`: revalidación de la composición al regresar a la tienda.
- `apps/backoffice/test/product-management.spec.tsx`: mutaciones, estado, errores, inactivos, envíos duplicados y ausencia de fechas en las peticiones.
- `apps/storefront/test/catalog-landing.spec.tsx`: revalidación tras recuperar el foco.
- `e2e/frontend/backoffice-catalog.spec.ts`: interacción por teclado, formulario, restricción de Billing, temas claro/oscuro y tamaños 375/1440 px.
- `e2e/frontend/catalog-api-fixture.ts`: respuestas editoriales administrativas y registro de peticiones para las pruebas del navegador.
- `e2e/frontend/theme-regression.spec.ts-snapshots/backoffice-{light,dark}-{375,1440}-content-backoffice-darwin.png`: cuatro referencias de contenido revisadas visualmente por el nuevo estado y acción; referencias de dashboard y storefront conservadas.
- `openspec/changes/build-technology-ecommerce-platform/tasks.md`: cierre de 21.4, sin iniciar 21.5.
- Este documento: comportamiento, límites, archivos y evidencia.

## Verificación — 1 de octubre de 2026

- `pnpm test`: suites del monorepo aprobadas; backoffice 121 pruebas y storefront 118, incluidas las cuatro pruebas nuevas de esta tarea. Turbo reutilizó resultados de paquetes sin cambios.
- `pnpm typecheck`, `pnpm lint` y `pnpm build`: aprobados.
- `pnpm contract:check`: cliente generado actualizado, una prueba de generación y 17 pruebas de contrato de la API aprobadas; no cambió OpenAPI.
- `pnpm test:e2e:frontends --workers=2`: 75 pruebas aprobadas, cinco nuevas; incluye operaciones editoriales por teclado y comprobaciones automatizadas de foco, contraste/accesibilidad y ausencia de desbordamiento de página en el formulario.
- `pnpm test:e2e:design-tokens`: siete pruebas aprobadas para los cuatro temas y el catálogo de diseño.
- Validación OpenSpec estricta y `git diff --check`: aprobados; 21.4 completada, progreso 141/145 y 21.5 pendiente.
- Las cuatro referencias de contenido del backoffice se actualizaron únicamente tras revisar las diferencias previstas. La suite completa posterior pasó sin actualizar referencias. También se inspeccionaron capturas del formulario y del listado en escritorio claro y móvil oscuro. La tabla mantiene su desplazamiento horizontal interno en móvil.
- No se ejecutó un seed ni se modificaron datos reales para estas pruebas: las pruebas de navegador interceptan REST mediante fixtures. La evidencia automatizada no sustituye una auditoría manual completa de accesibilidad.
