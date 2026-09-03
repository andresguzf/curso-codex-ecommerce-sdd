import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { asc, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { FastifyInstance } from "fastify";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { configureApplication } from "../../src/application";
import {
  auditEntries,
  roleAssignments,
  users,
} from "../../src/database/schema";
import * as schema from "../../src/database/schema";
import { hashPassword } from "../../src/identity-access/password/password";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is required for user administration integration tests",
  );
}

const originalEnvironment = {
  accessSecret: process.env.AUTH_ACCESS_TOKEN_SECRET,
  accessTtl: process.env.AUTH_ACCESS_TOKEN_TTL_SECONDS,
  databaseUrl: process.env.DATABASE_URL,
  refreshTtl: process.env.AUTH_REFRESH_TOKEN_TTL_SECONDS,
};
const testDatabaseName = `ecommerce_user_admin_${randomUUID().replaceAll("-", "")}`;

if (!/^ecommerce_user_admin_[a-f0-9]{32}$/.test(testDatabaseName)) {
  throw new Error("Generated an unsafe PostgreSQL test database name");
}

const maintenanceUrl = new URL(databaseUrl);
maintenanceUrl.pathname = "/postgres";

const isolatedDatabaseUrl = new URL(databaseUrl);
isolatedDatabaseUrl.pathname = `/${testDatabaseName}`;

const quotedTestDatabaseName = `"${testDatabaseName}"`;
const password = "AdministrationPassword123!";

type Role = "ADMIN" | "BILLING" | "CUSTOMER";
type Fixture = Readonly<{ email: string; id: string; role: Role }>;
type UserResponse = Readonly<{
  id: string;
  email: string;
  displayName: string;
  role: Role;
  status: "ACTIVE" | "BLOCKED" | "INACTIVE";
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}>;

let maintenancePool: Pool | undefined;
let app: NestFastifyApplication;
let server: FastifyInstance;
let database: NodePgDatabase<typeof schema>;
let isolatedDatabaseCreated = false;
let fixtures: Record<"admin" | "billing" | "customer", Fixture>;
let accessTokens: Record<keyof typeof fixtures, string>;

function restoreEnvironment(): void {
  for (const [key, value] of Object.entries({
    AUTH_ACCESS_TOKEN_SECRET: originalEnvironment.accessSecret,
    AUTH_ACCESS_TOKEN_TTL_SECONDS: originalEnvironment.accessTtl,
    AUTH_REFRESH_TOKEN_TTL_SECONDS: originalEnvironment.refreshTtl,
    DATABASE_URL: originalEnvironment.databaseUrl,
  })) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

async function login(email: string, loginPassword = password): Promise<string> {
  const response = await server.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { email, password: loginPassword },
  });

  expect(response.statusCode).toBe(200);
  return response.json<{ accessToken: string }>().accessToken;
}

function authorization(accessToken: string): { authorization: string } {
  return { authorization: `Bearer ${accessToken}` };
}

