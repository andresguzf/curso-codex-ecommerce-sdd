# Validación final editorial — tarea 21.8

Fecha: 1 de octubre de 2026. Cambio: `build-technology-ecommerce-platform`, esquema `spec-driven`.

## Alcance

Consolidación de la fase 21: selección administrativa de destacados y categorías importantes, seed editorial reproducible y composición pública completa. No se añaden funcionalidades ajenas al alcance aprobado. Al cerrar esta tarea quedan 145/145 tareas completadas; el cambio permanece activo, sin archivar.

La landing consume una sola respuesta REST: hasta tres destacados, nueve recientes sin repetir destacados y tres categorías importantes con hasta tres productos cada una. Las categorías pueden repetir productos de otras secciones. No hay filtros ni paginador en inicio; búsqueda, filtros y paginación pertenecen a `/products`.

## Matriz de cobertura

| Área | Evidencia | Verificación |
| --- | --- | --- |
| Persistencia editorial | `apps/api/test/database/catalog-inventory.persistence.integration.spec.ts` | Migraciones, valores por defecto, posiciones únicas, restricciones e índices |
| Administración REST | `apps/api/test/product-catalog/product-administration.integration.spec.ts` | ADMIN, auditoría, fecha de destaque, límite de tres categorías, intercambio de posiciones, concurrencia y rollback |
| Composición pública | `apps/api/test/product-catalog/catalog-landing.integration.spec.ts` | Límites, orden y desempates, deduplicación, omisión de inactivos, configuración parcial/vacía, lectura coherente y contrato OpenAPI |
| Autorización y ciclo completo | Misma integración de landing | Rechazo anónimo/CUSTOMER/BILLING sin escrituras; selección, reordenamiento, desactivación y retirada por ADMIN reflejadas en GET público, sin alterar inventario |
| Seed | `apps/api/test/database/development-seed.integration.spec.ts` | Tres destacados, quince activos adicionales, tres categorías ordenadas, composición reproducible, idempotencia, conservación de datos ajenos y rechazo de producción |
| Contratos | `packages/api-schemas/test/catalog-landing.spec.ts`, pruebas OpenAPI y cliente generado | Campos públicos estrictos, estados activos también en clasificaciones anidadas, límites y rechazo de duplicados dentro de cada sección |
| Componentes administrativos | `apps/backoffice/test/product-management.spec.tsx`, `classification-management.spec.tsx`, pruebas de clientes REST | Estrellas, formulario, selección, arrastre/teclado, retirada confirmada, configuración incompleta, error concurrente y consultas acotadas |
| Componentes públicos | `apps/storefront/test/catalog-landing.spec.tsx` | Orden, estados completo/parcial/vacío, repetición contextual, compra desde destacados y actualización al recuperar foco |
| Navegador | `e2e/frontend/backoffice-catalog.spec.ts`, `storefront-catalog.spec.ts` | Controles por rol, selección y retirada, composición pública en claro/oscuro a 375/1440 px, navegación al catálogo y recuperación segura de una respuesta inválida |
| Regresión | Suites de frontend, facturación, tokens y temas | Compatibilidad con compra, galería, autocompletes, identidad visual y cuatro combinaciones de tema |

## Adiciones de esta tarea

1. Dos integraciones con NestJS y PostgreSQL reales verifican permisos y el ciclo de cambios editoriales desde PATCH administrativo hasta GET público. Comparan la persistencia tras rechazos y los balances antes/después; una cuarta categoría responde 409 sin modificar la composición.
2. Una prueba Zod rechaza clasificaciones anidadas inactivas y duplicados de destacados, categorías o productos dentro de una categoría. La repetición entre contextos distintos sigue permitida.
3. Una prueba de componente retira destacados/categorías de la respuesta al recuperar foco y verifica que desaparezcan sus secciones sin perder los recientes autorizados por el API.
4. Una prueba de navegador entrega una respuesta pública inválida, verifica un error seguro sin mostrar el producto inactivo y recupera la composición completa mediante reintento.
5. README y AGENTS.md reflejan la implementación completa, los filtros administrativos, el seed y las restricciones operativas; se conservan arquitectura, invariantes y skills existentes.

