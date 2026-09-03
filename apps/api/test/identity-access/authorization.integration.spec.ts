import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import "dotenv/config";
import {
  Controller,
  Get,
  Module,
  UseGuards,
} from "@nestjs/common";
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
  orders,
  roleAssignments,
  users,
} from "../../src/database/schema";
import * as schema from "../../src/database/schema";
import {
  AuthenticationGuard,
  OwnershipGuard,
  RequireOwnership,
  Roles,
  RolesGuard,
} from "../../src/identity-access/authorization";
import { hashPassword } from "../../src/identity-access/password/password";

class AuthorizationProbeController {
  customer(): { authorized: true } {
    return { authorized: true };
  }

  admin(): { authorized: true } {
    return { authorized: true };
  }

  billing(): { authorized: true } {
    return { authorized: true };
  }

  operations(): { authorized: true } {
    return { authorized: true };
  }

  order(): { authorized: true } {
    return { authorized: true };
  }
}

class AuthorizationProbeModule {}

type ProbeMethod = "admin" | "billing" | "customer" | "operations" | "order";

function decorateProbeMethod(
  method: ProbeMethod,
  path: string,
  guards: Parameters<typeof UseGuards>,
  metadataDecorator: MethodDecorator,
): void {
  const descriptor = Object.getOwnPropertyDescriptor(
    AuthorizationProbeController.prototype,
    method,
  );

  if (!descriptor) {
    throw new Error(`Missing authorization probe method ${method}`);
  }

  Get(path)(AuthorizationProbeController.prototype, method, descriptor);
  UseGuards(...guards)(
    AuthorizationProbeController.prototype,
    method,
    descriptor,
  );
  metadataDecorator(
    AuthorizationProbeController.prototype,
    method,
    descriptor,
  );
}

Controller("authorization-probe")(AuthorizationProbeController);
decorateProbeMethod(
  "customer",
  "customer",
  [AuthenticationGuard, RolesGuard],
  Roles("CUSTOMER"),
);
decorateProbeMethod(
  "admin",
  "admin",
  [AuthenticationGuard, RolesGuard],
  Roles("ADMIN"),
);
decorateProbeMethod(
  "billing",
  "billing",
  [AuthenticationGuard, RolesGuard],
  Roles("BILLING"),
);
decorateProbeMethod(
  "operations",
  "operations",
  [AuthenticationGuard, RolesGuard],
  Roles("ADMIN", "BILLING"),
);
decorateProbeMethod(
  "order",
  "orders/:orderId",
  [AuthenticationGuard, OwnershipGuard],
  RequireOwnership({
    bypassRoles: ["ADMIN", "BILLING"],
    resourceIdParameter: "orderId",
    resourceType: "ORDER",
  }),
);
Module({ controllers: [AuthorizationProbeController] })(
  AuthorizationProbeModule,
);

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for authorization integration tests");
}

const originalEnvironment = {
  accessSecret: process.env.AUTH_ACCESS_TOKEN_SECRET,
  accessTtl: process.env.AUTH_ACCESS_TOKEN_TTL_SECONDS,
  databaseUrl: process.env.DATABASE_URL,
  refreshTtl: process.env.AUTH_REFRESH_TOKEN_TTL_SECONDS,
};
const testDatabaseName = `ecommerce_authorization_${randomUUID().replaceAll("-", "")}`;

if (!/^ecommerce_authorization_[a-f0-9]{32}$/.test(testDatabaseName)) {
  throw new Error("Generated an unsafe PostgreSQL test database name");
}

const maintenanceUrl = new URL(databaseUrl);
maintenanceUrl.pathname = "/postgres";

const isolatedDatabaseUrl = new URL(databaseUrl);
isolatedDatabaseUrl.pathname = `/${testDatabaseName}`;

const quotedTestDatabaseName = `"${testDatabaseName}"`;
const password = "AuthorizationPassword123!";

type Role = "ADMIN" | "BILLING" | "CUSTOMER";
type Fixture = Readonly<{ email: string; id: string; role: Role }>;

let maintenancePool: Pool | undefined;
let app: NestFastifyApplication;
let server: FastifyInstance;
let database: NodePgDatabase<typeof schema>;
let isolatedDatabaseCreated = false;
let fixtures: Record<"admin" | "billing" | "customerA" | "customerB", Fixture>;
let ownedOrderId: string;
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

async function login(email: string): Promise<string> {
  const response = await server.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { email, password },
  });

  expect(response.statusCode).toBe(200);
  return response.json<{ accessToken: string }>().accessToken;
}

