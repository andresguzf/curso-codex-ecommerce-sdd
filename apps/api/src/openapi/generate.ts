import "dotenv/config";

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";

import { AppModule } from "../app.module";
import { configureApplication } from "../application";
import { createOpenApiDocument } from "./openapi";

const fallbackDatabaseUrl =
  "postgresql://openapi:openapi@127.0.0.1:5432/openapi_generation";

async function generateOpenApi(): Promise<void> {
  process.env.DATABASE_URL ??= fallbackDatabaseUrl;

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    { abortOnError: false, logger: ["error"] },
  );

  try {
    configureApplication(app);
    const document = createOpenApiDocument(app);
    const outputPath = resolve("openapi/openapi.json");

    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`, "utf8");
  } finally {
    await app.close();
  }
}

generateOpenApi().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown OpenAPI error";

  console.error(`[openapi] ${message}`);
  process.exitCode = 1;
});
