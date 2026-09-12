import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import "dotenv/config";
import Ajv, { type AnySchema } from "ajv";
import addFormats from "ajv-formats";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AppModule } from "../../src/app.module";
import { configureApplication } from "../../src/application";

const OPENAPI_DOCUMENT_ID = "urn:technology-ecommerce:openapi";
const HTTP_METHODS = ["delete", "get", "patch", "post", "put"] as const;

type HttpMethod = (typeof HTTP_METHODS)[number];

type OpenApiOperation = Readonly<{
  operationId?: string;
  responses?: Readonly<
    Record<
      string,
      Readonly<{
        content?: Readonly<
          Record<string, Readonly<{ schema?: Readonly<Record<string, unknown>> }>>
        >;
      }>
    >
  >;
}>;

type ContractDocument = Readonly<{
  components?: Readonly<Record<string, unknown>>;
  paths: Readonly<
    Record<string, Partial<Record<HttpMethod, OpenApiOperation>>>
  >;
}>;

type JsonResponseCase = Readonly<{
  method: Extract<HttpMethod, "get">;
  path: string;
  url: string;
}>;

function qualifyLocalReferences(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(qualifyLocalReferences);
  }

  if (value === null || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => {
      if (
        key === "$ref" &&
        typeof nestedValue === "string" &&
        nestedValue.startsWith("#/")
      ) {
        return [key, `${OPENAPI_DOCUMENT_ID}${nestedValue}`];
      }

      return [key, qualifyLocalReferences(nestedValue)];
    }),
  );
}

function createResponseValidator(
  document: ContractDocument,
  path: string,
  method: HttpMethod,
  statusCode: number,
) {
  const operation = document.paths[path]?.[method];
  const response = operation?.responses?.[String(statusCode)];
  const schema = response?.content?.["application/json"]?.schema;

  if (!operation) {
    throw new Error(`OpenAPI does not declare ${method.toUpperCase()} ${path}`);
  }

  if (!response) {
    throw new Error(
      `OpenAPI does not declare ${statusCode} for ${method.toUpperCase()} ${path}`,
    );
  }

  if (!schema) {
    throw new Error(
      `OpenAPI does not declare an application/json schema for ${method.toUpperCase()} ${path}`,
    );
  }

  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  ajv.addSchema(
    {
      $id: OPENAPI_DOCUMENT_ID,
      components: document.components,
    },
    OPENAPI_DOCUMENT_ID,
  );

  return ajv.compile(qualifyLocalReferences(schema) as AnySchema);
}

function collectOperations(document: ContractDocument) {
  return Object.entries(document.paths).flatMap(([path, pathItem]) =>
    HTTP_METHODS.flatMap((method) => {
      const operationId = pathItem[method]?.operationId;

      return operationId ? [{ method, operationId, path }] : [];
    }),
  );
}

describe("OpenAPI, generated client and runtime response contracts", () => {
  let app: NestFastifyApplication;
  let document: ContractDocument;
  let generatedClientSource: string;
  let server: FastifyInstance;

  beforeAll(async () => {
    [document, generatedClientSource] = await Promise.all([
      readFile(resolve("openapi/openapi.json"), "utf8").then(
        (contents) => JSON.parse(contents) as ContractDocument,
      ),
      readFile(
        resolve("../../packages/api-client/src/generated/openapi.ts"),
        "utf8",
      ),
    ]);

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

  it("contains every OpenAPI path and operation in the generated TypeScript client", () => {
    const operations = collectOperations(document);
    const operationIds = new Set(operations.map(({ operationId }) => operationId));

    expect(operations.length).toBeGreaterThan(0);
    expect(operationIds.size).toBe(operations.length);

    for (const { operationId, path } of operations) {
      expect(generatedClientSource).toContain(`    "${path}": {`);
      expect(generatedClientSource).toContain(`    ${operationId}: {`);
    }
  });

  it.each<JsonResponseCase>([
    {
      method: "get",
      path: "/api/v1/health",
      url: "/api/v1/health",
    },
    {
      method: "get",
      path: "/api/v1/auth/csrf",
      url: "/api/v1/auth/csrf",
    },
    {
      method: "get",
      path: "/api/v1/products",
      url: "/api/v1/products?page=1&pageSize=2",
    },
  ])("validates the real $method $path response against OpenAPI", async (testCase) => {
    const response = await server.inject({
      method: testCase.method,
      url: testCase.url,
    });
    const validate = createResponseValidator(
      document,
      testCase.path,
      testCase.method,
      response.statusCode,
    );
    const body = response.json<unknown>();
    const isValid = validate(body);

    expect(response.headers["content-type"]).toContain("application/json");
    expect(isValid, JSON.stringify(validate.errors, null, 2)).toBe(true);
  });
});
