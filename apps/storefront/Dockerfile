# syntax=docker/dockerfile:1.7

ARG NODE_BASE_IMAGE=node:22.21.1-alpine3.22@sha256:b2358485e3e33bc3a33114d2b1bdb18cdbe4df01bd2b257198eb51beb1f026c5

FROM ${NODE_BASE_IMAGE} AS build

ENV PNPM_HOME=/pnpm
ENV PATH=${PNPM_HOME}:${PATH}

WORKDIR /workspace

RUN corepack enable && corepack prepare pnpm@10.33.4 --activate

COPY . .

RUN pnpm install --frozen-lockfile

ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
ARG NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
ARG NEXT_PUBLIC_BACKOFFICE_URL=http://localhost:3002

ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_BACKOFFICE_URL=${NEXT_PUBLIC_BACKOFFICE_URL}

RUN pnpm --filter @technology-ecommerce/storefront build

FROM ${NODE_BASE_IMAGE} AS runtime

ENV HOSTNAME=0.0.0.0
ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app/apps/storefront

COPY --from=build --chown=node:node /workspace/apps/storefront/.next/standalone /app
COPY --from=build --chown=node:node /workspace/apps/storefront/.next/static ./.next/static
COPY --from=build --chown=node:node /workspace/apps/storefront/public ./public

USER node

EXPOSE 3000

CMD ["node", "server.js"]
