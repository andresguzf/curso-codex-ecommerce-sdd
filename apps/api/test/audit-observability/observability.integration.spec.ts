import { BadRequestException, Controller, Get, Module, Post } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AuditObservabilityModule } from "../../src/audit-observability/audit-observability.module";
import { ApiMetricsService } from "../../src/audit-observability/api-metrics.service";
import {
  configureObservability,
  safeHttpPath,
} from "../../src/audit-observability/configure-observability";
import {
  type HttpCompletionLog,
  serializeHttpCompletionLog,
  StructuredLoggerService,
} from "../../src/audit-observability/structured-logger.service";

class ObservabilityTestController {
  authProbe(): { status: "ok" } {
    return { status: "ok" };
  }

  checkoutProbe(): { status: "ok" } {
    return { status: "ok" };
  }

  invalidInventoryRequest(): never {
    throw new BadRequestException({
      code: "OBSERVABILITY_BAD_INPUT",
      details: {
        field: "quantity",
        password: "request-password-must-not-appear",
        nested: {
          accessToken: "request-token-must-not-appear",
          reason: "invalid",
        },
      },
      message: "The probe request is invalid",
    });
  }

  unexpectedFailure(): never {
    throw new Error(
      "password=internal-password-must-not-appear token=internal-token-must-not-appear",
    );
  }

  ordersProbe(): { status: "ok" } {
    return { status: "ok" };
  }
}

Controller()(ObservabilityTestController);
Get("auth/probe")(
  ObservabilityTestController.prototype,
  "authProbe",
  Object.getOwnPropertyDescriptor(
    ObservabilityTestController.prototype,
    "authProbe",
  )!,
);
Get("checkout/probe")(
  ObservabilityTestController.prototype,
  "checkoutProbe",
  Object.getOwnPropertyDescriptor(
    ObservabilityTestController.prototype,
    "checkoutProbe",
  )!,
);
Post("inventory/bad")(
  ObservabilityTestController.prototype,
  "invalidInventoryRequest",
  Object.getOwnPropertyDescriptor(
    ObservabilityTestController.prototype,
    "invalidInventoryRequest",
  )!,
);
Post("invoices/fail")(
  ObservabilityTestController.prototype,
  "unexpectedFailure",
  Object.getOwnPropertyDescriptor(
    ObservabilityTestController.prototype,
    "unexpectedFailure",
  )!,
);
Get("orders/probe")(
  ObservabilityTestController.prototype,
  "ordersProbe",
  Object.getOwnPropertyDescriptor(
    ObservabilityTestController.prototype,
    "ordersProbe",
  )!,
);

class ObservabilityTestModule {}

Module({
  controllers: [ObservabilityTestController],
  imports: [AuditObservabilityModule],
})(ObservabilityTestModule);

describe("API observability boundary", () => {
  let app: NestFastifyApplication;
  let server: FastifyInstance;
  let metrics: ApiMetricsService;
  let structuredLogger: StructuredLoggerService;

  beforeAll(async () => {
    app = await NestFactory.create<NestFastifyApplication>(
      ObservabilityTestModule,
      new FastifyAdapter(),
      { logger: false },
    );
    app.setGlobalPrefix("api/v1");
    configureObservability(app);
    await app.init();
    server = app.getHttpAdapter().getInstance() as FastifyInstance;
    await server.ready();
    metrics = app.get(ApiMetricsService);
    structuredLogger = app.get(StructuredLoggerService);
  });

  afterAll(async () => {
    await app.close();
  });

  it("propagates correlation IDs and replaces malformed client values", async () => {
    const correlationId = "7e50d42a-b1f7-4d62-b1ee-269e6ebc86e7";
    const accepted = await server.inject({
      method: "GET",
      url: "/api/v1/auth/probe?accessToken=query-token-must-not-appear",
      headers: { "x-correlation-id": correlationId },
    });
    const replaced = await server.inject({
      method: "GET",
      url: "/api/v1/checkout/probe",
      headers: { "x-correlation-id": "not-a-valid-correlation-id" },
    });

    expect(accepted.statusCode).toBe(200);
    expect(accepted.headers["x-correlation-id"]).toBe(correlationId);
    expect(replaced.statusCode).toBe(200);
    expect(replaced.headers["x-correlation-id"]).toMatch(
      /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/,
    );
    expect(replaced.headers["x-correlation-id"]).not.toBe(
      "not-a-valid-correlation-id",
    );
  });

  it("returns uniform safe error bodies with the response correlation ID", async () => {
    const badRequest = await server.inject({
      method: "POST",
      url: "/api/v1/inventory/bad",
      payload: { password: "body-password-must-not-appear" },
    });
    const internalError = await server.inject({
      method: "POST",
      url: "/api/v1/invoices/fail",
      payload: { token: "body-token-must-not-appear" },
    });

    expect(badRequest.statusCode).toBe(400);
    expect(badRequest.json()).toEqual({
      code: "OBSERVABILITY_BAD_INPUT",
      correlationId: badRequest.headers["x-correlation-id"],
      details: { field: "quantity", nested: { reason: "invalid" } },
      message: "The probe request is invalid",
    });
    expect(internalError.statusCode).toBe(500);
    expect(internalError.json()).toEqual({
      code: "INTERNAL_SERVER_ERROR",
      correlationId: internalError.headers["x-correlation-id"],
      message: "An unexpected error occurred",
    });
    expect(JSON.stringify([badRequest.json(), internalError.json()])).not.toMatch(
      /body-password|body-token|internal-password|internal-token|request-password|request-token/,
    );
  });

  it("records bounded structured logs and basic metrics by business area", async () => {
    await server.inject({ method: "GET", url: "/api/v1/orders/probe" });
    expect(metrics.snapshot().requests).toBe(5);
    expect(structuredLogger.snapshot()).toEqual({ errors: 1, records: 5 });
    expect(
      safeHttpPath(
        "/api/v1/auth/probe?accessToken=query-token-must-not-appear",
      ),
    ).toBe("/api/v1/auth/probe");
    const sanitizedRecord = serializeHttpCompletionLog({
      correlationId: "7e50d42a-b1f7-4d62-b1ee-269e6ebc86e7",
      domain: "authentication",
      durationMs: 2.5,
      method: "GET",
      path: "/api/v1/auth/probe",
      statusCode: 200,
      authorization: "Bearer logger-secret-must-not-appear",
      password: "logger-password-must-not-appear",
    } as HttpCompletionLog);
    expect(JSON.parse(sanitizedRecord)).toMatchObject({
      correlationId: "7e50d42a-b1f7-4d62-b1ee-269e6ebc86e7",
      domain: "authentication",
      event: "http.request.completed",
      level: "info",
      method: "GET",
      outcome: "success",
      path: "/api/v1/auth/probe",
      statusCode: 200,
    });
    expect(sanitizedRecord).not.toMatch(/logger-secret|logger-password/);

    expect(metrics.snapshot()).toMatchObject({
      byDomain: {
        authentication: { errors: 0, requests: 1 },
        billing: { errors: 1, requests: 1 },
        checkout: { errors: 0, requests: 1 },
        inventory: { errors: 1, requests: 1 },
        orders: { errors: 0, requests: 1 },
        other: { errors: 0, requests: 0 },
      },
      byStatus: { "200": 3, "400": 1, "500": 1 },
      errors: 2,
      requests: 5,
    });
  });
});
