import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { FastifyInstance } from "fastify";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { configureApplication } from "../../src/application";
import { roleAssignments, users } from "../../src/database/schema";
import * as schema from "../../src/database/schema";
import { CSRF_TOKEN_COOKIE, CSRF_TOKEN_HEADER, REFRESH_TOKEN_COOKIE } from "../../src/identity-access/auth-cookie.service";
import { hashPassword } from "../../src/identity-access/password/password";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for wishlist end-to-end tests");

const originalEnvironment = {
  accessSecret: process.env.AUTH_ACCESS_TOKEN_SECRET,
  accessTtl: process.env.AUTH_ACCESS_TOKEN_TTL_SECONDS,
  allowedOrigins: process.env.CORS_ALLOWED_ORIGINS,
  cookieSecure: process.env.AUTH_COOKIE_SECURE,
  databaseUrl: process.env.DATABASE_URL,
  nodeEnvironment: process.env.NODE_ENV,
  refreshTtl: process.env.AUTH_REFRESH_TOKEN_TTL_SECONDS,
};
const testDatabaseName = `ecommerce_wishlist_e2e_${randomUUID().replaceAll("-", "")}`;
if (!/^ecommerce_wishlist_e2e_[a-f0-9]{32}$/.test(testDatabaseName)) {
  throw new Error("Generated an unsafe wishlist end-to-end database name");
}
const maintenanceUrl = new URL(databaseUrl);
maintenanceUrl.pathname = "/postgres";
const isolatedDatabaseUrl = new URL(databaseUrl);
isolatedDatabaseUrl.pathname = `/${testDatabaseName}`;
const quotedDatabaseName = `"${testDatabaseName}"`;

const adminEmail = "wishlist-e2e-admin@example.com";
const adminPassword = "WishlistAdminPassword123!";
const customerPassword = "WishlistCustomerPassword123!";
const customerAEmail = "wishlist-e2e-a@example.com";
const customerBEmail = "wishlist-e2e-b@example.com";

