import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import "reflect-metadata";

import { AppModule } from "./app.module";
import { configureApplication } from "./application";
import type { EnvironmentVariables } from "./config/environment";

async function bootstrap(): Promise<void> {
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
