# Usuarios demo de desarrollo y pruebas — 20.5

El seed explícito garantiza cuentas `ADMIN` y `CUSTOMER` y conserva también `BILLING`, requerido por el seed inicial de 2.6. No cambia el registro público: sigue creando exclusivamente `CUSTOMER`. No se ejecuta automáticamente al iniciar el API ni en despliegues.

## Configuración local

Configura un `.env` privado de `apps/api` a partir de `.env.example`, sin versionarlo. Se requieren:

- `NODE_ENV=development` o `NODE_ENV=test`, explícito: ya no se asume desarrollo si falta.
- `DATABASE_URL` de una base **no productiva**.
- `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`.
- `SEED_CUSTOMER_EMAIL` / `SEED_CUSTOMER_PASSWORD`.
- `SEED_BILLING_EMAIL` / `SEED_BILLING_PASSWORD`, por compatibilidad con el plan inicial.

Usa emails diferentes y contraseñas locales de 12–128 caracteres; nunca reutilices contraseñas de producción ni publiques los valores. Los emails se normalizan quitando espacios y convirtiendo a minúsculas. No hay contraseñas predeterminadas en el ejecutable. Los nombres del CLI están marcados `DEMO`.

```sh
pnpm --filter @technology-ecommerce/api db:migrate
NODE_ENV=development pnpm --filter @technology-ecommerce/api db:seed
```

El comando también sincroniza el [catálogo demo](development-catalog-seed.md). Ejecutarlo modifica únicamente la base configurada; confirma el destino antes de hacerlo. El guard usa el entorno declarado: no puede detectar una base productiva si se la configura erróneamente como desarrollo.

## Persistencia y seguridad

- Una cuenta por email normalizado y una asignación por usuario; las reejecuciones conservan los IDs, sin duplicar usuarios ni roles.
- Las cuentas demo se crean o actualizan como activas con el rol configurado. Por eso sus emails deben reservarse para demostración; no uses emails de cuentas reales.
- Se usa el mismo hash **Argon2id** y política que el login del API. Solo el hash se guarda en PostgreSQL. Un hash vigente válido se conserva; cambiar la contraseña en la configuración reemplaza el hash, y hashes heredados se actualizan a la política actual.
- La configuración se valida antes de conectar o escribir. Producción, entornos desconocidos, entorno ausente, emails inválidos/duplicados, roles repetidos y contraseñas inválidas se rechazan.
- Todo sigue dentro de la transacción del seed: errores revierten usuarios, roles y catálogo.
- Los logs de éxito contienen solo evento, nivel y contadores permitidos. Los de fallo contienen evento, nivel y tipo de error, nunca mensajes, stack traces, variables de entorno, URLs de conexión, passwords, hashes o tokens. El CLI devuelve código de salida 1 ante fallo.

## Verificación realizada

```sh
pnpm --filter @technology-ecommerce/api exec vitest run test/database/seed-config.spec.ts test/database/development-seed.integration.spec.ts
```

Las pruebas configuran una base PostgreSQL aislada, la migran y la eliminan al finalizar. Verifican hashes, IDs estables, actualización de contraseña, login REST de `ADMIN` y `CUSTOMER` antes y después de una segunda ejecución, rechazo de contraseña incorrecta, `/auth/me`, cookie HttpOnly y autorización administrativa/propia. También verifican bloqueo de producción sin modificar cuentas y logs sin credenciales tanto en éxito como en validación/fallo de persistencia.

Estas pruebas no pueblan ni cambian usuarios de la base local de la tienda. Esta tarea no extiende los contratos de imágenes de 20.6.
