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
import { manualInvoiceRequestSchema } from "../../src/billing-invoicing/manual-invoice.service";

const OPENAPI_DOCUMENT_ID = "urn:technology-ecommerce:openapi";
const HTTP_METHODS = ["delete", "get", "patch", "post", "put"] as const;

type HttpMethod = (typeof HTTP_METHODS)[number];

type OpenApiOperation = Readonly<{
  operationId?: string;
  responses?: Readonly<
    Record<
      string,
      Readonly<{
        content?: Readonly<Record<string, Readonly<{ schema?: OpenApiSchema }>>>;
      }>
    >
  >;
}>;

type OpenApiSchema = Readonly<{
  $ref?: string;
  type?: string;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  required?: readonly string[];
  properties?: Readonly<Record<string, OpenApiSchema>>;
  items?: OpenApiSchema;
}>;

type OpenApiComponents = Readonly<{
  schemas?: Readonly<Record<string, OpenApiSchema>>;
}>;

type ContractDocument = Readonly<{
  components?: OpenApiComponents;
  paths: Readonly<
    Record<string, Partial<Record<HttpMethod, OpenApiOperation>>>
  >;
}>;

const PAGINATED_COLLECTIONS = [
  { path: "/api/v1/users", label: "users" },
  { path: "/api/v1/products", label: "products" },
  { path: "/api/v1/categories", label: "categories" },
  { path: "/api/v1/tags", label: "tags" },
  { path: "/api/v1/wishlist", label: "wishlist" },
  { path: "/api/v1/inventory", label: "inventory balances" },
  { path: "/api/v1/inventory/{productId}/movements", label: "inventory movements" },
  { path: "/api/v1/orders", label: "administrative orders" },
  { path: "/api/v1/orders/mine", label: "customer orders" },
  { path: "/api/v1/invoices", label: "invoices" },
] as const;

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

function resolveSchema(
  document: ContractDocument,
  schema: OpenApiSchema,
): OpenApiSchema {
  if (!schema.$ref) return schema;
  const match = /^#\/components\/schemas\/([^/]+)$/.exec(schema.$ref);
  if (!match?.[1]) throw new Error(`Unsupported OpenAPI schema reference: ${schema.$ref}`);
  const resolved = document.components?.schemas?.[match[1]];
  if (!resolved) throw new Error(`OpenAPI schema not found: ${match[1]}`);
  return resolveSchema(document, resolved);
}

function paginatedResponseSchema(
  document: ContractDocument,
  path: string,
): OpenApiSchema {
  const responseSchema =
    document.paths[path]?.get?.responses?.["200"]?.content?.["application/json"]
      ?.schema;
  if (!responseSchema) {
    throw new Error(
      `OpenAPI does not declare a JSON 200 response for GET ${path}`,
    );
  }
  return resolveSchema(document, responseSchema);
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

  it("documents integer quantities and the same tax rate range enforced at runtime", () => {
    const line = document.components?.schemas?.ManualInvoiceLineRequestDto;
    expect(line?.properties?.quantity).toMatchObject({ type: "integer", minimum: 1, maximum: 1_000_000 });
    const pattern = line?.properties?.taxRate?.pattern;
    if (!pattern) throw new Error("Missing documented manual invoice tax format");
    for (const taxRate of ["0.0000", "000.0000", "019.0000", "99.9999", "100.0000", "100.0001", "101.0000", "abc", "-1.0000", "19.00"]) {
      const parsed = manualInvoiceRequestSchema.safeParse({
        customerId: "3296f1d5-5a1d-4b94-9caa-b26878f447e4",
        lines: [{ productId: "421d45a3-104e-4413-b79f-25290d1cb0a3", quantity: 1, unitPrice: "89.50", taxRate }],
      });
      expect(new RegExp(pattern).test(taxRate)).toBe(parsed.success);
    }
  });

  it.each(PAGINATED_COLLECTIONS)(
    "exposes the normalized pagination shape for $label",
    ({ path }) => {
      const schema = paginatedResponseSchema(document, path);
      const required = schema.required ?? [];
      const properties = schema.properties ?? {};

      expect(required).toEqual(
        expect.arrayContaining([
          "items",
          "page",
          "pageSize",
          "totalItems",
          "totalPages",
        ]),
      );
      expect(properties.items).toMatchObject({ type: "array" });
      expect(properties.items?.items).toBeDefined();
      expect(properties.page).toMatchObject({ type: "number", minimum: 1 });
      expect(properties.pageSize).toMatchObject({
        type: "number",
        minimum: 1,
        maximum: 100,
      });
      expect(properties.totalItems).toMatchObject({
        type: "number",
        minimum: 0,
      });
      expect(properties.totalPages).toMatchObject({
        type: "number",
        minimum: 0,
      });
    },
  );

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
