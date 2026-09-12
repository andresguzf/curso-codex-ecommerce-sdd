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
ARG NEXT_PUBLIC_STOREFRONT_URL=http://localhost:3000

ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_STOREFRONT_URL=${NEXT_PUBLIC_STOREFRONT_URL}

RUN pnpm --filter @technology-ecommerce/backoffice build

FROM ${NODE_BASE_IMAGE} AS runtime

ENV HOSTNAME=0.0.0.0
ENV NODE_ENV=production
ENV PORT=3002

WORKDIR /app/apps/backoffice

COPY --from=build --chown=node:node /workspace/apps/backoffice/.next/standalone /app
COPY --from=build --chown=node:node /workspace/apps/backoffice/.next/static ./.next/static

USER node

EXPOSE 3002

CMD ["node", "server.js"]