## Resultados

- `pnpm test`: aprobado. API 310, storefront 122, backoffice 126, api-schemas 47, api-client 14, UI 38 y reglas de arquitectura dos pruebas. Turborepo reutiliza resultados no afectados.
- `pnpm typecheck`, `pnpm lint`, `pnpm build`: aprobados.
- `pnpm contract:check`: una prueba del cliente generado y 17 de contrato API aprobadas; ya están incluidas en los conteos anteriores.
- `pnpm openapi:check`: contrato y cliente generado coherentes, 48 paths existentes; no se añade un endpoint en 21.8.
- `pnpm --filter @technology-ecommerce/api test:e2e`: 14 pruebas aprobadas, ya incluidas en las 310 del API.
- `pnpm test:e2e:frontends --workers=2`: 88 pruebas aprobadas, incluidas ocho de regresión visual.
- `pnpm test:e2e:invoices`: tres pruebas con navegador, API y PostgreSQL reales aprobadas.
- `pnpm test:e2e:design-tokens`: siete pruebas aprobadas.
- `pnpm test:e2e:themes`: ocho pruebas aprobadas nuevamente, sin actualizar referencias visuales.
- `openspec validate build-technology-ecommerce-platform --strict` y `git diff --check`: aprobados antes del cierre del checklist y repetidos al finalizar.

La primera ejecución general encontró un fallo 500 en la prueba existente de logout. Sus 13 pruebas de autenticación pasaron al repetirlas de forma aislada y la siguiente ejecución general completa pasó. No se atribuye una causa sin evidencia ni se modifica autenticación para ocultar el fallo; se registra este resultado para futuras revisiones de estabilidad.

## Límites y seguridad

Las integraciones crean y eliminan bases temporales aisladas; no ejecutan el seed contra la base local de la tienda. La integración editorial usa el servidor NestJS por inyección HTTP y sesiones de prueba válidas, no el navegador ni el flujo de contraseña. El seed tiene pruebas separadas de login real.

La suite general Playwright controla respuestas REST; no representa una única prueba navegador administrativo → base real → storefront. Las pruebas de facturación sí usan navegador, API y PostgreSQL reales. No se añaden solicitudes externas de imágenes: la evidencia histórica del manifiesto Picsum no garantiza disponibilidad futura ni fidelidad fotográfica. Producción necesita assets propios/aprobados y no hotlinks demo.

Se conservan referencias visuales Chromium/macOS existentes; no se actualizan snapshots en 21.8. Axe, teclado y tamaños responsive automatizados no sustituyen una auditoría manual completa, lectores de pantalla ni dispositivos físicos. Las pruebas aprobadas tampoco convierten pagos/envíos simulados en integraciones productivas.

## Archivos modificados en 21.8

- `apps/api/test/product-catalog/catalog-landing.integration.spec.ts`: autorización y ciclo REST editorial.
- `packages/api-schemas/test/catalog-landing.spec.ts`: estados anidados y duplicados.
- `apps/storefront/test/catalog-landing.spec.tsx`: retirada editorial tras recuperar foco.
- `e2e/frontend/storefront-catalog.spec.ts`: respuesta inválida y recuperación.
- `README.md` y `AGENTS.md`: documentación alineada con el estado final.
- `e2e/VALIDATION-21.8.md`: consolidación y límites de la evidencia.
- `openspec/changes/build-technology-ecommerce-platform/tasks.md`: cierre de 21.8.

Los cambios anteriores de 21.4–21.7 presentes en el árbol de trabajo se preservan y se verifican, pero no se atribuyen a esta tarea. No se inicia otra tarea, no se archiva el cambio y no se realiza commit/push.
