import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import "reflect-metadata";

import { AppModule } from "./app.module";
import type { EnvironmentVariables } from "./config/environment";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );
  const config = app.get(ConfigService<EnvironmentVariables, true>);

  app.setGlobalPrefix("api/v1");

  await app.listen({
    host: config.get("HOST", { infer: true }),
    port: config.get("PORT", { infer: true }),
  });
}

void bootstrap();
