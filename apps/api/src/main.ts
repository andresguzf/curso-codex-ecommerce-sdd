import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import "reflect-metadata";

import { AppModule } from "./app.module.js";
import { configureApplication } from "./application.js";
import type { EnvironmentVariables } from "./config/environment.js";
import { assertDeploymentRuntime } from "./config/deployment-runtime.js";

async function bootstrap(): Promise<void> {
  assertDeploymentRuntime(process.env);
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );
  const config = app.get(ConfigService<EnvironmentVariables, true>);

  configureApplication(app);

  await app.listen({
    host: config.get("HOST", { infer: true }),
    port: config.get("PORT", { infer: true }),
  });
}

void bootstrap();
