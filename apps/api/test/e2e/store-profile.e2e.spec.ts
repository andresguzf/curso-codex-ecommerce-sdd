import { randomUUID } from "node:crypto";
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
import { auditEntries, roleAssignments, storeProfiles, users } from "../../src/database/schema";
import * as schema from "../../src/database/schema";
import { hashPassword } from "../../src/identity-access/password/password";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for store profile end-to-end tests");

const originalEnvironment = {
  accessSecret: process.env.AUTH_ACCESS_TOKEN_SECRET,
  allowedOrigins: process.env.CORS_ALLOWED_ORIGINS,
  cookieSecure: process.env.AUTH_COOKIE_SECURE,
  databaseUrl: process.env.DATABASE_URL,
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
let adminId: string;
const tokens: Record<"ADMIN" | "BILLING" | "CUSTOMER", string> = { ADMIN: "", BILLING: "", CUSTOMER: "" };

const completeProfile = {
  tradeName: "Tienda Tecnología",
  legalName: "Tienda Tecnología SpA",
  taxIdentifier: "76.123.456-7",
  address: { line1: "Av. Principal 123", city: "Santiago", countryCode: "CL" },
  contact: { email: "ventas@example.com", phone: "+56 2 1234 5678" },
  logo: { storageKey: "logos/tienda.svg", url: "https://example.com/logos/tienda.svg" },
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
      await database.insert(roleAssignments).values({ userId: user.id, role });
      const login = await server.inject({ method: "POST", url: "/api/v1/auth/login", payload: { email, password } });
      expect(login.statusCode).toBe(200);
      tokens[role] = login.json<{ accessToken: string }>().accessToken;
    }
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
      logo: completeProfile.logo,
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

  it("serializes simultaneous partial updates so neither field is lost", async () => {
    const [tradeNameUpdate, postalCodeUpdate] = await Promise.all([
      server.inject({ method: "PATCH", url: "/api/v1/store-profile", headers: authorization("ADMIN"), payload: { tradeName: "Tienda Tecnología Plus" } }),
      server.inject({ method: "PATCH", url: "/api/v1/store-profile", headers: authorization("ADMIN"), payload: { address: { postalCode: "8320000" } } }),
    ]);
    expect(tradeNameUpdate.statusCode).toBe(200);
    expect(postalCodeUpdate.statusCode).toBe(200);
    const profile = await server.inject({ method: "GET", url: "/api/v1/store-profile", headers: authorization("BILLING") });
    expect(profile.json()).toMatchObject({ tradeName: "Tienda Tecnología Plus", address: { postalCode: "8320000" } });
    expect(await database.select().from(auditEntries).where(eq(auditEntries.entityType, "STORE_PROFILE"))).toHaveLength(4);
  });
});
