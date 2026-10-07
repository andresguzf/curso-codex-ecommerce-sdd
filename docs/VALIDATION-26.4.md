# Validación 26.4 — compra y área del cliente

Fecha: 2026-10-07. Cambio: `build-technology-ecommerce-platform`.

## Entrega

Únicamente 26.4, con openspec-apply-change, react-rules y frontend-design.
Se extiende la dirección aprobada blanco/lavanda y carbón/violeta a login,
registro, carrito, checkout, confirmación, cuenta, wishlist y documentos del
cliente. La guía de diseño favoreció superficies quietas, tipografía coherente y
jerarquía de compra, eliminando decoraciones que competían con los formularios.

Login/registro comparten una composición responsive con introducción y formulario,
sin franja oscura en claro, degradados radiales, marca alternativa ni ubicación
ficticia. El texto recuerda que el carrito es público. No cambian handlers,
validaciones, asignación de CUSTOMER, claim del carrito o recuperación de sesión.

Carrito y checkout presentan resúmenes suaves en vez de paneles permanentemente
oscuros. Los resúmenes se fijan debajo del header en escritorio; los controles de
cantidad tienen 44 px. Formularios y opciones seleccionadas usan tokens, bordes
visibles y foco. No se modifica cálculo monetario, stock, pago, envío ni
idempotencia; no se añaden animaciones o esperas a estados de operación.

Cuenta ofrece tres accesos con descripciones: compras, facturas y deseos. Listas,
tarjetas, detalles y confirmación mantienen superficies/bordes/jerarquía coherentes
en ambos temas. Los detalles conservan información histórica, estados y botón de
PDF. Se añaden h1 en carga/error de checkout y documentos y en recuperación de
cuenta, sin cambiar consultas o permisos.

Un stylesheet exclusivo de storefront adapta también flash y modal portallado,
con foco y botones de al menos 44 px. No se editan primitivas compartidas ni las
pantallas ADMIN/BILLING. Bootstrap, preferencias independientes y sesiones siguen
intactos. README/AGENTS y cierre integral de fase corresponden a 26.5.

## Verificación

- `pnpm --filter @technology-ecommerce/storefront test`: 140 pruebas, 23 archivos.
- Storefront lint, typecheck y build optimizado aprobados.
- `pnpm test:e2e:frontends --workers=2`: 141 pruebas aprobadas.
- `pnpm test:e2e:themes`: ocho pruebas aprobadas en pasada independiente.
- `pnpm test:e2e:design-tokens`: siete pruebas aprobadas.
- OpenSpec estricto y `git diff --check` aprobados.

Doce escenarios nuevos recorren ambos temas a 375/1440 px:

- Cuenta, wishlist, historial/detalle de órdenes y facturas: axe con contraste,
  ausencia de overflow, datos históricos y ausencia de acciones administrativas.
- Carrito: cantidades/totales actualizados, flash, cancelación del modal con
  Escape y restauración de foco visible.
- Login/registro: conservación de correo, contraseña y nombre al alternar tema.
- Checkout: dirección y método de envío conservados; total actualizado; rechazo
  con datos conservados, pending con controles bloqueados y confirmación aprobada.
  Las solicitudes conservan claves UUID de idempotencia.
- Listas de compras/facturas/deseos: pendiente, vacío y error; detalles con error.

Las pruebas unitarias existentes mantienen cobertura de autorización, sesión,
carrito público, cantidades, conflictos de stock, reintento idempotente, privacidad
y descarga de documentos. El helper unitario de checkout ahora espera al campo
Dirección, no al h1, porque el encabezado también existe durante la carga.

Se revisaron capturas de autenticación, cuenta, carrito/modal, checkout y factura
en claro/oscuro y móvil/escritorio. No se actualizan snapshots en esta tarea:
las referencias existentes de catálogo/detalle y todas las administrativas pasan.

Fixtures REST de navegador aisladas; no se accede al API de desarrollo, Supabase
o Cloudinary ni se escribe en datos reales. Las pruebas/capturas no constituyen
certificación productiva, auditoría manual completa de accesibilidad ni medición
de rendimiento. Persisten avisos de desarrollo no bloqueantes de placeholder LCP
y NO_COLOR/FORCE_COLOR. Al interrumpir una primera ejecución se reiniciaron solo
los servidores de pruebas creados por el agente; las pasadas finales completaron.

## Archivos modificados en esta tarea

- `apps/storefront/src/features/auth/auth-shell.tsx`: composición login/registro.
- `apps/storefront/src/app/account/page.tsx`: presentación y accesos de cuenta.
- `apps/storefront/src/features/cart/cart-page.tsx`: scope del sistema visual.
- `apps/storefront/src/features/cart/cart-summary.tsx`: resumen temático sin decoración.
- `apps/storefront/src/features/cart/cart-line.tsx`: controles de cantidad de 44 px.
- `apps/storefront/src/features/checkout/checkout-access-gate.tsx`: scope y h1 pendiente.
- `apps/storefront/src/features/checkout/checkout-form.tsx`: resumen y carga/error accesibles.
- `apps/storefront/src/features/checkout/checkout-receipt.tsx`: encabezado de carga.
- `apps/storefront/src/features/orders/orders-access-gate.tsx`: scope de compras.
- `apps/storefront/src/features/orders/order-detail.tsx`: encabezados en carga/error.
- `apps/storefront/src/features/invoices/invoices-access-gate.tsx`: scope de facturas.
- `apps/storefront/src/features/invoices/invoice-detail.tsx`: encabezados en carga/error.
- `apps/storefront/src/features/wishlist/wishlist-page.tsx`: scope de deseos.
- `apps/storefront/src/features/wishlist/wishlist-card.tsx`: retirar sombra heredada.
- `apps/storefront/src/styles/storefront-customer.css`: superficies, formularios,
  resúmenes, foco, flash y modal, exclusivamente públicos.
- `apps/storefront/src/app/globals.css`: importar esos estilos tras la base temática.
- `apps/storefront/test/checkout-form.spec.tsx`: espera al formulario disponible.
- `e2e/frontend/customer-api-fixture.ts`: fixtures aisladas de cliente y checkout.
- `e2e/frontend/storefront-customer.spec.ts`: doce escenarios y capturas.
- `e2e/playwright.config.ts`: incluir la suite customer.
- `openspec/changes/build-technology-ecommerce-platform/tasks.md` y `proposal.md`:
  estado actualizado y referencia a evidencia.
- `docs/VALIDATION-26.4.md`: este informe.

Cambios anteriores de planificación y 26.1–26.3 preservados. Sin cambios en API,
contratos, backoffice, paquetes compartidos, .env, datos o PDFs; sin seed, cargas,
despliegue, commit/push ni archivo.

Estado: 170/173 tareas completadas. Pendientes 25.3, 25.4 y 26.5.
Detenerse antes de 26.5 y esperar confirmación.
