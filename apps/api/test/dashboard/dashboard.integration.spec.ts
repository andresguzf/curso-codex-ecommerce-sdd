import "dotenv/config";
import { randomUUID } from "node:crypto";
import { insertProductFixtures } from "../product-fixtures";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import Ajv, { type AnySchema } from "ajv";
import addFormats from "ajv-formats";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { FastifyInstance } from "fastify";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { configureApplication } from "../../src/application";
import { DatabaseService } from "../../src/database/database.service";
import { inventoryBalances, invoices, orders, payments, roleAssignments, sessions, users } from "../../src/database/schema";
import { AuthTokenService } from "../../src/identity-access/auth-token.service";
import type { AuthRole, AuthenticatedUser } from "../../src/identity-access/auth.types";
import { IdentitySummaryReader } from "../../src/identity-access/identity-summary.reader";
import { CatalogSummaryReader } from "../../src/product-catalog/catalog-summary.reader";
import { InventorySummaryReader } from "../../src/inventory-control/inventory-summary.reader";
import { DashboardSummaryService } from "../../src/dashboard/dashboard-summary.service";

const sourceUrl = process.env.DATABASE_URL;
if (!sourceUrl) throw new Error("DATABASE_URL is required for dashboard integration tests");
const testName = `ecommerce_dashboard_${randomUUID().replaceAll("-", "")}`;
if (!/^ecommerce_dashboard_[a-f0-9]{32}$/.test(testName)) throw new Error("Unsafe test database name");
const maintenanceUrl = new URL(sourceUrl);
maintenanceUrl.pathname = "/postgres";
const isolatedUrl = new URL(sourceUrl);
isolatedUrl.pathname = `/${testName}`;
const originalEnvironment = { ...process.env };
let maintenance: Pool;
let created = false;
let app: NestFastifyApplication;
let server: FastifyInstance;
let database: DatabaseService["client"];
const tokens = {} as Record<AuthRole, string>;
const actors = {} as Record<AuthRole, AuthenticatedUser>;
let validateContract: ReturnType<Ajv["compile"]>;
const header = (role: AuthRole) => ({ authorization: `Bearer ${tokens[role]}` });
const getSummary = (role: AuthRole) => server.inject({ method: "GET", url: "/api/v1/dashboard/summary", headers: header(role) });
const now = new Date();
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000);

async function insertProduct(sku: string, status: "ACTIVE" | "INACTIVE", quantity?: number, deletedAt?: Date) {
  const [product] = await insertProductFixtures(database, {
    sku, name: sku, description: "Dashboard fixture", price: "10.00", status, deletedAt,
  });
  if (quantity !== undefined) await database.insert(inventoryBalances).values({ productId: product!.id, availableQuantity: quantity });
}
async function insertInvoice(status: "DRAFT" | "PENDING_PAYMENT" | "PAID" | "VOID", paidDaysAgo?: number, orderId?: string) {
  const createdAt = daysAgo(60);
  const issuedAt = status === "DRAFT" ? null : daysAgo(59);
  await database.insert(invoices).values({
    customerId: actors.CUSTOMER.id, origin: orderId ? "ORDER" : "MANUAL", orderId,
    status, number: status === "DRAFT" ? null : `INV-${randomUUID()}`,
    subtotal: "10.00", taxTotal: "0.00", total: "10.00", issuerSnapshot: {}, customerSnapshot: {},
    createdAt, issuedAt, paidAt: paidDaysAgo === undefined ? null : daysAgo(paidDaysAgo),
    voidedAt: status === "VOID" ? now : null,
  });
}
async function insertOrder(status: "PROCESSING" | "INVOICED" | "COMPLETED" | "CANCELLED", withPayment = false) {
  const [order] = await database.insert(orders).values({
    customerId: actors.CUSTOMER.id, number: `ORD-${randomUUID()}`, status,
    subtotal: "10.00", taxTotal: "0.00", total: "10.00", customerSnapshot: {},
    shippingAddressSnapshot: {}, shippingMethodSnapshot: {}, paymentSnapshot: {},
    cancelledAt: status === "CANCELLED" ? now : null,
  }).returning();
  if (withPayment) await database.insert(payments).values({
    orderId: order!.id, amount: "10.00", method: "SIMULATED_CARD", resultSnapshot: {},
  });
  return order!.id;
}

