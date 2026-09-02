import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AppModule } from "../../src/app.module";
import { configureApplication } from "../../src/application";

describe("versioned OpenAPI contract", () => {
  let app: NestFastifyApplication;
  let server: FastifyInstance;

  beforeAll(async () => {
    app = await NestFactory.create<NestFastifyApplication>(
      AppModule,
      new FastifyAdapter(),
      { logger: false },
    );
    configureApplication(app);
    await app.init();
    server = app.getHttpAdapter().getInstance() as FastifyInstance;
    await server.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("serves the generated contract under /api/v1", async () => {
    const response = await server.inject({
      method: "GET",
      url: "/api/v1/openapi.json",
    });
    const generatedDocument = JSON.parse(
      await readFile(resolve("openapi/openapi.json"), "utf8"),
    ) as unknown;

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(generatedDocument);
    expect(response.json()).toMatchObject({
      info: { version: "1.0.0" },
      paths: {
        "/api/v1/health": {
          get: { operationId: "getHealth" },
        },
      },
    });
  });
});
