# syntax=docker/dockerfile:1.7

ARG NODE_BASE_IMAGE=node:22.21.1-alpine3.22@sha256:b2358485e3e33bc3a33114d2b1bdb18cdbe4df01bd2b257198eb51beb1f026c5

FROM ${NODE_BASE_IMAGE} AS build

ENV PNPM_HOME=/pnpm
ENV PATH=${PNPM_HOME}:${PATH}

WORKDIR /workspace

RUN corepack enable && corepack prepare pnpm@10.33.4 --activate

COPY . .

RUN pnpm install --frozen-lockfile \
  && pnpm --filter @technology-ecommerce/api build \
  && pnpm --filter @technology-ecommerce/api deploy --prod --legacy /runtime/api

FROM ${NODE_BASE_IMAGE} AS runtime

ENV HOST=0.0.0.0
ENV IMAGE_STORAGE_LOCAL_ROOT=/app/.local-storage/images
ENV DATABASE_MIGRATIONS_PATH=/app/src/database/migrations
ENV NODE_ENV=production
ENV PORT=3001

WORKDIR /app

COPY --from=build --chown=node:node /runtime/api ./

RUN chmod 755 /app/docker-entrypoint.sh \
  && mkdir -p /app/.local-storage/images \
  && chown -R node:node /app/.local-storage

USER node

EXPOSE 3001

HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=6 \
  CMD ["node", "-e", "const port = process.env.PORT || '3001'; fetch('http://127.0.0.1:' + port + '/api/v1/health').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1))"]

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
