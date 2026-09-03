import type { INestApplication } from "@nestjs/common";
import {
  DocumentBuilder,
  SwaggerModule,
  type OpenAPIObject,
} from "@nestjs/swagger";

export const OPENAPI_DOCUMENT_PATH = "api/v1/openapi.json";
export const OPENAPI_UI_PATH = "api/v1/docs";

function createOpenApiConfig() {
  return new DocumentBuilder()
    .setTitle("Technology Ecommerce API")
    .setDescription(
      "Versioned REST contract for the technology ecommerce platform.",
    )
    .setVersion("1.0.0")
    .addBearerAuth(
      {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Short-lived access token returned by the login endpoint",
      },
      "access-token",
    )
    .addCookieAuth(
      "technology_ecommerce_refresh",
      {
        description: "HttpOnly rotating refresh credential",
        type: "apiKey",
      },
      "technology_ecommerce_refresh",
    )
    .addTag("authentication", "Login, session renewal and logout")
    .addTag("health", "API and PostgreSQL readiness")
    .addTag("catalog-media", "Binary catalog image delivery")
    .addTag("products", "Administrative and public product catalog")
    .addTag("inventory", "Inventory balances and auditable movements")
    .build();
}

export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  return SwaggerModule.createDocument(app, createOpenApiConfig());
}

export function configureOpenApi(app: INestApplication): void {
  SwaggerModule.setup(
    OPENAPI_UI_PATH,
    app,
    () => createOpenApiDocument(app),
    {
      jsonDocumentUrl: OPENAPI_DOCUMENT_PATH,
      yamlDocumentUrl: "api/v1/openapi.yaml",
    },
  );
}
