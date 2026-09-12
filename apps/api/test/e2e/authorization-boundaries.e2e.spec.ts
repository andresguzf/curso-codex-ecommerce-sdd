import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { FastifyInstance } from "fastify";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { configureApplication } from "../../src/application";
import { roleAssignments, sessions, users } from "../../src/database/schema";
import * as schema from "../../src/database/schema";
import { AuthTokenService } from "../../src/identity-access/auth-token.service";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for end-to-end tests");
}

const originalEnvironment = {
  accessSecret: process.env.AUTH_ACCESS_TOKEN_SECRET,
  accessTtl: process.env.AUTH_ACCESS_TOKEN_TTL_SECONDS,
  allowedOrigins: process.env.CORS_ALLOWED_ORIGINS,
  cookieSecure: process.env.AUTH_COOKIE_SECURE,
  databaseUrl: process.env.DATABASE_URL,
  nodeEnvironment: process.env.NODE_ENV,
  refreshTtl: process.env.AUTH_REFRESH_TOKEN_TTL_SECONDS,
};
const testDatabaseName = `ecommerce_authz_e2e_${randomUUID().replaceAll("-", "")}`;

if (!/^ecommerce_authz_e2e_[a-f0-9]{32}$/.test(testDatabaseName)) {
  throw new Error("Generated an unsafe PostgreSQL authorization database name");
}

const maintenanceUrl = new URL(databaseUrl);
maintenanceUrl.pathname = "/postgres";
const isolatedDatabaseUrl = new URL(databaseUrl);
isolatedDatabaseUrl.pathname = `/${testDatabaseName}`;
const quotedTestDatabaseName = `"${testDatabaseName}"`;

const adminEmail = "authz-admin@example.com";
const billingEmail = "authz-billing@example.com";
const ownerEmail = "authz-owner@example.com";
const foreignCustomerEmail = "authz-foreign-customer@example.com";

type AuthSessionResponse = Readonly<{
  accessToken: string;
  user: Readonly<{
    id: string;
    email: string;
    role: "ADMIN" | "BILLING" | "CUSTOMER";
  }>;
}>;

type UserResponse = AuthSessionResponse["user"];

type ProductResponse = Readonly<{
  id: string;
  name: string;
  sku: string;
}>;

type CheckoutResponse = Readonly<{
  order: Readonly<{
    id: string;
    number: string;
  }>;
}>;

type InvoiceResponse = Readonly<{
  id: string;
  number: string | null;
}>;

type PageResponse<Item> = Readonly<{
  items: readonly Item[];
  totalItems: number;
}>;

type AuthorizationError = Readonly<{
  code: string;
  correlationId: string;
  message: string;
}>;

type InjectResponse = Awaited<ReturnType<FastifyInstance["inject"]>>;

let maintenancePool: Pool | undefined;
let app: NestFastifyApplication;
let server: FastifyInstance;
let database: NodePgDatabase<typeof schema>;
let authTokens: AuthTokenService;
let isolatedDatabaseCreated = false;
let adminSession: AuthSessionResponse;
let billingSession: AuthSessionResponse;
let ownerSession: AuthSessionResponse;
let foreignCustomerSession: AuthSessionResponse;
let product: ProductResponse;
let checkout: CheckoutResponse;
let invoice: InvoiceResponse;

function authorization(accessToken: string): { authorization: string } {
  return { authorization: `Bearer ${accessToken}` };
}

async function createAuthenticatedActor(
  email: string,
  displayName: string,
  role: UserResponse["role"],
): Promise<AuthSessionResponse> {
  const [user] = await database
    .insert(users)
    .values({
      displayName,
      email,
      passwordHash: "unused-authorization-e2e-password-hash",
    })
    .returning({ id: users.id });

  if (!user) {
    throw new Error(`The ${role} authorization fixture was not created`);
  }

  await database.insert(roleAssignments).values({ role, userId: user.id });

  const now = new Date();
  const refreshToken = authTokens.createRefreshToken();
  const sessionExpiresAt = authTokens.createSessionExpiry(now);
  await database.insert(sessions).values({
    expiresAt: sessionExpiresAt,
    id: refreshToken.sessionId,
    tokenHash: refreshToken.tokenHash,
    userId: user.id,
  });
  const accessToken = authTokens.createAccessToken({
    now,
    sessionExpiresAt,
    sessionId: refreshToken.sessionId,
    userId: user.id,
  });

  return {
    accessToken: accessToken.token,
    user: { email, id: user.id, role },
  };
}

