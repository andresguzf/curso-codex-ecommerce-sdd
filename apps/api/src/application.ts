import type { INestApplication } from "@nestjs/common";

import { configureOpenApi } from "./openapi/openapi";
import { configureHttpSecurity } from "./security/http-security";

export const API_PREFIX = "api/v1";

export function configureApplication(app: INestApplication): void {
  app.setGlobalPrefix(API_PREFIX);
  configureHttpSecurity(app);
  configureOpenApi(app);
}