describe("dashboard summary HTTP, PostgreSQL and published contract", () => {
  beforeAll(async () => {
    maintenance = new Pool({ connectionString: maintenanceUrl.toString(), max: 1 });
    await maintenance.query(`create database "${testName}" template template0`);
    created = true;
    Object.assign(process.env, {
      NODE_ENV: "test", DATABASE_URL: isolatedUrl.toString(),
      AUTH_ACCESS_TOKEN_SECRET: "dashboard-test-secret-at-least-32-characters",
      AUTH_ACCESS_TOKEN_TTL_SECONDS: "900", AUTH_REFRESH_TOKEN_TTL_SECONDS: "3600",
      AUTH_COOKIE_SECURE: "false", CORS_ALLOWED_ORIGINS: "http://localhost:3000,http://localhost:3002",
    });
    const { AppModule } = await import("../../src/app.module");
    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), { logger: false });
    configureApplication(app);
    await app.init();
    server = app.getHttpAdapter().getInstance() as FastifyInstance;
    await server.ready();
    database = app.get(DatabaseService).client;
    await migrate(database, { migrationsFolder: resolve("src/database/migrations") });
    for (const role of ["ADMIN", "BILLING", "CUSTOMER"] as const) {
      const [actor] = await database.insert(users).values({
        email: `${role.toLowerCase()}@dashboard.example.com`, displayName: role, passwordHash: "unused-test-hash",
      }).returning();
      actors[role] = { id: actor!.id, email: actor!.email, displayName: role, role };
      await database.insert(roleAssignments).values({ userId: actor!.id, role });
      const authTokens = app.get(AuthTokenService);
      const refresh = authTokens.createRefreshToken();
      const expiresAt = authTokens.createSessionExpiry(now);
      await database.insert(sessions).values({ id: refresh.sessionId, tokenHash: refresh.tokenHash, userId: actor!.id, expiresAt });
      tokens[role] = authTokens.createAccessToken({ now, sessionExpiresAt: expiresAt, sessionId: refresh.sessionId, userId: actor!.id }).token;
    }
    const document = JSON.parse(await readFile(resolve("openapi/openapi.json"), "utf8")) as {
      paths: Record<string, { get: { security: unknown; responses: Record<string, { content: Record<string, { schema: AnySchema }> }> } }>;
    };
    const operation = document.paths["/api/v1/dashboard/summary"]!.get;
    expect(operation.security).toEqual([{ "access-token": [] }]);
    expect(operation.responses).toHaveProperty("401");
    expect(operation.responses).toHaveProperty("403");
    const ajv = new Ajv({ strict: false });
    addFormats(ajv);
    validateContract = ajv.compile(operation.responses["200"]!.content["application/json"]!.schema);
  }, 30_000);

  afterAll(async () => {
    vi.restoreAllMocks();
    await app?.close();
    for (const key of ["NODE_ENV", "DATABASE_URL", "AUTH_ACCESS_TOKEN_SECRET", "AUTH_ACCESS_TOKEN_TTL_SECONDS",
      "AUTH_REFRESH_TOKEN_TTL_SECONDS", "AUTH_COOKIE_SECURE", "CORS_ALLOWED_ORIGINS"]) {
      if (originalEnvironment[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnvironment[key];
    }
    if (created) {
      await maintenance.query("select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()", [testName]);
      await maintenance.query(`drop database "${testName}"`);
    }
    await maintenance?.end();
  }, 30_000);

  it("returns explicit zero counts and valid timestamps for both roles on an empty store", async () => {
    for (const role of ["ADMIN", "BILLING"] as const) {
      const response = await getSummary(role);
      expect(response.statusCode).toBe(200);
      expect(response.headers["cache-control"]).toBe("private, no-store");
      const body = response.json();
      expect(validateContract(body), JSON.stringify(validateContract.errors)).toBe(true);
      expect(body.role).toBe(role);
      expect(Date.parse(body.updatedAt)).not.toBeNaN();
      expect(Object.values(body.metrics)).toEqual(role === "ADMIN" ? [1, 0, 0, 0, 0] : [0, 0, 0, 0]);
    }
  });

  it("counts non-deleted customers, active products and low stock including missing balances", async () => {
    for (const [index, status, deletedAt] of [
      [0, "INACTIVE", null], [1, "BLOCKED", null], [2, "INACTIVE", now],
    ] as const) {
      const [user] = await database.insert(users).values({
        email: `extra-${index}@dashboard.example.com`, displayName: "Extra", passwordHash: "unused",
        status, deletedAt,
      }).returning();
      await database.insert(roleAssignments).values({ userId: user!.id, role: "CUSTOMER" });
    }
    await insertProduct("healthy", "ACTIVE", 6);
    await insertProduct("threshold", "ACTIVE", 5);
    await insertProduct("empty", "ACTIVE", 0);
    await insertProduct("missing", "ACTIVE");
    await insertProduct("inactive", "INACTIVE", 1);
    await insertProduct("deleted", "INACTIVE", 0, now);
    const body = (await getSummary("ADMIN")).json();
    expect(body.metrics).toMatchObject({ totalCustomers: 3, activeProducts: 4, lowStockProducts: 3 });
    expect(body.lowStockThreshold).toBe(5);
    expect(validateContract(body)).toBe(true);
  });

  it("distinguishes processing, awaiting and eligible orders, excluding active invoices but not VOID", async () => {
    await insertOrder("PROCESSING", true); // Eligible.
    await insertOrder("PROCESSING"); // Awaiting, but no payment.
    const blocked = await insertOrder("PROCESSING", true);
    await insertInvoice("DRAFT", undefined, blocked);
    const voided = await insertOrder("PROCESSING", true);
    await insertInvoice("VOID", undefined, voided);
    for (const status of ["INVOICED", "COMPLETED", "CANCELLED"] as const) await insertOrder(status, true);
    expect((await getSummary("ADMIN")).json().metrics.processingOrders).toBe(4);
    const body = (await getSummary("BILLING")).json();
    expect(body.metrics).toMatchObject({ ordersAwaitingInvoice: 3, ordersEligibleForInvoicing: 2 });
    expect(validateContract(body)).toBe(true);
  });

  it("counts pending invoices across all dates and origins, and paid invoices by paidAt in the rolling period", async () => {
    await insertInvoice("PENDING_PAYMENT");
    await insertInvoice("PAID", 2);
    await insertInvoice("PAID", 31); // Excluded by paidAt.
    await insertInvoice("VOID", 1); // Excluded by current status.
    const body = (await getSummary("BILLING")).json();
    expect(body.metrics).toMatchObject({ pendingInvoices: 1, paidInvoices: 1 });
    expect(body.period.basis).toBe("paidAt");
    expect(body.period.to).toBe(body.updatedAt);
    expect(Date.parse(body.period.to) - Date.parse(body.period.from)).toBe(30 * 86_400_000);
    expect((await getSummary("ADMIN")).json().metrics.pendingInvoices).toBe(1);
  });

  it("never reads or exposes identity, catalog or inventory metrics to BILLING", async () => {
    const spies = [
      vi.spyOn(app.get(IdentitySummaryReader), "countCustomers"),
      vi.spyOn(app.get(CatalogSummaryReader), "countActiveProducts"),
      vi.spyOn(app.get(InventorySummaryReader), "countLowStockProducts"),
    ];
    const body = (await getSummary("BILLING")).json();
    for (const spy of spies) { expect(spy).not.toHaveBeenCalled(); spy.mockRestore(); }
    expect(Object.keys(body.metrics).sort()).toEqual(["ordersAwaitingInvoice", "ordersEligibleForInvoicing", "paidInvoices", "pendingInvoices"]);
    expect(body).not.toHaveProperty("lowStockThreshold");
    expect(validateContract({ ...body, metrics: { ...body.metrics, totalCustomers: 3 } })).toBe(false);
  });

  it("rejects anonymous and CUSTOMER requests without metrics or data and before aggregate reads", async () => {
    const spy = vi.spyOn(app.get(DashboardSummaryService), "summary");
    for (const [headers, status, code] of [[{}, 401, "AUTH_INVALID_SESSION"], [header("CUSTOMER"), 403, "AUTH_FORBIDDEN"]] as const) {
      const response = await server.inject({ method: "GET", url: "/api/v1/dashboard/summary", headers });
      expect(response.statusCode).toBe(status);
      expect(response.json()).toMatchObject({ code, correlationId: expect.any(String) });
      expect(response.json()).not.toHaveProperty("metrics");
      expect(response.body).not.toContain("totalCustomers");
      expect(response.body).not.toContain("paidInvoices");
    }
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
    const databaseSpy = vi.spyOn(database, "transaction");
    expect(() => app.get(DashboardSummaryService).summary(actors.CUSTOMER)).toThrow();
    expect(databaseSpy).not.toHaveBeenCalled();
    databaseSpy.mockRestore();
  });

  it("shares a repeatable-read read-only snapshot across module projections", async () => {
    const identity = app.get(IdentitySummaryReader);
    const original = identity.countCustomers.bind(identity);
    const spy = vi.spyOn(identity, "countCustomers").mockImplementationOnce(async (transaction) => {
      const settings = await transaction.execute<{ isolation: string; readOnly: string }>(sql`
        select current_setting('transaction_isolation') as isolation,
          current_setting('transaction_read_only') as "readOnly"`);
      expect(settings.rows[0]).toEqual({ isolation: "repeatable read", readOnly: "on" });
      await insertProduct("concurrent", "ACTIVE", 10); // Commits on another connection after the snapshot begins.
      return original(transaction);
    });
    const response = await getSummary("ADMIN");
    expect(response.json().metrics.activeProducts).toBe(4);
    spy.mockRestore();
    expect((await getSummary("ADMIN")).json().metrics.activeProducts).toBe(5);
  });
});
