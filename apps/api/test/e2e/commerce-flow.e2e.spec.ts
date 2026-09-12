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
import {
  roleAssignments,
  users,
} from "../../src/database/schema";
import * as schema from "../../src/database/schema";
import { hashPassword } from "../../src/identity-access/password/password";
import { ANONYMOUS_CART_COOKIE } from "../../src/shopping-cart-checkout/anonymous-cart-cookie.service";

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
const testDatabaseName = `ecommerce_e2e_${randomUUID().replaceAll("-", "")}`;

if (!/^ecommerce_e2e_[a-f0-9]{32}$/.test(testDatabaseName)) {
  throw new Error("Generated an unsafe PostgreSQL end-to-end database name");
}

const maintenanceUrl = new URL(databaseUrl);
maintenanceUrl.pathname = "/postgres";
const isolatedDatabaseUrl = new URL(databaseUrl);
isolatedDatabaseUrl.pathname = `/${testDatabaseName}`;
const quotedTestDatabaseName = `"${testDatabaseName}"`;

const adminEmail = "e2e-admin@example.com";
const adminPassword = "EndToEndAdminPassword123!";
const billingEmail = "e2e-billing@example.com";
const billingPassword = "EndToEndBillingPassword123!";
const customerEmail = "e2e-customer@example.com";
const customerPassword = "EndToEndCustomerPassword123!";

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
  sku: string;
  name: string;
  price: string;
  currency: "USD";
  status: "ACTIVE" | "INACTIVE";
  stockAvailable?: number;
}>;

type CartResponse = Readonly<{
  id: string;
  customerId: string | null;
  totalQuantity: number;
  subtotal: string;
  total: string;
  items: readonly Readonly<{
    id: string;
    productId: string;
    quantity: number;
  }>[];
}>;

type CheckoutResponse = Readonly<{
  order: Readonly<{
    id: string;
    number: string;
    status: "PROCESSING";
    subtotal: string;
    shippingTotal: string;
    total: string;
  }>;
  payment: Readonly<{
    status: "APPROVED";
  }>;
}>;

type InvoiceResponse = Readonly<{
  id: string;
  origin: "MANUAL" | "ORDER";
  status: "DRAFT" | "PAID" | "PENDING_PAYMENT" | "VOID";
  orderId: string | null;
  customerId: string;
  total: string;
}>;

type PageResponse<Item> = Readonly<{
  items: readonly Item[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}>;

type InjectResponse = Awaited<ReturnType<FastifyInstance["inject"]>>;

let maintenancePool: Pool | undefined;
let app: NestFastifyApplication;
let server: FastifyInstance;
let database: NodePgDatabase<typeof schema>;
let isolatedDatabaseCreated = false;

function authorization(accessToken: string): { authorization: string } {
  return { authorization: `Bearer ${accessToken}` };
}

function responseCookie(response: InjectResponse, name: string): string {
  const header = response.headers["set-cookie"];
  const serializedCookies = Array.isArray(header)
    ? header
    : header
      ? [header]
      : [];
  const serialized = serializedCookies.find((cookie) =>
    cookie.startsWith(`${name}=`),
  );

  if (!serialized) {
    throw new Error(`Response did not set the ${name} cookie`);
  }

  return serialized.split(";", 1)[0] ?? "";
}

async function login(email: string, password: string): Promise<AuthSessionResponse> {
  const response = await server.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { email, password },
  });

  expect(response.statusCode).toBe(200);
  return response.json<AuthSessionResponse>();
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

const checkoutPayload = {
  paymentMethod: "SIMULATED_CARD_APPROVED",
  shippingMethod: "STANDARD",
  shippingAddress: {
    city: "Santiago",
    countryCode: "CL",
    line1: "Avenida Tecnología 123",
    postalCode: "8320000",
    recipientName: "Cliente E2E",
    region: "Región Metropolitana",
  },
} as const;

