import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { FastifyInstance } from "fastify";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { configureApplication } from "../../src/application";
import { COMPANY_LOGO_KEY, companyLogoReference } from "../../src/billing-invoicing/company-logo";
import { auditEntries, roleAssignments, storeLogoAssets, storeProfiles, users } from "../../src/database/schema";
import * as schema from "../../src/database/schema";
import { hashPassword } from "../../src/identity-access/password/password";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for store profile end-to-end tests");

const originalEnvironment = {
  accessSecret: process.env.AUTH_ACCESS_TOKEN_SECRET,
  allowedOrigins: process.env.CORS_ALLOWED_ORIGINS,
  cookieSecure: process.env.AUTH_COOKIE_SECURE,
  databaseUrl: process.env.DATABASE_URL,
  imageRoot: process.env.IMAGE_STORAGE_LOCAL_ROOT,
  nodeEnvironment: process.env.NODE_ENV,
};
const testDatabaseName = `ecommerce_store_profile_e2e_${randomUUID().replaceAll("-", "")}`;
if (!/^ecommerce_store_profile_e2e_[a-f0-9]{32}$/.test(testDatabaseName)) {
  throw new Error("Generated an unsafe store profile end-to-end database name");
}
const maintenanceUrl = new URL(databaseUrl);
maintenanceUrl.pathname = "/postgres";
const isolatedUrl = new URL(databaseUrl);
isolatedUrl.pathname = `/${testDatabaseName}`;
const quotedDatabaseName = `"${testDatabaseName}"`;
const password = "StoreProfilePassword123!";

let maintenancePool: Pool | undefined;
let app: NestFastifyApplication;
let server: FastifyInstance;
let database: NodePgDatabase<typeof schema>;
let isolatedDatabaseCreated = false;
let imageRoot: string | undefined;
let adminId: string;
let customerId: string;
const tokens: Record<"ADMIN" | "BILLING" | "CUSTOMER", string> = { ADMIN: "", BILLING: "", CUSTOMER: "" };

const completeProfile = {
  tradeName: "Tienda Tecnología",
  legalName: "Tienda Tecnología SpA",
  taxIdentifier: "76.123.456-7",
  address: { line1: "Av. Principal 123", city: "Santiago", countryCode: "CL" },
  contact: { email: "ventas@example.com", phone: "+56 2 1234 5678" },
};

function authorization(role: "ADMIN" | "BILLING" | "CUSTOMER"): { authorization: string } {
  return { authorization: `Bearer ${tokens[role]}` };
}