async function expectAccess(
  url: string,
  accessToken: string | undefined,
  expectedStatus: number,
  expectedErrorCode?: string,
): Promise<void> {
  const response = await server.inject({
    method: "GET",
    url,
    headers: accessToken
      ? { authorization: `Bearer ${accessToken}` }
      : undefined,
  });

  expect(response.statusCode).toBe(expectedStatus);

  if (expectedErrorCode) {
    expect(response.json()).toMatchObject({ code: expectedErrorCode });
  }
}

describe("role and ownership authorization", () => {
  beforeAll(async () => {
    maintenancePool = new Pool({
      application_name: "technology-ecommerce-authorization-test-admin",
      connectionString: maintenanceUrl.toString(),
      max: 1,
    });
    await maintenancePool.query(
      `create database ${quotedTestDatabaseName} template template0`,
    );
    isolatedDatabaseCreated = true;

    process.env.DATABASE_URL = isolatedDatabaseUrl.toString();
    process.env.AUTH_ACCESS_TOKEN_SECRET =
      "authorization-integration-test-secret-at-least-32-characters";
    process.env.AUTH_ACCESS_TOKEN_TTL_SECONDS = "900";
    process.env.AUTH_REFRESH_TOKEN_TTL_SECONDS = "3600";

    const [{ AppModule }, { DatabaseService }] = await Promise.all([
      import("../../src/app.module"),
      import("../../src/database/database.service"),
    ]);

    Module({ imports: [AppModule] })(AuthorizationProbeModule);
    app = await NestFactory.create<NestFastifyApplication>(
      AuthorizationProbeModule,
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
      { key: "admin", email: "guard-admin@example.com", role: "ADMIN" },
      { key: "billing", email: "guard-billing@example.com", role: "BILLING" },
      {
        key: "customerA",
        email: "guard-customer-a@example.com",
        role: "CUSTOMER",
      },
      {
        key: "customerB",
        email: "guard-customer-b@example.com",
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
        throw new Error(`Authorization fixture ${fixture.key} was not created`);
      }

      await database.insert(roleAssignments).values({
        role: fixture.role,
        userId: user.id,
      });
      createdFixtures[fixture.key] = { ...user, role: fixture.role };
    }

    fixtures = createdFixtures;
    const [order] = await database
      .insert(orders)
      .values({
        currency: "USD",
        customerId: fixtures.customerA.id,
        customerSnapshot: {},
        number: "AUTHORIZATION-ORDER-001",
        paymentSnapshot: {},
        shippingAddressSnapshot: {},
        shippingMethodSnapshot: {},
        subtotal: "0.00",
        total: "0.00",
      })
      .returning({ id: orders.id });

    if (!order) {
      throw new Error("Authorization fixture order was not created");
    }

    ownedOrderId = order.id;
    accessTokens = {
      admin: await login(fixtures.admin.email),
      billing: await login(fixtures.billing.email),
      customerA: await login(fixtures.customerA.email),
      customerB: await login(fixtures.customerB.email),
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

  it("enforces the complete CUSTOMER, ADMIN and BILLING endpoint matrix", async () => {
    const endpointMatrix = [
      { path: "customer", allowed: ["customerA", "customerB"] },
      { path: "admin", allowed: ["admin"] },
      { path: "billing", allowed: ["billing"] },
      { path: "operations", allowed: ["admin", "billing"] },
    ] as const;

    for (const endpoint of endpointMatrix) {
      for (const actor of Object.keys(accessTokens) as (keyof typeof accessTokens)[]) {
        const allowed = endpoint.allowed.some((value) => value === actor);
        await expectAccess(
          `/api/v1/authorization-probe/${endpoint.path}`,
          accessTokens[actor],
          allowed ? 200 : 403,
          allowed ? undefined : "AUTH_FORBIDDEN",
        );
      }

      await expectAccess(
        `/api/v1/authorization-probe/${endpoint.path}`,
        undefined,
        401,
        "AUTH_INVALID_SESSION",
      );
    }
  });

  it("allows an owner and rejects another customer for the same order", async () => {
    const url = `/api/v1/authorization-probe/orders/${ownedOrderId}`;

    await expectAccess(url, accessTokens.customerA, 200);
    await expectAccess(
      url,
      accessTokens.customerB,
      403,
      "AUTH_RESOURCE_FORBIDDEN",
    );
  });

  it("allows explicitly declared administrative ownership bypasses", async () => {
    const url = `/api/v1/authorization-probe/orders/${ownedOrderId}`;

    await expectAccess(url, accessTokens.admin, 200);
    await expectAccess(url, accessTokens.billing, 200);
  });

  it("does not disclose whether an unowned resource exists", async () => {
    const unknownOrderId = randomUUID();

    await expectAccess(
      `/api/v1/authorization-probe/orders/${unknownOrderId}`,
      accessTokens.customerA,
      403,
      "AUTH_RESOURCE_FORBIDDEN",
    );
  });
});