describe("complete commerce HTTP flow", () => {
  beforeAll(async () => {
    maintenancePool = new Pool({
      application_name: "technology-ecommerce-e2e-admin",
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
      "complete-end-to-end-test-secret-at-least-32-characters";
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

    await migrate(database, {
      migrationsFolder: resolve("src/database/migrations"),
      migrationsSchema: "drizzle",
      migrationsTable: "__drizzle_migrations",
    });

    const passwordHash = await hashPassword(adminPassword);
    const [admin] = await database
      .insert(users)
      .values({
        displayName: "End-to-end administrator",
        email: adminEmail,
        passwordHash,
      })
      .returning({ id: users.id });

    if (!admin) {
      throw new Error("The end-to-end administrator was not created");
    }

    await database.insert(roleAssignments).values({
      role: "ADMIN",
      userId: admin.id,
    });
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

  it("covers registration, login, catalog, cart claim, checkout, history, administration and invoicing", async () => {
    const healthResponse = await server.inject({
      method: "GET",
      url: "/api/v1/health",
    });
    expect(healthResponse.statusCode).toBe(200);
    expect(healthResponse.json()).toMatchObject({
      database: { name: testDatabaseName, status: "up" },
      service: "api",
      status: "ok",
    });

    const adminSession = await login(adminEmail, adminPassword);

    const billingUserResponse = await server.inject({
      method: "POST",
      url: "/api/v1/users",
      headers: authorization(adminSession.accessToken),
      payload: {
        displayName: "End-to-end billing operator",
        email: billingEmail,
        password: billingPassword,
        role: "BILLING",
        status: "ACTIVE",
      },
    });
    expect(billingUserResponse.statusCode).toBe(201);
    expect(billingUserResponse.json<UserResponse>()).toMatchObject({
      email: billingEmail,
      role: "BILLING",
    });
    const billingSession = await login(billingEmail, billingPassword);

    const productCreationResponse = await server.inject({
      method: "POST",
      url: "/api/v1/products",
      headers: authorization(adminSession.accessToken),
      payload: {
        description: "Teclado mecánico RGB para el flujo end-to-end",
        name: "Teclado mecánico E2E",
        price: "149.99",
        sku: "E2E-MECH-001",
        status: "ACTIVE",
      },
    });
    expect(productCreationResponse.statusCode).toBe(201);
    const product = productCreationResponse.json<ProductResponse>();
    expect(product).toMatchObject({
      currency: "USD",
      sku: "E2E-MECH-001",
      status: "ACTIVE",
    });

    const stockResponse = await server.inject({
      method: "POST",
      url: `/api/v1/inventory/${product.id}/adjustments`,
      headers: authorization(adminSession.accessToken),
      payload: {
        quantityDelta: 10,
        reason: "End-to-end opening stock",
      },
    });
    expect(stockResponse.statusCode).toBe(201);
    expect(stockResponse.json()).toMatchObject({
      availableQuantity: 10,
      productId: product.id,
    });

    const catalogResponse = await server.inject({
      method: "GET",
      url: "/api/v1/products?search=E2E-MECH-001&page=1&pageSize=10",
    });
    expect(catalogResponse.statusCode).toBe(200);
    expect(catalogResponse.json<PageResponse<ProductResponse>>()).toMatchObject({
      items: [
        {
          id: product.id,
          stockAvailable: 10,
          status: "ACTIVE",
        },
      ],
      page: 1,
      totalItems: 1,
    });

    const registrationResponse = await server.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        displayName: "End-to-end customer",
        email: customerEmail,
        password: customerPassword,
      },
    });
    expect(registrationResponse.statusCode).toBe(201);
    const customer = registrationResponse.json<UserResponse>();
    expect(customer).toMatchObject({
      email: customerEmail,
      role: "CUSTOMER",
    });

    const emptyAnonymousCartResponse = await server.inject({
      method: "GET",
      url: "/api/v1/cart",
    });
    expect(emptyAnonymousCartResponse.statusCode).toBe(200);
    const anonymousCartCookie = responseCookie(
      emptyAnonymousCartResponse,
      ANONYMOUS_CART_COOKIE,
    );
    const emptyAnonymousCart = emptyAnonymousCartResponse.json<CartResponse>();
    expect(emptyAnonymousCart).toMatchObject({
      customerId: null,
      items: [],
      totalQuantity: 0,
    });

    const addAnonymousItemResponse = await server.inject({
      method: "POST",
      url: "/api/v1/cart/items",
      headers: { cookie: anonymousCartCookie },
      payload: { productId: product.id, quantity: 2 },
    });
    expect(addAnonymousItemResponse.statusCode).toBe(201);
    expect(addAnonymousItemResponse.json<CartResponse>()).toMatchObject({
      id: emptyAnonymousCart.id,
      customerId: null,
      subtotal: "299.98",
      total: "299.98",
      totalQuantity: 2,
      items: [{ productId: product.id, quantity: 2 }],
    });

    const persistedAnonymousCartResponse = await server.inject({
      method: "GET",
      url: "/api/v1/cart",
      headers: { cookie: anonymousCartCookie },
    });
    expect(persistedAnonymousCartResponse.statusCode).toBe(200);
    expect(persistedAnonymousCartResponse.json<CartResponse>()).toMatchObject({
      id: emptyAnonymousCart.id,
      totalQuantity: 2,
    });

    const anonymousCheckoutResponse = await server.inject({
      method: "POST",
      url: "/api/v1/checkout",
      headers: {
        cookie: anonymousCartCookie,
        "idempotency-key": "e2e-anonymous-checkout",
      },
      payload: checkoutPayload,
    });
    expect(anonymousCheckoutResponse.statusCode).toBe(401);

    const customerSession = await login(customerEmail, customerPassword);
    const claimResponse = await server.inject({
      method: "POST",
      url: "/api/v1/cart/claim",
      headers: {
        ...authorization(customerSession.accessToken),
        cookie: anonymousCartCookie,
      },
    });
    expect(claimResponse.statusCode).toBe(200);
    expect(claimResponse.json()).toMatchObject({
      adjustedProductIds: [],
      cart: {
        id: emptyAnonymousCart.id,
        customerId: customer.id,
        totalQuantity: 2,
      },
    });

    const authenticatedCartResponse = await server.inject({
      method: "GET",
      url: "/api/v1/cart",
      headers: authorization(customerSession.accessToken),
    });
    expect(authenticatedCartResponse.statusCode).toBe(200);
    expect(authenticatedCartResponse.json<CartResponse>()).toMatchObject({
      id: emptyAnonymousCart.id,
      customerId: customer.id,
      totalQuantity: 2,
    });

    const idempotencyKey = `e2e-checkout-${randomUUID()}`;
    const checkoutResponse = await server.inject({
      method: "POST",
      url: "/api/v1/checkout",
      headers: {
        ...authorization(customerSession.accessToken),
        "idempotency-key": idempotencyKey,
      },
      payload: checkoutPayload,
    });
    expect(checkoutResponse.statusCode).toBe(201);
    const checkout = checkoutResponse.json<CheckoutResponse>();
    expect(checkout).toMatchObject({
      order: {
        shippingTotal: "5.00",
        status: "PROCESSING",
        subtotal: "299.98",
        total: "304.98",
      },
      payment: { status: "APPROVED" },
    });

    const repeatedCheckoutResponse = await server.inject({
      method: "POST",
      url: "/api/v1/checkout",
      headers: {
        ...authorization(customerSession.accessToken),
        "idempotency-key": idempotencyKey,
      },
      payload: checkoutPayload,
    });
    expect(repeatedCheckoutResponse.statusCode).toBe(201);
    expect(repeatedCheckoutResponse.json<CheckoutResponse>().order.id).toBe(
      checkout.order.id,
    );

    const receiptResponse = await server.inject({
      method: "GET",
      url: `/api/v1/checkout/orders/${checkout.order.id}`,
      headers: authorization(customerSession.accessToken),
    });
    expect(receiptResponse.statusCode).toBe(200);
    expect(receiptResponse.json<CheckoutResponse>().order.id).toBe(
      checkout.order.id,
    );

    const historyResponse = await server.inject({
      method: "GET",
      url: "/api/v1/orders/mine?page=1&pageSize=10",
      headers: authorization(customerSession.accessToken),
    });
    expect(historyResponse.statusCode).toBe(200);
    expect(historyResponse.json<PageResponse<{ id: string }>>()).toMatchObject({
      items: [{ id: checkout.order.id }],
      page: 1,
      totalItems: 1,
    });

    const ownOrderResponse = await server.inject({
      method: "GET",
      url: `/api/v1/orders/${checkout.order.id}`,
      headers: authorization(customerSession.accessToken),
    });
    expect(ownOrderResponse.statusCode).toBe(200);
    expect(ownOrderResponse.json()).toMatchObject({
      id: checkout.order.id,
      status: "PROCESSING",
    });

    const productAfterCheckoutResponse = await server.inject({
      method: "GET",
      url: `/api/v1/products/${product.id}`,
    });
    expect(productAfterCheckoutResponse.statusCode).toBe(200);
    expect(productAfterCheckoutResponse.json<ProductResponse>()).toMatchObject({
      id: product.id,
      stockAvailable: 8,
    });

    const userAdministrationResponse = await server.inject({
      method: "GET",
      url: `/api/v1/users?search=${customerEmail}&page=1&pageSize=10`,
      headers: authorization(adminSession.accessToken),
    });
    expect(userAdministrationResponse.statusCode).toBe(200);
    expect(userAdministrationResponse.json<PageResponse<UserResponse>>()).toMatchObject({
      items: [{ id: customer.id, role: "CUSTOMER" }],
      totalItems: 1,
    });

    const productAdministrationResponse = await server.inject({
      method: "GET",
      url: "/api/v1/products?view=administrative&search=E2E-MECH-001",
      headers: authorization(adminSession.accessToken),
    });
    expect(productAdministrationResponse.statusCode).toBe(200);
    expect(productAdministrationResponse.json<PageResponse<ProductResponse>>()).toMatchObject({
      items: [{ id: product.id, stockAvailable: 8 }],
      totalItems: 1,
    });

    const orderAdministrationResponse = await server.inject({
      method: "GET",
      url: `/api/v1/orders?customerId=${customer.id}&page=1&pageSize=10`,
      headers: authorization(adminSession.accessToken),
    });
    expect(orderAdministrationResponse.statusCode).toBe(200);
    expect(orderAdministrationResponse.json<PageResponse<{ id: string }>>()).toMatchObject({
      items: [{ id: checkout.order.id }],
      totalItems: 1,
    });

    const orderInvoiceResponse = await server.inject({
      method: "POST",
      url: `/api/v1/orders/${checkout.order.id}/invoice`,
      headers: authorization(billingSession.accessToken),
    });
    expect(orderInvoiceResponse.statusCode).toBe(201);
    const orderInvoice = orderInvoiceResponse.json<InvoiceResponse>();
    expect(orderInvoice).toMatchObject({
      customerId: customer.id,
      orderId: checkout.order.id,
      origin: "ORDER",
      status: "PAID",
      total: "304.98",
    });

    const invoicedOrderResponse = await server.inject({
      method: "GET",
      url: `/api/v1/orders/${checkout.order.id}`,
      headers: authorization(customerSession.accessToken),
    });
    expect(invoicedOrderResponse.statusCode).toBe(200);
    expect(invoicedOrderResponse.json()).toMatchObject({
      id: checkout.order.id,
      status: "INVOICED",
    });

    const customerInvoicesResponse = await server.inject({
      method: "GET",
      url: "/api/v1/invoices?page=1&pageSize=10",
      headers: authorization(customerSession.accessToken),
    });
    expect(customerInvoicesResponse.statusCode).toBe(200);
    expect(customerInvoicesResponse.json<PageResponse<InvoiceResponse>>()).toMatchObject({
      items: [{ id: orderInvoice.id, orderId: checkout.order.id }],
      totalItems: 1,
    });

    const manualInvoiceResponse = await server.inject({
      method: "POST",
      url: "/api/v1/invoices",
      headers: authorization(billingSession.accessToken),
      payload: {
        customerId: customer.id,
        lines: [
          {
            productId: product.id,
            quantity: 1,
            taxRate: "19.0000",
            unitPrice: "20.00",
          },
        ],
        shippingTotal: "0.00",
      },
    });
    expect(manualInvoiceResponse.statusCode).toBe(201);
    expect(manualInvoiceResponse.json<InvoiceResponse>()).toMatchObject({
      customerId: customer.id,
      orderId: null,
      origin: "MANUAL",
      status: "DRAFT",
      total: "23.80",
    });

    const invoiceAdministrationResponse = await server.inject({
      method: "GET",
      url: `/api/v1/invoices?customerId=${customer.id}&page=1&pageSize=10`,
      headers: authorization(adminSession.accessToken),
    });
    expect(invoiceAdministrationResponse.statusCode).toBe(200);
    expect(invoiceAdministrationResponse.json<PageResponse<InvoiceResponse>>()).toMatchObject({
      page: 1,
      totalItems: 2,
    });

    const productAfterInvoicingResponse = await server.inject({
      method: "GET",
      url: `/api/v1/products/${product.id}`,
    });
    expect(productAfterInvoicingResponse.statusCode).toBe(200);
    expect(productAfterInvoicingResponse.json<ProductResponse>()).toMatchObject({
      id: product.id,
      stockAvailable: 8,
    });
  }, 30_000);
});
