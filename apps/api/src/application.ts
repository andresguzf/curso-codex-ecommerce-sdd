import type { INestApplication } from "@nestjs/common";

import { configureOpenApi } from "./openapi/openapi";

export const API_PREFIX = "api/v1";

export function configureApplication(app: INestApplication): void {
  app.setGlobalPrefix(API_PREFIX);
  configureOpenApi(app);
}