type InjectResponse = Awaited<ReturnType<FastifyInstance["inject"]>>;
type SessionResponse = Readonly<{
  accessToken: string;
  user: Readonly<{ id: string; email: string; role: "CUSTOMER" | "ADMIN" | "BILLING" }>;
}>;
type WishlistPageResponse = Readonly<{
  items: readonly Readonly<{ id: string; productId: string; product: Readonly<{ isAvailable: boolean; stockAvailable: number }> }>[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}>;
type CartResponse = Readonly<{
  customerId: string | null;
  items: readonly Readonly<{ productId: string; quantity: number }>[];
  totalQuantity: number;
  subtotal: string;
  total: string;
}>;

let maintenancePool: Pool | undefined;
let app: NestFastifyApplication;
let server: FastifyInstance;
let database: NodePgDatabase<typeof schema>;
let isolatedDatabaseCreated = false;

function authorization(accessToken: string): { authorization: string } {
  return { authorization: `Bearer ${accessToken}` };
}

function cookiePair(response: InjectResponse, name: string): string {
  const header = response.headers["set-cookie"];
  const values = Array.isArray(header) ? header : header ? [header] : [];
  const serialized = values.find((value) => value.startsWith(`${name}=`));
  if (!serialized) throw new Error(`Response did not set ${name}`);
  return serialized.split(";", 1)[0] ?? "";
}

async function registerCustomer(email: string, displayName: string): Promise<void> {
  const response = await server.inject({
    method: "POST", url: "/api/v1/auth/register",
    payload: { displayName, email, password: customerPassword },
  });
  expect(response.statusCode).toBe(201);
  expect(response.json()).toMatchObject({ email, role: "CUSTOMER" });
}

async function login(email: string, password: string): Promise<{ response: InjectResponse; session: SessionResponse }> {
  const response = await server.inject({
    method: "POST", url: "/api/v1/auth/login", payload: { email, password },
  });
  expect(response.statusCode).toBe(200);
  return { response, session: response.json<SessionResponse>() };
}

async function wishlist(
  accessToken: string,
  page = 1,
  pageSize = 20,
  filters = "",
): Promise<WishlistPageResponse> {
  const response = await server.inject({
    method: "GET", url: `/api/v1/wishlist?page=${page}&pageSize=${pageSize}${filters}`,
    headers: authorization(accessToken),
  });
  expect(response.statusCode).toBe(200);
  return response.json<WishlistPageResponse>();
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
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

describe("wishlist across two customers and sessions over HTTP", () => {
  beforeAll(async () => {
    maintenancePool = new Pool({ connectionString: maintenanceUrl.toString(), max: 1 });
    await maintenancePool.query(`create database ${quotedDatabaseName} template template0`);
    isolatedDatabaseCreated = true;

    process.env.NODE_ENV = "test";
    process.env.DATABASE_URL = isolatedDatabaseUrl.toString();
    process.env.AUTH_ACCESS_TOKEN_SECRET = "wishlist-end-to-end-secret-at-least-32-characters";
    process.env.AUTH_ACCESS_TOKEN_TTL_SECONDS = "900";
    process.env.AUTH_REFRESH_TOKEN_TTL_SECONDS = "3600";
    process.env.AUTH_COOKIE_SECURE = "false";
    process.env.CORS_ALLOWED_ORIGINS = "http://localhost:3000,http://localhost:3002";

    const [{ AppModule }, { DatabaseService }] = await Promise.all([
      import("../../src/app.module"),
      import("../../src/database/database.service"),
    ]);
    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), { logger: false });
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

    const [admin] = await database.insert(users).values({
      displayName: "Wishlist administrator", email: adminEmail,
      passwordHash: await hashPassword(adminPassword),
    }).returning({ id: users.id });
    if (!admin) throw new Error("Administrator fixture was not created");
    await database.insert(roleAssignments).values({ userId: admin.id, role: "ADMIN" });
  }, 30_000);

  afterAll(async () => {
    await app?.close();
    restoreEnvironment();
    if (maintenancePool && isolatedDatabaseCreated) {
      await maintenancePool.query(
        "select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()",
        [testDatabaseName],
      );
      await maintenancePool.query(`drop database ${quotedDatabaseName}`);
    }
    await maintenancePool?.end();
  }, 30_000);

  it("persists unique wishes, isolates customers and keeps a wish after adding it to cart", async () => {
    const admin = (await login(adminEmail, adminPassword)).session;
    const category = await server.inject({
      method: "POST", url: "/api/v1/categories", headers: authorization(admin.accessToken),
      payload: { name: "Wishlist E2E", slug: "wishlist-e2e" },
    });
    expect(category.statusCode).toBe(201);
    const product = await server.inject({
      method: "POST", url: "/api/v1/products", headers: authorization(admin.accessToken),
      payload: {
        categoryId: category.json<{ id: string }>().id,
        description: "Teclado para pruebas completas de la lista de deseos",
        name: "Teclado Wishlist E2E", price: "149.99", sku: "WISHLIST-E2E-001", status: "ACTIVE",
      },
    });
    expect(product.statusCode).toBe(201);
    const productId = product.json<{ id: string }>().id;
    const stock = await server.inject({
      method: "POST", url: `/api/v1/inventory/${productId}/adjustments`,
      headers: authorization(admin.accessToken), payload: { quantityDelta: 5, reason: "Wishlist E2E opening stock" },
    });
    expect(stock.statusCode).toBe(201);

    await registerCustomer(customerAEmail, "Wishlist Customer A");
    await registerCustomer(customerBEmail, "Wishlist Customer B");
    const firstA = await login(customerAEmail, customerPassword);
    const customerB = (await login(customerBEmail, customerPassword)).session;
    expect(firstA.session.user.id).not.toBe(customerB.user.id);
    expect((await wishlist(firstA.session.accessToken)).items).toEqual([]);
    expect((await wishlist(customerB.accessToken)).items).toEqual([]);

    const addA = await server.inject({
      method: "POST", url: "/api/v1/wishlist/items",
      headers: authorization(firstA.session.accessToken), payload: { productId },
    });
    expect(addA.statusCode).toBe(200);
    expect(addA.json()).toEqual({ productId, added: true });
    const duplicateA = await server.inject({
      method: "POST", url: "/api/v1/wishlist/items",
      headers: authorization(firstA.session.accessToken), payload: { productId },
    });
    expect(duplicateA.statusCode).toBe(200);
    expect(duplicateA.json()).toEqual({ productId, added: false });
    expect(await wishlist(firstA.session.accessToken, 1, 1)).toMatchObject({
      page: 1, pageSize: 1, totalItems: 1, totalPages: 1,
      items: [{ productId, product: { isAvailable: true, stockAvailable: 5 } }],
    });
    expect(await wishlist(firstA.session.accessToken, 1, 1,
      "&search=Teclado&availability=AVAILABLE&sortBy=price&sortOrder=asc")).toMatchObject({
      page: 1, pageSize: 1, totalItems: 1, totalPages: 1,
      items: [{ productId, product: { isAvailable: true, stockAvailable: 5 } }],
    });
    expect(await wishlist(firstA.session.accessToken, 1, 1, "&search=missing-product")).toMatchObject({
      page: 1, pageSize: 1, totalItems: 0, totalPages: 0, items: [],
    });
    expect(await wishlist(firstA.session.accessToken, 2, 1)).toMatchObject({
      page: 2, pageSize: 1, totalItems: 1, totalPages: 1, items: [],
    });
    expect((await wishlist(customerB.accessToken)).items).toEqual([]);

    const foreignRemoval = await server.inject({
      method: "DELETE", url: `/api/v1/wishlist/items/${productId}`,
      headers: authorization(customerB.accessToken),
    });
    expect(foreignRemoval.statusCode).toBe(404);
    expect(foreignRemoval.json<{ code: string }>().code).toBe("WISHLIST_ITEM_NOT_FOUND");
    expect((await wishlist(firstA.session.accessToken)).totalItems).toBe(1);

    const addB = await server.inject({
      method: "POST", url: "/api/v1/wishlist/items",
      headers: authorization(customerB.accessToken), payload: { productId },
    });
    expect(addB.statusCode).toBe(200);
    expect(addB.json()).toEqual({ productId, added: true });
    expect((await wishlist(customerB.accessToken)).totalItems).toBe(1);

    const refreshCookie = cookiePair(firstA.response, REFRESH_TOKEN_COOKIE);
    const csrfCookie = cookiePair(firstA.response, CSRF_TOKEN_COOKIE);
    const logoutA = await server.inject({
      method: "POST", url: "/api/v1/auth/logout",
      headers: {
        cookie: `${refreshCookie}; ${csrfCookie}`,
        [CSRF_TOKEN_HEADER]: decodeURIComponent(csrfCookie.slice(CSRF_TOKEN_COOKIE.length + 1)),
      },
    });
    expect(logoutA.statusCode).toBe(204);
    expect((await server.inject({
      method: "GET", url: "/api/v1/wishlist", headers: authorization(firstA.session.accessToken),
    })).statusCode).toBe(401);

    const secondA = (await login(customerAEmail, customerPassword)).session;
    expect(secondA.user.id).toBe(firstA.session.user.id);
    expect((await wishlist(secondA.accessToken)).items.map((item) => item.productId)).toEqual([productId]);
    expect((await wishlist(customerB.accessToken)).items.map((item) => item.productId)).toEqual([productId]);

    const cartAddition = await server.inject({
      method: "POST", url: "/api/v1/cart/items",
      headers: authorization(secondA.accessToken), payload: { productId, quantity: 2 },
    });
    expect(cartAddition.statusCode).toBe(201);
    expect(cartAddition.json<CartResponse>()).toMatchObject({
      customerId: secondA.user.id, totalQuantity: 2, subtotal: "299.98", total: "299.98",
      items: [{ productId, quantity: 2 }],
    });
    const cartA = await server.inject({ method: "GET", url: "/api/v1/cart", headers: authorization(secondA.accessToken) });
    expect(cartA.statusCode).toBe(200);
    expect(cartA.json<CartResponse>().totalQuantity).toBe(2);
    const cartB = await server.inject({ method: "GET", url: "/api/v1/cart", headers: authorization(customerB.accessToken) });
    expect(cartB.statusCode).toBe(200);
    expect(cartB.json<CartResponse>().totalQuantity).toBe(0);
    expect((await wishlist(secondA.accessToken)).items.map((item) => item.productId)).toEqual([productId]);
    expect((await wishlist(customerB.accessToken)).items.map((item) => item.productId)).toEqual([productId]);
    expect((await wishlist(secondA.accessToken)).items[0]?.product.stockAvailable).toBe(5);

    const removeB = await server.inject({
      method: "DELETE", url: `/api/v1/wishlist/items/${productId}`,
      headers: authorization(customerB.accessToken),
    });
    expect(removeB.statusCode).toBe(204);
    expect((await wishlist(customerB.accessToken)).items).toEqual([]);
    expect((await wishlist(secondA.accessToken)).totalItems).toBe(1);
  }, 30_000);
});