function expectSafeAuthorizationError(
  response: InjectResponse,
  expected: Readonly<{ code: string; statusCode: number }>,
  forbiddenValues: readonly string[],
): AuthorizationError {
  expect(response.statusCode).toBe(expected.statusCode);
  expect(response.headers["content-type"]).toContain("application/json");

  const body = response.json<AuthorizationError>();
  expect(body).toMatchObject({
    code: expected.code,
    correlationId: expect.stringMatching(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    ),
    message: expect.any(String),
  });
  expect(response.headers["x-correlation-id"]).toBe(body.correlationId);

  const serialized = JSON.stringify(body).toLowerCase();
  for (const value of forbiddenValues) {
    expect(serialized).not.toContain(value.toLowerCase());
  }
  for (const secretField of [
    "accesstoken",
    "refreshtoken",
    "password",
    "passwordhash",
    "customersnapshot",
    "paymentsnapshot",
    "shippingaddresssnapshot",
  ]) {
    expect(serialized).not.toContain(secretField);
  }

  return body;
}

function restoreEnvironment(): void {
  for (const [key, value] of Object.entries({
    AUTH_ACCESS_TOKEN_SECRET: originalEnvironment.accessSecret,
    AUTH_ACCESS_TOKEN_TTL_SECONDS: originalEnvironment.accessTtl,
    AUTH_COOKIE_SECURE: originalEnvironment.cookieSecure,
    AUTH_REFRESH_TOKEN_TTL_SECONDS: originalEnvironment.refreshTtl,
    CORS_ALLOWED_ORIGINS: originalEnvironment.allowedOrigins,
    DATABASE_URL: originalEnvironment.databaseUrl,
    NODE_ENV: originalEnvironment.nodeEnvironment,
  })) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

describe("authorization boundaries over HTTP", () => {
  beforeAll(async () => {
    maintenancePool = new Pool({
      application_name: "technology-ecommerce-authz-e2e-admin",
      connectionString: maintenanceUrl.toString(),
      max: 1,
    });
    await maintenancePool.query(
      `create database ${quotedTestDatabaseName} template template0`,
    );
    isolatedDatabaseCreated = true;

    process.env.NODE_ENV = "test";
    process.env.DATABASE_URL = isolatedDatabaseUrl.toString();
    process.env.AUTH_ACCESS_TOKEN_SECRET =
      "authorization-end-to-end-secret-at-least-32-characters";
    process.env.AUTH_ACCESS_TOKEN_TTL_SECONDS = "900";
    process.env.AUTH_REFRESH_TOKEN_TTL_SECONDS = "3600";
    process.env.AUTH_COOKIE_SECURE = "false";
    process.env.CORS_ALLOWED_ORIGINS =
      "http://localhost:3000,http://localhost:3002";

    const [{ AppModule }, { DatabaseService }] = await Promise.all([
      import("../../src/app.module"),
      import("../../src/database/database.service"),
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
    database = app.get(DatabaseService).client;
    authTokens = app.get(AuthTokenService);

    await migrate(database, {
      migrationsFolder: resolve("src/database/migrations"),
      migrationsSchema: "drizzle",
      migrationsTable: "__drizzle_migrations",
    });

    adminSession = await createAuthenticatedActor(
      adminEmail,
      "Authorization administrator",
      "ADMIN",
    );
    billingSession = await createAuthenticatedActor(
      billingEmail,
      "Authorization billing operator",
      "BILLING",
    );
    ownerSession = await createAuthenticatedActor(
      ownerEmail,
      "Authorization resource owner",
      "CUSTOMER",
    );
    foreignCustomerSession = await createAuthenticatedActor(
      foreignCustomerEmail,
      "Authorization foreign customer",
      "CUSTOMER",
    );

    const productCreation = await server.inject({
      method: "POST",
      url: "/api/v1/products",
      headers: authorization(adminSession.accessToken),
      payload: {
        description: "Producto reservado para pruebas negativas de autorización",
        name: "Producto privado de autorización",
        price: "89.90",
        sku: "AUTHZ-E2E-001",
        status: "ACTIVE",
      },
    });
    expect(productCreation.statusCode).toBe(201);
    product = productCreation.json<ProductResponse>();

    const stockCreation = await server.inject({
      method: "POST",
      url: `/api/v1/inventory/${product.id}/adjustments`,
      headers: authorization(adminSession.accessToken),
      payload: {
        quantityDelta: 5,
        reason: "Authorization end-to-end opening stock",
      },
    });
    expect(stockCreation.statusCode).toBe(201);

    const cartCreation = await server.inject({
      method: "POST",
      url: "/api/v1/cart/items",
      headers: authorization(ownerSession.accessToken),
      payload: { productId: product.id, quantity: 1 },
    });
    expect(cartCreation.statusCode).toBe(201);

    const checkoutCreation = await server.inject({
      method: "POST",
      url: "/api/v1/checkout",
      headers: {
        ...authorization(ownerSession.accessToken),
        "idempotency-key": `authz-e2e-checkout-${randomUUID()}`,
      },
      payload: {
        paymentMethod: "SIMULATED_CARD_APPROVED",
        shippingMethod: "STANDARD",
        shippingAddress: {
          city: "Santiago",
          countryCode: "CL",
          line1: "Avenida Privada 404",
          postalCode: "8320000",
          recipientName: "Propietario Confidencial",
          region: "Región Metropolitana",
        },
      },
    });
    expect(checkoutCreation.statusCode).toBe(201);
    checkout = checkoutCreation.json<CheckoutResponse>();

    const invoiceCreation = await server.inject({
      method: "POST",
      url: `/api/v1/orders/${checkout.order.id}/invoice`,
      headers: authorization(billingSession.accessToken),
    });
    expect(invoiceCreation.statusCode).toBe(201);
    invoice = invoiceCreation.json<InvoiceResponse>();
  }, 30_000);

  afterAll(async () => {
    await app?.close();
    restoreEnvironment();

    if (maintenancePool && isolatedDatabaseCreated) {
      await maintenancePool.query(
        "select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()",
        [testDatabaseName],
      );
      await maintenancePool.query(`drop database ${quotedTestDatabaseName}`);
    }

    await maintenancePool?.end();
  }, 30_000);

  it.each(["ADMIN", "BILLING"] as const)(
    "prevents public registration from escalating to %s",
    async (requestedRole) => {
      const attemptedEmail = `escalation-${requestedRole.toLowerCase()}@example.com`;
      const response = await server.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        payload: {
          displayName: "Privilege escalation attempt",
          email: attemptedEmail,
          password: "PrivilegeEscalationPassword123!",
          role: requestedRole,
        },
      });

      expectSafeAuthorizationError(
        response,
        { code: "REQUEST_VALIDATION_FAILED", statusCode: 400 },
        [attemptedEmail, requestedRole],
      );

      const lookup = await server.inject({
        method: "GET",
        url: `/api/v1/users?search=${encodeURIComponent(attemptedEmail)}`,
        headers: authorization(adminSession.accessToken),
      });
      expect(lookup.statusCode).toBe(200);
      expect(lookup.json<PageResponse<UserResponse>>()).toMatchObject({
        items: [],
        totalItems: 0,
      });
    },
  );

  it("prevents a customer from creating users or changing their own role", async () => {
    const createResponse = await server.inject({
      method: "POST",
      url: "/api/v1/users",
      headers: authorization(ownerSession.accessToken),
      payload: {
        displayName: "Illicit administrator",
        email: "illicit-admin@example.com",
        password: "IllicitAdministratorPassword123!",
        role: "ADMIN",
        status: "ACTIVE",
      },
    });
    expectSafeAuthorizationError(
      createResponse,
      { code: "AUTH_FORBIDDEN", statusCode: 403 },
      [ownerEmail, "illicit-admin@example.com"],
    );

    const updateResponse = await server.inject({
      method: "PATCH",
      url: `/api/v1/users/${ownerSession.user.id}`,
      headers: authorization(ownerSession.accessToken),
      payload: { role: "ADMIN" },
    });
    expectSafeAuthorizationError(
      updateResponse,
      { code: "AUTH_FORBIDDEN", statusCode: 403 },
      [ownerEmail, ownerSession.user.id],
    );

    const currentUser = await server.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: authorization(ownerSession.accessToken),
    });
    expect(currentUser.statusCode).toBe(200);
    expect(currentUser.json<UserResponse>()).toMatchObject({
      id: ownerSession.user.id,
      role: "CUSTOMER",
    });
  });

  it("hides orders, checkout receipts, invoices and PDFs from another customer", async () => {
    const privateValues = [
      ownerEmail,
      ownerSession.user.id,
      checkout.order.id,
      checkout.order.number,
      invoice.id,
      invoice.number ?? "",
      product.id,
      product.name,
      product.sku,
      "Propietario Confidencial",
      "Avenida Privada 404",
    ].filter((value) => value.length > 0);

    const requests = [
      {
        code: "ORDER_NOT_FOUND",
        url: `/api/v1/orders/${checkout.order.id}`,
      },
      {
        code: "CHECKOUT_RECEIPT_NOT_FOUND",
        url: `/api/v1/checkout/orders/${checkout.order.id}`,
      },
      {
        code: "INVOICE_NOT_FOUND",
        url: `/api/v1/invoices/${invoice.id}`,
      },
      {
        code: "ORDER_NOT_FOUND",
        url: `/api/v1/orders/${checkout.order.id}/pdf`,
      },
      {
        code: "INVOICE_NOT_FOUND",
        url: `/api/v1/invoices/${invoice.id}/pdf`,
      },
    ];

    for (const request of requests) {
      const response = await server.inject({
        method: "GET",
        url: request.url,
        headers: authorization(foreignCustomerSession.accessToken),
      });
      expectSafeAuthorizationError(
        response,
        { code: request.code, statusCode: 404 },
        privateValues,
      );
    }

    const ownOrders = await server.inject({
      method: "GET",
      url: "/api/v1/orders/mine?page=1&pageSize=10",
      headers: authorization(foreignCustomerSession.accessToken),
    });
    expect(ownOrders.statusCode).toBe(200);
    expect(ownOrders.json<PageResponse<{ id: string }>>()).toMatchObject({
      items: [],
      totalItems: 0,
    });

    const ownInvoices = await server.inject({
      method: "GET",
      url: "/api/v1/invoices?page=1&pageSize=10",
      headers: authorization(foreignCustomerSession.accessToken),
    });
    expect(ownInvoices.statusCode).toBe(200);
    expect(ownInvoices.json<PageResponse<{ id: string }>>()).toMatchObject({
      items: [],
      totalItems: 0,
    });
  });

  it("keeps Billing inside order and invoice administration", async () => {
    const forbiddenRequests = [
      {
        method: "GET" as const,
        url: "/api/v1/users?page=1&pageSize=10",
      },
      {
        method: "POST" as const,
        url: "/api/v1/users",
        payload: {
          displayName: "Billing-created administrator",
          email: "billing-created-admin@example.com",
          password: "BillingCreatedAdminPassword123!",
          role: "ADMIN",
          status: "ACTIVE",
        },
      },
      {
        method: "POST" as const,
        url: "/api/v1/products",
        payload: {
          description: "Billing must not create this product",
          name: "Forbidden billing product",
          price: "10.00",
          sku: "BILLING-FORBIDDEN-001",
          status: "ACTIVE",
        },
      },
      {
        method: "PATCH" as const,
        url: `/api/v1/products/${product.id}/status`,
        payload: { status: "INACTIVE" },
      },
      {
        method: "POST" as const,
        url: `/api/v1/inventory/${product.id}/adjustments`,
        payload: {
          quantityDelta: 1,
          reason: "Billing must not adjust inventory",
        },
      },
    ];

    for (const request of forbiddenRequests) {
      const response = await server.inject({
        ...request,
        headers: authorization(billingSession.accessToken),
      });
      expectSafeAuthorizationError(
        response,
        { code: "AUTH_FORBIDDEN", statusCode: 403 },
        [billingEmail, product.id, ownerEmail],
      );
    }

    const ordersResponse = await server.inject({
      method: "GET",
      url: "/api/v1/orders?page=1&pageSize=10",
      headers: authorization(billingSession.accessToken),
    });
    expect(ordersResponse.statusCode).toBe(200);
    expect(ordersResponse.json<PageResponse<{ id: string }>>().items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: checkout.order.id }),
      ]),
    );

    const invoicesResponse = await server.inject({
      method: "GET",
      url: "/api/v1/invoices?page=1&pageSize=10",
      headers: authorization(billingSession.accessToken),
    });
    expect(invoicesResponse.statusCode).toBe(200);
    expect(
      invoicesResponse.json<PageResponse<{ id: string }>>().items,
    ).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: invoice.id })]),
    );
  });
});