describe("administrative user lifecycle", () => {
  beforeAll(async () => {
    maintenancePool = new Pool({
      application_name: "technology-ecommerce-user-administration-test-admin",
      connectionString: maintenanceUrl.toString(),
      max: 1,
    });
    await maintenancePool.query(
      `create database ${quotedTestDatabaseName} template template0`,
    );
    isolatedDatabaseCreated = true;

    process.env.DATABASE_URL = isolatedDatabaseUrl.toString();
    process.env.AUTH_ACCESS_TOKEN_SECRET =
      "user-administration-test-secret-at-least-32-characters";
    process.env.AUTH_ACCESS_TOKEN_TTL_SECONDS = "900";
    process.env.AUTH_REFRESH_TOKEN_TTL_SECONDS = "3600";

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

    const passwordHash = await hashPassword(password);
    const fixtureInputs = [
      { key: "admin", email: "users-admin@example.com", role: "ADMIN" },
      { key: "billing", email: "users-billing@example.com", role: "BILLING" },
      {
        key: "customer",
        email: "users-customer@example.com",
        role: "CUSTOMER",
      },
    ] as const;
    const createdFixtures = {} as Record<keyof typeof fixtures, Fixture>;

    for (const fixture of fixtureInputs) {
      const [user] = await database
        .insert(users)
        .values({
          displayName: fixture.key,
          email: fixture.email,
          passwordHash,
        })
        .returning({ email: users.email, id: users.id });

      if (!user) {
        throw new Error(`User administration fixture ${fixture.key} failed`);
      }

      await database.insert(roleAssignments).values({
        role: fixture.role,
        userId: user.id,
      });
      createdFixtures[fixture.key] = { ...user, role: fixture.role };
    }

    fixtures = createdFixtures;
    accessTokens = {
      admin: await login(fixtures.admin.email),
      billing: await login(fixtures.billing.email),
      customer: await login(fixtures.customer.email),
    };
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

  it("rejects anonymous, CUSTOMER and BILLING access", async () => {
    const anonymous = await server.inject({
      method: "GET",
      url: "/api/v1/users",
    });
    const customer = await server.inject({
      method: "GET",
      url: "/api/v1/users",
      headers: authorization(accessTokens.customer),
    });
    const billing = await server.inject({
      method: "GET",
      url: "/api/v1/users",
      headers: authorization(accessTokens.billing),
    });

    expect(anonymous.statusCode).toBe(401);
    expect(customer.statusCode).toBe(403);
    expect(billing.statusCode).toBe(403);
  });

  it("creates, lists, reads and updates users with backend pagination", async () => {
    const createdResponse = await server.inject({
      method: "POST",
      url: "/api/v1/users",
      headers: authorization(accessTokens.admin),
      payload: {
        displayName: "Created billing operator",
        email: "created-billing@example.com",
        password: "CreatedBillingPassword123!",
        role: "BILLING",
      },
    });
    const created = createdResponse.json<UserResponse>();

    expect(createdResponse.statusCode).toBe(201);
    expect(created).toMatchObject({
      displayName: "Created billing operator",
      email: "created-billing@example.com",
      role: "BILLING",
      status: "ACTIVE",
    });

    const listResponse = await server.inject({
      method: "GET",
      url: "/api/v1/users?page=1&pageSize=1&search=created-billing&role=BILLING&status=ACTIVE&sortBy=email&sortOrder=asc",
      headers: authorization(accessTokens.admin),
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()).toMatchObject({
      items: [{ id: created.id }],
      page: 1,
      pageSize: 1,
      totalItems: 1,
      totalPages: 1,
    });

    const detailResponse = await server.inject({
      method: "GET",
      url: `/api/v1/users/${created.id}`,
      headers: authorization(accessTokens.admin),
    });
    expect(detailResponse.statusCode).toBe(200);
    expect(detailResponse.json()).toMatchObject({ id: created.id });

    const updatedResponse = await server.inject({
      method: "PATCH",
      url: `/api/v1/users/${created.id}`,
      headers: authorization(accessTokens.admin),
      payload: {
        displayName: "Promoted administrator",
        role: "ADMIN",
      },
    });

    expect(updatedResponse.statusCode).toBe(200);
    expect(updatedResponse.json()).toMatchObject({
      displayName: "Promoted administrator",
      role: "ADMIN",
    });

    const duplicateResponse = await server.inject({
      method: "POST",
      url: "/api/v1/users",
      headers: authorization(accessTokens.admin),
      payload: {
        displayName: "Duplicate",
        email: "CREATED-BILLING@example.com",
        password: "DuplicatePassword123!",
        role: "CUSTOMER",
      },
    });
    expect(duplicateResponse.statusCode).toBe(409);
    expect(duplicateResponse.json()).toMatchObject({
      code: "USER_EMAIL_ALREADY_REGISTERED",
    });
  });

  it("revokes sessions when deactivating and protects the last active admin", async () => {
    const promotedAdmin = await database
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.email, "created-billing@example.com"))
      .then((rows) => rows[0]);

    if (!promotedAdmin) {
      throw new Error("Promoted administrator fixture is missing");
    }

    const promotedToken = await login(
      promotedAdmin.email,
      "CreatedBillingPassword123!",
    );
    const deactivateOriginal = await server.inject({
      method: "PATCH",
      url: `/api/v1/users/${fixtures.admin.id}`,
      headers: authorization(promotedToken),
      payload: { status: "INACTIVE" },
    });

    expect(deactivateOriginal.statusCode).toBe(200);
    expect(deactivateOriginal.json()).toMatchObject({ status: "INACTIVE" });

    const revokedSession = await server.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: authorization(accessTokens.admin),
    });
    expect(revokedSession.statusCode).toBe(401);

    const removeLastAdmin = await server.inject({
      method: "PATCH",
      url: `/api/v1/users/${promotedAdmin.id}`,
      headers: authorization(promotedToken),
      payload: { status: "INACTIVE" },
    });
    expect(removeLastAdmin.statusCode).toBe(409);
    expect(removeLastAdmin.json()).toMatchObject({
      code: "USER_LAST_ACTIVE_ADMIN",
    });
  });

  it("soft-deletes users without erasing history and audits every mutation", async () => {
    const promotedAdmin = await database
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, "created-billing@example.com"))
      .then((rows) => rows[0]);

    if (!promotedAdmin) {
      throw new Error("Promoted administrator fixture is missing");
    }

    const promotedToken = await login(
      "created-billing@example.com",
      "CreatedBillingPassword123!",
    );
    const reactivateOriginal = await server.inject({
      method: "PATCH",
      url: `/api/v1/users/${fixtures.admin.id}`,
      headers: authorization(promotedToken),
      payload: { status: "ACTIVE" },
    });
    expect(reactivateOriginal.statusCode).toBe(200);
    expect(reactivateOriginal.json()).toMatchObject({ status: "ACTIVE" });

    const deleteResponse = await server.inject({
      method: "DELETE",
      url: `/api/v1/users/${fixtures.customer.id}`,
      headers: authorization(promotedToken),
    });

    expect(deleteResponse.statusCode).toBe(204);

    const [persistedUser] = await database
      .select({ deletedAt: users.deletedAt, status: users.status })
      .from(users)
      .where(eq(users.id, fixtures.customer.id));
    expect(persistedUser?.deletedAt).toBeInstanceOf(Date);
    expect(persistedUser?.status).toBe("INACTIVE");

    const detailResponse = await server.inject({
      method: "GET",
      url: `/api/v1/users/${fixtures.customer.id}`,
      headers: authorization(promotedToken),
    });
    expect(detailResponse.statusCode).toBe(404);

    const entries = await database
      .select({
        action: auditEntries.action,
        actorUserId: auditEntries.actorUserId,
        changes: auditEntries.changes,
      })
      .from(auditEntries)
      .orderBy(asc(auditEntries.createdAt));

    expect(entries.map((entry) => entry.action)).toEqual([
      "USER_CREATED",
      "USER_UPDATED",
      "USER_UPDATED",
      "USER_UPDATED",
      "USER_DELETED",
    ]);
    expect(entries.every((entry) => Boolean(entry.actorUserId))).toBe(true);
    expect(JSON.stringify(entries)).not.toContain("password");
    expect(JSON.stringify(entries)).not.toContain("hash");
  });
});
