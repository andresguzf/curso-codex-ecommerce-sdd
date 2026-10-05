import type { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { FastifyInstance } from "fastify";

import { configureObservability } from "./audit-observability/configure-observability.js";
import { configureOpenApi } from "./openapi/openapi.js";
import { configureHttpSecurity } from "./security/http-security.js";
import type { EnvironmentVariables } from "./config/environment.js";

export const API_PREFIX = "api/v1";

export function configureApplication(app: INestApplication): void {
  const server = app.getHttpAdapter().getInstance() as FastifyInstance;
  const limit = app.get(ConfigService<EnvironmentVariables, true>).get("IMAGE_STORAGE_MAX_BYTES", { infer: true });
  server.addContentTypeParser(/^image\/(?:png|jpeg|webp)$/, { parseAs: "buffer", bodyLimit: limit }, (_request, body, done) => done(null, body));
  app.setGlobalPrefix(API_PREFIX);
  configureObservability(app);
  configureHttpSecurity(app);
  configureOpenApi(app);
}
