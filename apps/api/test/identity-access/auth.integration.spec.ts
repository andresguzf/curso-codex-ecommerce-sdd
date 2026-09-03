import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { asc, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { FastifyInstance } from "fastify";
import { Pool } from "pg";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import { configureApplication } from "../../src/application";
import { roleAssignments, sessions, users } from "../../src/database/schema";
import * as schema from "../../src/database/schema";
import {
  hashPassword,
  verifyPassword,
} from "../../src/identity-access/password/password";
import {
  CSRF_TOKEN_COOKIE,
  CSRF_TOKEN_HEADER,
  REFRESH_TOKEN_COOKIE,
} from "../../src/identity-access/auth-cookie.service";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for authentication integration tests");
}

const originalEnvironment = {
  accessSecret: process.env.AUTH_ACCESS_TOKEN_SECRET,
  accessTtl: process.env.AUTH_ACCESS_TOKEN_TTL_SECONDS,
  allowedOrigins: process.env.CORS_ALLOWED_ORIGINS,
  cookieSameSite: process.env.AUTH_COOKIE_SAME_SITE,
  cookieSecure: process.env.AUTH_COOKIE_SECURE,
  databaseUrl: process.env.DATABASE_URL,
  loginMaxAttempts: process.env.AUTH_LOGIN_MAX_ATTEMPTS,
  loginWindow: process.env.AUTH_LOGIN_WINDOW_SECONDS,
  refreshTtl: process.env.AUTH_REFRESH_TOKEN_TTL_SECONDS,
};
const testDatabaseName = `ecommerce_auth_${randomUUID().replaceAll("-", "")}`;

if (!/^ecommerce_auth_[a-f0-9]{32}$/.test(testDatabaseName)) {
  throw new Error("Generated an unsafe PostgreSQL test database name");
}

const maintenanceUrl = new URL(databaseUrl);
maintenanceUrl.pathname = "/postgres";

const isolatedDatabaseUrl = new URL(databaseUrl);
isolatedDatabaseUrl.pathname = `/${testDatabaseName}`;

const quotedTestDatabaseName = `"${testDatabaseName}"`;
const validEmail = "auth-customer@example.com";
const validPassword = "AuthCustomerPassword123!";

type LoginResponse = Readonly<{
  accessToken: string;
  tokenType: "Bearer";
  accessTokenExpiresAt: string;
  sessionExpiresAt: string;
  user: {
    id: string;
    email: string;
    displayName: string;
    role: "CUSTOMER";
  };
}>;

type InjectResponse = Awaited<ReturnType<FastifyInstance["inject"]>>;
type BrowserCredentials = Readonly<{
  cookieHeader: string;
  csrfToken: string;
  refreshToken: string;
}>;

let maintenancePool: Pool | undefined;
let app: NestFastifyApplication;
let server: FastifyInstance;
let database: NodePgDatabase<typeof schema>;
let isolatedDatabaseCreated = false;

function restoreEnvironment(): void {
  for (const [key, value] of Object.entries({
    AUTH_ACCESS_TOKEN_SECRET: originalEnvironment.accessSecret,
    AUTH_ACCESS_TOKEN_TTL_SECONDS: originalEnvironment.accessTtl,
    AUTH_COOKIE_SAME_SITE: originalEnvironment.cookieSameSite,
    AUTH_COOKIE_SECURE: originalEnvironment.cookieSecure,
    AUTH_LOGIN_MAX_ATTEMPTS: originalEnvironment.loginMaxAttempts,
    AUTH_LOGIN_WINDOW_SECONDS: originalEnvironment.loginWindow,
    AUTH_REFRESH_TOKEN_TTL_SECONDS: originalEnvironment.refreshTtl,
    CORS_ALLOWED_ORIGINS: originalEnvironment.allowedOrigins,
    DATABASE_URL: originalEnvironment.databaseUrl,
  })) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function readCookie(response: InjectResponse, name: string): {
  pair: string;
  serialized: string;
  value: string;
} {
  const header = response.headers["set-cookie"];
  const serializedCookies = Array.isArray(header)
    ? header
    : header
      ? [header]
      : [];
  const serialized = serializedCookies.find((cookieValue) =>
    cookieValue.startsWith(`${name}=`),
  );

  if (!serialized) {
    throw new Error(`Response did not set the ${name} cookie`);
  }

  const pair = serialized.split(";", 1)[0] ?? "";

  return {
    pair,
    serialized,
    value: decodeURIComponent(pair.slice(name.length + 1)),
  };
}

function readBrowserCredentials(response: InjectResponse): BrowserCredentials {
  const refresh = readCookie(response, REFRESH_TOKEN_COOKIE);
  const csrf = readCookie(response, CSRF_TOKEN_COOKIE);

  return {
    cookieHeader: `${refresh.pair}; ${csrf.pair}`,
    csrfToken: csrf.value,
    refreshToken: refresh.value,
  };
}

async function login(
  email = validEmail,
  password = validPassword,
): Promise<ReturnType<FastifyInstance["inject"]> extends Promise<infer Response>
  ? Response
  : never> {
  return server.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { email, password },
  });
}

