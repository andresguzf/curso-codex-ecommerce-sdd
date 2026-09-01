# PostgreSQL local

La base local usa PostgreSQL 18.6 y conserva sus datos en el volumen Docker
nombrado `ecommerce_postgres_data`. El volumen es externo al ciclo de vida del
contenedor: recrear `postgres` no elimina la información.

## Preparación

```bash
docker volume create ecommerce_postgres_data
cp infra/docker/.env.example infra/docker/.env
```

Define una contraseña local en `infra/docker/.env`; este archivo está excluido
de Git. Configura la misma conexión en `apps/api/.env` a partir de
`apps/api/.env.example`.

## Uso

```bash
docker compose --env-file infra/docker/.env -f infra/docker/compose.yaml up -d
docker compose --env-file infra/docker/.env -f infra/docker/compose.yaml ps
docker compose --env-file infra/docker/.env -f infra/docker/compose.yaml restart postgres
docker compose --env-file infra/docker/.env -f infra/docker/compose.yaml down
```

`down` elimina el contenedor y la red del proyecto, pero no el volumen externo.
No uses `docker volume rm ecommerce_postgres_data` salvo que quieras eliminar
deliberadamente todos los datos locales.