function restoreEnvironment(): void {
  for (const [key, value] of Object.entries({
    AUTH_ACCESS_TOKEN_SECRET: originalEnvironment.accessSecret,
    AUTH_COOKIE_SECURE: originalEnvironment.cookieSecure,
    CORS_ALLOWED_ORIGINS: originalEnvironment.allowedOrigins,
    DATABASE_URL: originalEnvironment.databaseUrl,
    IMAGE_STORAGE_LOCAL_ROOT: originalEnvironment.imageRoot,
    NODE_ENV: originalEnvironment.nodeEnvironment,
  })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

describe("store profile REST permissions and audit", () => {
  beforeAll(async () => {
    maintenancePool = new Pool({ connectionString: maintenanceUrl.toString(), max: 1 });
    await maintenancePool.query(`create database ${quotedDatabaseName} template template0`);
    isolatedDatabaseCreated = true;

    process.env.NODE_ENV = "test";
    process.env.DATABASE_URL = isolatedUrl.toString();
    process.env.AUTH_ACCESS_TOKEN_SECRET = "store-profile-end-to-end-secret-at-least-32-characters";
    process.env.AUTH_COOKIE_SECURE = "false";
    process.env.CORS_ALLOWED_ORIGINS = "http://localhost:3000,http://localhost:3002";
    imageRoot = await mkdtemp(resolve(tmpdir(), "ecommerce-store-logo-test-"));
    process.env.IMAGE_STORAGE_LOCAL_ROOT = imageRoot;

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

    for (const role of ["ADMIN", "BILLING", "CUSTOMER"] as const) {
      const email = `store-profile-${role.toLowerCase()}@example.com`;
      const [user] = await database.insert(users).values({
        email, displayName: `Store profile ${role}`, passwordHash: await hashPassword(password),
      }).returning({ id: users.id });
      if (!user) throw new Error(`${role} fixture was not created`);
      if (role === "ADMIN") adminId = user.id;
      if (role === "CUSTOMER") customerId = user.id;
      await database.insert(roleAssignments).values({ userId: user.id, role });
      const login = await server.inject({ method: "POST", url: "/api/v1/auth/login", payload: { email, password } });
      expect(login.statusCode).toBe(200);
      tokens[role] = login.json<{ accessToken: string }>().accessToken;
    }
  }, 30_000);

  afterAll(async () => {
    await app?.close();
    if (maintenancePool && isolatedDatabaseCreated) {
      await maintenancePool.query(
        "select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()",
        [testDatabaseName],
      );
      await maintenancePool.query(`drop database ${quotedDatabaseName}`);
    }
    await maintenancePool?.end();
    if (imageRoot) await rm(imageRoot, { recursive: true, force: true });
    restoreEnvironment();
  }, 30_000);

  it("permits Admin and Billing reads, only Admin writes, and audits accepted changes", async () => {
    expect((await server.inject({ method: "GET", url: "/api/v1/store-profile" })).statusCode).toBe(401);
    expect((await server.inject({ method: "PATCH", url: "/api/v1/store-profile", payload: completeProfile })).statusCode).toBe(401);
    expect((await server.inject({ method: "GET", url: "/api/v1/store-profile", headers: authorization("CUSTOMER") })).statusCode).toBe(403);
    expect((await server.inject({ method: "PATCH", url: "/api/v1/store-profile", headers: authorization("CUSTOMER"), payload: completeProfile })).statusCode).toBe(403);
    expect((await server.inject({ method: "PATCH", url: "/api/v1/store-profile", headers: authorization("BILLING"), payload: completeProfile })).statusCode).toBe(403);
    expect((await server.inject({ method: "GET", url: "/api/v1/store-profile", headers: authorization("BILLING") })).statusCode).toBe(404);

    const incomplete = await server.inject({
      method: "PATCH", url: "/api/v1/store-profile", headers: authorization("ADMIN"), payload: { tradeName: "Incomplete" },
    });
    expect(incomplete.statusCode).toBe(400);
    expect(incomplete.json<{ code: string }>().code).toBe("REQUEST_VALIDATION_FAILED");
    expect(await database.select().from(storeProfiles)).toHaveLength(0);

    const created = await server.inject({
      method: "PATCH", url: "/api/v1/store-profile", headers: authorization("ADMIN"), payload: completeProfile,
    });
    expect(created.statusCode).toBe(200);
    expect(created.json()).toMatchObject({ id: 1, ...completeProfile });
    const readByBilling = await server.inject({ method: "GET", url: "/api/v1/store-profile", headers: authorization("BILLING") });
    expect(readByBilling.statusCode).toBe(200);
    expect(readByBilling.json()).toMatchObject({ id: 1, ...completeProfile });

    const updated = await server.inject({
      method: "PATCH", url: "/api/v1/store-profile", headers: authorization("ADMIN"),
      payload: { legalName: "Nueva Razón Social SpA", address: { city: "Valparaíso" }, contact: { phone: null } },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({
      id: 1, tradeName: completeProfile.tradeName, legalName: "Nueva Razón Social SpA",
      taxIdentifier: completeProfile.taxIdentifier,
      address: { line1: completeProfile.address.line1, city: "Valparaíso", countryCode: "CL" },
      contact: { email: completeProfile.contact.email, phone: null },
      logo: companyLogoReference(),
    });
    expect(await database.select().from(storeProfiles)).toHaveLength(1);
    const audit = await database.select().from(auditEntries).where(eq(auditEntries.entityType, "STORE_PROFILE"));
    expect(audit).toHaveLength(2);
    expect(audit.map((entry) => entry.action).sort()).toEqual(["STORE_PROFILE_CREATED", "STORE_PROFILE_UPDATED"]);
    expect(audit.every((entry) => entry.actorUserId === adminId && entry.entityId === "1")).toBe(true);
    expect(audit.find((entry) => entry.action === "STORE_PROFILE_UPDATED")?.changes).toMatchObject({
      changedFields: ["legalName", "address", "contact"], created: false,
    });
  });

  it("rejects invalid partial updates without changing the profile or audit trail", async () => {
    const before = await database.select().from(storeProfiles);
    const beforeAudit = await database.select().from(auditEntries).where(eq(auditEntries.entityType, "STORE_PROFILE"));
    for (const payload of [{}, { address: { countryCode: "Chile" } }, { legalName: "   " }, { logo: { storageKey: "key" } }]) {
      const response = await server.inject({
        method: "PATCH", url: "/api/v1/store-profile", headers: authorization("ADMIN"), payload,
      });
      expect(response.statusCode).toBe(400);
    }
    expect(await database.select().from(storeProfiles)).toEqual(before);
    expect(await database.select().from(auditEntries).where(eq(auditEntries.entityType, "STORE_PROFILE"))).toEqual(beforeAudit);
  });

  it("rejects unauthenticated maintenance through the real REST route", async () => {
    const response = await server.inject({ method: "GET", url: "/api/v1/internal/jobs/daily" });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ code: "JOB_UNAUTHORIZED" });
  });

  it("serves the bundled SVG and does not expose manual logo uploads", async () => {
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=", "base64");
    const upload = (role: "ADMIN" | "BILLING" | "CUSTOMER", payload: Buffer, mime = "image/png") => server.inject({
      method: "POST", url: "/api/v1/store-profile/logo",
      headers: { ...authorization(role), "content-type": mime }, payload,
    });
    for (const role of ["ADMIN", "BILLING", "CUSTOMER"] as const) {
      expect((await upload(role, png)).statusCode).toBe(404);
    }
    expect(await database.select().from(storeLogoAssets)).toHaveLength(0);
    for (const logo of [{ storageKey: "invented.png" }, { storageKey: "invented.png", url: "https://evil.example/logo.png" }]) {
      expect((await server.inject({ method: "PATCH", url: "/api/v1/store-profile", headers: authorization("ADMIN"), payload: { logo } })).statusCode).toBe(400);
    }
    const svg = await server.inject({ method: "GET", url: `/api/v1/media/images/${COMPANY_LOGO_KEY}` });
    expect(svg.statusCode).toBe(200);
    expect(svg.headers["content-type"]).toContain("image/svg+xml");
    expect(svg.body).toContain("TECH STORE");
    expect(await database.select().from(storeLogoAssets)).toHaveLength(0);
  });

  it("serializes simultaneous partial updates so neither field is lost", async () => {
    const auditBefore = await database.select().from(auditEntries).where(eq(auditEntries.entityType, "STORE_PROFILE"));
    const [tradeNameUpdate, postalCodeUpdate] = await Promise.all([
      server.inject({ method: "PATCH", url: "/api/v1/store-profile", headers: authorization("ADMIN"), payload: { tradeName: "Tienda Tecnología Plus" } }),
      server.inject({ method: "PATCH", url: "/api/v1/store-profile", headers: authorization("ADMIN"), payload: { address: { postalCode: "8320000" } } }),
    ]);
    expect(tradeNameUpdate.statusCode).toBe(200);
    expect(postalCodeUpdate.statusCode).toBe(200);
    const profile = await server.inject({ method: "GET", url: "/api/v1/store-profile", headers: authorization("BILLING") });
    expect(profile.json()).toMatchObject({ tradeName: "Tienda Tecnología Plus", address: { postalCode: "8320000" } });
    expect(await database.select().from(auditEntries).where(eq(auditEntries.entityType, "STORE_PROFILE"))).toHaveLength(auditBefore.length + 2);
  });

  it("keeps invoice snapshots and PDFs unchanged after Admin replaces the profile", async () => {
    const firstLogoReference = companyLogoReference();
    const oldProfile = await server.inject({
      method: "PATCH", url: "/api/v1/store-profile", headers: authorization("ADMIN"),
      payload: {
        tradeName: "Nexo Original", legalName: "Nexo Original SpA", taxIdentifier: "TAX-OLD",
        address: { line1: "Calle Antigua 1", city: "Santiago", countryCode: "CL" },
        contact: { email: "old@example.com" },
      },
    });
    expect(oldProfile.statusCode).toBe(200);
    expect(oldProfile.json()).toMatchObject({ logo: firstLogoReference, legalName: "Nexo Original SpA" });
    expect((await server.inject({ method: "GET", url: "/api/v1/store-profile", headers: authorization("BILLING") })).json())
      .toMatchObject({ logo: firstLogoReference, legalName: "Nexo Original SpA" });
    expect((await server.inject({ method: "PATCH", url: "/api/v1/store-profile", headers: authorization("BILLING"), payload: { legalName: "Unauthorized" } })).statusCode).toBe(403);

    const createInvoice = (role: "ADMIN" | "BILLING") => server.inject({
      method: "POST", url: "/api/v1/invoices", headers: authorization(role),
      payload: {
        customerId, shippingTotal: "0.00",
        lines: [{ productId: null, sku: "SERVICE", name: "Technical service", description: "Historical service", quantity: 1, unitPrice: "25.00", taxRate: "0.0000" }],
      },
    });
    const created = await createInvoice("BILLING");
    expect(created.statusCode).toBe(201);
    const firstInvoice = created.json<{ id: string; issuerSnapshot: Record<string, unknown> }>();
    expect(firstInvoice.issuerSnapshot).toMatchObject({ legalName: "Nexo Original SpA", address: { line1: "Calle Antigua 1" }, logo: firstLogoReference });
    const pdfUrl = `/api/v1/invoices/${firstInvoice.id}/pdf`;
    const firstPdf = await server.inject({ method: "GET", url: pdfUrl, headers: authorization("CUSTOMER") });
    expect(firstPdf.statusCode).toBe(200);
    expect(firstPdf.headers["content-type"]).toContain("application/pdf");
    expect(firstPdf.rawPayload.toString("latin1")).toContain("/Subtype /Image");
    expect(firstPdf.rawPayload.toString("latin1")).toContain("Nexo Original SpA");

    const secondLogoReference = companyLogoReference();
    const updated = await server.inject({
      method: "PATCH", url: "/api/v1/store-profile", headers: authorization("ADMIN"),
      payload: {
        tradeName: "Nexo Nuevo", legalName: "Nexo Nuevo SpA", taxIdentifier: "TAX-NEW",
        address: { line1: "Calle Nueva 2" },
      },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({ legalName: "Nexo Nuevo SpA", logo: secondLogoReference });
    expect((await server.inject({ method: "GET", url: "/api/v1/store-profile", headers: authorization("BILLING") })).json())
      .toMatchObject({ legalName: "Nexo Nuevo SpA", logo: secondLogoReference });

    const historical = await server.inject({ method: "GET", url: `/api/v1/invoices/${firstInvoice.id}`, headers: authorization("BILLING") });
    expect(historical.statusCode).toBe(200);
    expect(historical.json<{ issuerSnapshot: unknown }>().issuerSnapshot).toEqual(firstInvoice.issuerSnapshot);
    const regenerated = await server.inject({ method: "GET", url: pdfUrl, headers: authorization("ADMIN") });
    expect(regenerated.statusCode).toBe(200);
    expect(regenerated.rawPayload.equals(firstPdf.rawPayload)).toBe(true);
    expect(regenerated.rawPayload.toString("latin1")).not.toContain("Nexo Nuevo SpA");
    expect(await database.select().from(storeLogoAssets)).toHaveLength(0);

    const next = await createInvoice("ADMIN");
    expect(next.statusCode).toBe(201);
    const nextInvoice = next.json<{ id: string; issuerSnapshot: Record<string, unknown> }>();
    expect(nextInvoice.issuerSnapshot).toMatchObject({ legalName: "Nexo Nuevo SpA", address: { line1: "Calle Nueva 2" }, logo: secondLogoReference });
    const nextPdf = await server.inject({ method: "GET", url: `/api/v1/invoices/${nextInvoice.id}/pdf`, headers: authorization("BILLING") });
    expect(nextPdf.statusCode).toBe(200);
    expect(nextPdf.rawPayload.toString("latin1")).toContain("Nexo Nuevo SpA");
    expect(nextPdf.rawPayload.toString("latin1")).toContain("/Subtype /Image");
    expect(nextPdf.rawPayload.equals(firstPdf.rawPayload)).toBe(false);
  }, 30_000);
});