describe("authentication sessions", () => {
  beforeAll(async () => {
    maintenancePool = new Pool({
      application_name: "technology-ecommerce-auth-test-admin",
      connectionString: maintenanceUrl.toString(),
      max: 1,
    });
    await maintenancePool.query(
      `create database ${quotedTestDatabaseName} template template0`,
    );
    isolatedDatabaseCreated = true;

    process.env.DATABASE_URL = isolatedDatabaseUrl.toString();
    process.env.AUTH_ACCESS_TOKEN_SECRET =
      "authentication-integration-test-secret-at-least-32-characters";
    process.env.AUTH_ACCESS_TOKEN_TTL_SECONDS = "1";
    process.env.AUTH_REFRESH_TOKEN_TTL_SECONDS = "3600";
    process.env.AUTH_COOKIE_SECURE = "true";
    process.env.AUTH_COOKIE_SAME_SITE = "lax";
    process.env.AUTH_LOGIN_MAX_ATTEMPTS = "3";
    process.env.AUTH_LOGIN_WINDOW_SECONDS = "60";
    process.env.CORS_ALLOWED_ORIGINS =
      "https://storefront.example.com,https://backoffice.example.com";

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

    const passwordHash = await hashPassword(validPassword);
    const [user] = await database
      .insert(users)
      .values({
        email: validEmail,
        displayName: "Authentication customer",
        passwordHash,
      })
      .returning({ id: users.id, passwordHash: users.passwordHash });

    if (!user) {
      throw new Error("Authentication fixture user was not created");
    }

    await database.insert(roleAssignments).values({
      userId: user.id,
      role: "CUSTOMER",
    });

    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(validPassword, user.passwordHash)).toBe(true);
  }, 30_000);

  beforeEach(async () => {
    await database.delete(sessions);
    await database
      .update(users)
      .set({ status: "ACTIVE", deletedAt: null })
      .where(eq(users.email, validEmail));
  });

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

  it("creates a persisted session for valid credentials", async () => {
    const response = await login();
    const body = response.json<LoginResponse>();
    const browserCredentials = readBrowserCredentials(response);

    expect(response.statusCode).toBe(200);
    expect(body).toMatchObject({
      tokenType: "Bearer",
      user: { email: validEmail, role: "CUSTOMER" },
    });
    expect(body.accessToken).toBeTypeOf("string");
    expect(body).not.toHaveProperty("refreshToken");
    expect(browserCredentials.refreshToken).toBeTypeOf("string");

    const refreshCookie = readCookie(response, REFRESH_TOKEN_COOKIE);
    const csrfCookie = readCookie(response, CSRF_TOKEN_COOKIE);
    expect(refreshCookie.serialized).toContain("HttpOnly");
    expect(refreshCookie.serialized).toContain("Secure");
    expect(refreshCookie.serialized).toContain("SameSite=Lax");
    expect(refreshCookie.serialized).toContain("Path=/api/v1/auth");
    expect(csrfCookie.serialized).not.toContain("HttpOnly");
    expect(csrfCookie.serialized).toContain("Secure");
    expect(response.headers[CSRF_TOKEN_HEADER]).toBe(csrfCookie.value);
    expect(response.headers["cache-control"]).toBe("no-store");

    const persistedSessions = await database
      .select({ tokenHash: sessions.tokenHash })
      .from(sessions);
    expect(persistedSessions).toHaveLength(1);
    expect(persistedSessions[0]?.tokenHash).not.toBe(
      browserCredentials.refreshToken,
    );

    const meResponse = await server.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { authorization: `Bearer ${body.accessToken}` },
    });
    expect(meResponse.statusCode).toBe(200);
    expect(meResponse.json()).toMatchObject({
      email: validEmail,
      role: "CUSTOMER",
    });
  });

  it("registers an active customer atomically and allows subsequent login", async () => {
    const email = "new-public-customer@example.com";
    const password = "NewCustomerPassword123!";
    const response = await server.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email: `  ${email.toUpperCase()}  `,
        displayName: "  New public customer  ",
        password,
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      email,
      displayName: "New public customer",
      role: "CUSTOMER",
    });

    const [registered] = await database
      .select({
        passwordHash: users.passwordHash,
        role: roleAssignments.role,
        status: users.status,
      })
      .from(users)
      .innerJoin(roleAssignments, eq(roleAssignments.userId, users.id))
      .where(eq(users.email, email));

    expect(registered).toMatchObject({ role: "CUSTOMER", status: "ACTIVE" });
    expect(registered?.passwordHash).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(password, registered?.passwordHash ?? "")).toBe(
      true,
    );

    const loginResponse = await login(email, password);
    expect(loginResponse.statusCode).toBe(200);
    expect(loginResponse.json()).toMatchObject({
      user: { email, role: "CUSTOMER" },
    });
  });

  it.each(["ADMIN", "BILLING"] as const)(
    "rejects a public registration that requests the %s role",
    async (role) => {
      const email = `attempted-${role.toLowerCase()}@example.com`;
      const response = await server.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        payload: {
          email,
          displayName: `Attempted ${role}`,
          password: "AttemptedRolePassword123!",
          role,
        },
      });

      expect(response.statusCode).toBe(400);

      const persisted = await database
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email));
      expect(persisted).toEqual([]);
    },
  );

  it("rejects a duplicate email without creating another customer", async () => {
    const email = "duplicate-registration@example.com";
    const payload = {
      email,
      displayName: "First registration",
      password: "DuplicateCustomerPassword123!",
    };

    expect(
      (
        await server.inject({
          method: "POST",
          url: "/api/v1/auth/register",
          payload,
        })
      ).statusCode,
    ).toBe(201);

    const duplicate = await server.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { ...payload, email: email.toUpperCase() },
    });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json()).toMatchObject({
      code: "AUTH_EMAIL_ALREADY_REGISTERED",
    });

    const persisted = await database
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.email, email));
    expect(persisted[0]?.count).toBe(1);
  });

  it("returns the same safe rejection for wrong and unknown credentials", async () => {
    const wrongPassword = await login(validEmail, "incorrect-password");
    const unknownUser = await login(
      "unknown-auth-user@example.com",
      "incorrect-password",
    );

    expect(wrongPassword.statusCode).toBe(401);
    expect(unknownUser.statusCode).toBe(401);
    expect(wrongPassword.json()).toEqual(unknownUser.json());
    expect(wrongPassword.json()).toMatchObject({
      code: "AUTH_INVALID_CREDENTIALS",
      message: "Invalid email or password",
    });
  });

  it("rotates the refresh credential and rejects replay of the previous one", async () => {
    const loginResponse = await login();
    const loginBody = loginResponse.json<LoginResponse>();
    const credentials = readBrowserCredentials(loginResponse);
    const refreshResponse = await server.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      headers: {
        cookie: credentials.cookieHeader,
        [CSRF_TOKEN_HEADER]: credentials.csrfToken,
      },
    });
    const refreshed = refreshResponse.json<LoginResponse>();
    const refreshedCredentials = readBrowserCredentials(refreshResponse);

    expect(refreshResponse.statusCode).toBe(200);
    expect(refreshedCredentials.refreshToken).not.toBe(
      credentials.refreshToken,
    );
    expect(refreshed.accessToken).not.toBe(loginBody.accessToken);

    const replayResponse = await server.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      headers: {
        cookie: credentials.cookieHeader,
        [CSRF_TOKEN_HEADER]: credentials.csrfToken,
      },
    });
    expect(replayResponse.statusCode).toBe(401);
  });

  it("requires a matching CSRF token for cookie-authenticated operations", async () => {
    const loginResponse = await login();
    const credentials = readBrowserCredentials(loginResponse);
    const missingToken = await server.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      headers: { cookie: credentials.cookieHeader },
    });
    const mismatchedToken = await server.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      headers: {
        cookie: credentials.cookieHeader,
        [CSRF_TOKEN_HEADER]: "not-the-cookie-token",
      },
    });

    expect(missingToken.statusCode).toBe(403);
    expect(missingToken.json()).toMatchObject({ code: "CSRF_TOKEN_INVALID" });
    expect(mismatchedToken.statusCode).toBe(403);
    expect(mismatchedToken.json()).toMatchObject({
      code: "CSRF_TOKEN_INVALID",
    });
  });

  it("rejects expired access and refresh credentials", async () => {
    const firstLoginResponse = await login();
    const firstLogin = firstLoginResponse.json<LoginResponse>();
    await new Promise((resolveTimeout) => setTimeout(resolveTimeout, 1_100));

    const expiredAccess = await server.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { authorization: `Bearer ${firstLogin.accessToken}` },
    });
    expect(expiredAccess.statusCode).toBe(401);

    const secondLoginResponse = await login();
    const secondCredentials = readBrowserCredentials(secondLoginResponse);
    await new Promise((resolveTimeout) => setTimeout(resolveTimeout, 20));
    await database
      .update(sessions)
      .set({ expiresAt: new Date() })
      .where(
        eq(
          sessions.id,
          secondCredentials.refreshToken.split(".")[0] ?? "",
        ),
      );

    const expiredRefresh = await server.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      headers: {
        cookie: secondCredentials.cookieHeader,
        [CSRF_TOKEN_HEADER]: secondCredentials.csrfToken,
      },
    });
    expect(expiredRefresh.statusCode).toBe(401);
  });

  it("revokes the session on logout and rejects both credentials afterward", async () => {
    const loginResponse = await login();
    const loginBody = loginResponse.json<LoginResponse>();
    const credentials = readBrowserCredentials(loginResponse);
    const logoutResponse = await server.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      headers: {
        cookie: credentials.cookieHeader,
        [CSRF_TOKEN_HEADER]: credentials.csrfToken,
      },
    });
    expect(logoutResponse.statusCode).toBe(204);
    expect(
      readCookie(logoutResponse, REFRESH_TOKEN_COOKIE).serialized,
    ).toContain("Max-Age=0");
    expect(readCookie(logoutResponse, CSRF_TOKEN_COOKIE).serialized).toContain(
      "Max-Age=0",
    );

    const [persistedSession] = await database
      .select({ revokedAt: sessions.revokedAt })
      .from(sessions)
      .orderBy(asc(sessions.createdAt));
    expect(persistedSession?.revokedAt).toBeInstanceOf(Date);

    const [refreshAfterLogout, accessAfterLogout] = await Promise.all([
      server.inject({
        method: "POST",
        url: "/api/v1/auth/refresh",
        headers: {
          cookie: credentials.cookieHeader,
          [CSRF_TOKEN_HEADER]: credentials.csrfToken,
        },
      }),
      server.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: { authorization: `Bearer ${loginBody.accessToken}` },
      }),
    ]);
    expect(refreshAfterLogout.statusCode).toBe(401);
    expect(accessAfterLogout.statusCode).toBe(401);
  });

  it("invalidates an existing session when the account becomes blocked", async () => {
    const loginResponse = await login();
    const loginBody = loginResponse.json<LoginResponse>();
    const credentials = readBrowserCredentials(loginResponse);
    await database
      .update(users)
      .set({ status: "BLOCKED" })
      .where(eq(users.email, validEmail));

    const [accessResponse, refreshResponse] = await Promise.all([
      server.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: { authorization: `Bearer ${loginBody.accessToken}` },
      }),
      server.inject({
        method: "POST",
        url: "/api/v1/auth/refresh",
        headers: {
          cookie: credentials.cookieHeader,
          [CSRF_TOKEN_HEADER]: credentials.csrfToken,
        },
      }),
    ]);

    expect(accessResponse.statusCode).toBe(401);
    expect(refreshResponse.statusCode).toBe(401);
  });

  it("allows configured origins and rejects other origins before routing", async () => {
    const allowed = await server.inject({
      method: "OPTIONS",
      url: "/api/v1/auth/login",
      headers: {
        origin: "https://storefront.example.com",
        "access-control-request-method": "POST",
      },
    });
    const rejected = await server.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      headers: { origin: "https://attacker.example.com" },
      payload: { email: validEmail, password: validPassword },
    });
    const csrfBootstrap = await server.inject({
      method: "GET",
      url: "/api/v1/auth/csrf",
      headers: { origin: "https://backoffice.example.com" },
    });

    expect(allowed.statusCode).toBe(204);
    expect(allowed.headers["access-control-allow-origin"]).toBe(
      "https://storefront.example.com",
    );
    expect(allowed.headers["access-control-allow-credentials"]).toBe("true");
    expect(rejected.statusCode).toBe(403);
    expect(rejected.json()).toMatchObject({ code: "ORIGIN_FORBIDDEN" });
    expect(csrfBootstrap.statusCode).toBe(200);
    expect(csrfBootstrap.headers["access-control-allow-origin"]).toBe(
      "https://backoffice.example.com",
    );
    expect(csrfBootstrap.headers["access-control-expose-headers"]).toContain(
      "X-CSRF-Token",
    );
    expect(csrfBootstrap.json()).toEqual({
      csrfToken: csrfBootstrap.headers[CSRF_TOKEN_HEADER],
    });
    expect(readCookie(csrfBootstrap, CSRF_TOKEN_COOKIE).value).toBe(
      csrfBootstrap.headers[CSRF_TOKEN_HEADER],
    );
  });

  it("blocks repeated authentication attempts without revealing the account", async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect(
        (await login(validEmail, "repeated-wrong-password")).statusCode,
      ).toBe(401);
    }

    const blocked = await login(validEmail, validPassword);
    expect(blocked.statusCode).toBe(429);
    expect(blocked.json()).toMatchObject({
      code: "AUTH_RATE_LIMITED",
      retryAfterSeconds: expect.any(Number),
    });
    expect(Number(blocked.headers["retry-after"])).toBeGreaterThan(0);
  });
});
