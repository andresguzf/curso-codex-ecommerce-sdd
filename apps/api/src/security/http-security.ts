import type { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import cookie from "@fastify/cookie";
import type { FastifyInstance } from "fastify";

import type { EnvironmentVariables } from "../config/environment";

const ORIGIN_FORBIDDEN_RESPONSE = {
  code: "ORIGIN_FORBIDDEN",
  message: "The request origin is not allowed",
} as const;

export function configureHttpSecurity(app: INestApplication): void {
  const config = app.get(ConfigService<EnvironmentVariables, true>);
  const allowedOrigins = new Set(
    config.get("CORS_ALLOWED_ORIGINS", { infer: true }),
  );
  const server = app.getHttpAdapter().getInstance() as FastifyInstance;

  server.register(cookie);
  server.addHook("onRequest", async (request, reply) => {
    const origin = request.headers.origin;

    if (origin && !allowedOrigins.has(origin)) {
      await reply.code(403).send(ORIGIN_FORBIDDEN_RESPONSE);
    }
  });
  app.enableCors({
    allowedHeaders: [
      "Authorization",
      "Content-Type",
      "Idempotency-Key",
      "X-Correlation-ID",
      "X-CSRF-Token",
    ],
    credentials: true,
    exposedHeaders: ["X-CSRF-Token", "Retry-After", "X-Correlation-ID"],
    methods: ["GET", "HEAD", "POST", "PATCH", "DELETE", "OPTIONS"],
    origin: [...allowedOrigins],
  });
}
