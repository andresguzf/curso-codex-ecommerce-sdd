import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import "dotenv/config";
import { sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  auditEntries,
  roleAssignments,
  sessions,
  users,
} from "../../src/database/schema";
import * as schema from "../../src/database/schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for PostgreSQL integration tests");
}

const testDatabaseName = `ecommerce_identity_${randomUUID().replaceAll("-", "")}`;

if (!/^ecommerce_identity_[a-f0-9]{32}$/.test(testDatabaseName)) {
  throw new Error("Generated an unsafe PostgreSQL test database name");
}

const maintenanceUrl = new URL(databaseUrl);
maintenanceUrl.pathname = "/postgres";

const isolatedDatabaseUrl = new URL(databaseUrl);
isolatedDatabaseUrl.pathname = `/${testDatabaseName}`;

const quotedTestDatabaseName = `"${testDatabaseName}"`;

let maintenancePool: Pool | undefined;
let testPool: Pool | undefined;
let database: NodePgDatabase<typeof schema>;
let isolatedDatabaseCreated = false;

async function insertUser(email: string, displayName: string) {
  const [createdUser] = await database
    .insert(users)
    .values({
      email,
      passwordHash: "integration-test-password-hash",
      displayName,
    })
    .returning({ id: users.id });

  if (!createdUser) {
    throw new Error("PostgreSQL did not return the inserted user");
  }

  return createdUser;
}

describe("identity persistence constraints", () => {
  beforeAll(async () => {
    maintenancePool = new Pool({
      application_name: "technology-ecommerce-api-integration-admin",
      connectionString: maintenanceUrl.toString(),
      max: 1,
    });

    await maintenancePool.query(
      `create database ${quotedTestDatabaseName} template template0`,
    );
    isolatedDatabaseCreated = true;

    testPool = new Pool({
      application_name: "technology-ecommerce-api-integration",
      connectionString: isolatedDatabaseUrl.toString(),
      max: 2,
    });
    database = drizzle({ client: testPool, schema });

    await migrate(database, {
      migrationsFolder: resolve("src/database/migrations"),
      migrationsSchema: "drizzle",
      migrationsTable: "__drizzle_migrations",
    });
  }, 30_000);

  afterAll(async () => {
    await testPool?.end();

    if (maintenancePool && isolatedDatabaseCreated) {
      await maintenancePool.query(
        "select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()",
        [testDatabaseName],
      );
      await maintenancePool.query(
        `drop database ${quotedTestDatabaseName}`,
      );
    }

    await maintenancePool?.end();
  }, 30_000);

  it("enforces case-insensitive unique email addresses", async () => {
    await insertUser("Customer@Example.com", "First customer");

    await expect(
      insertUser("customer@example.com", "Duplicate customer"),
    ).rejects.toMatchObject({
      cause: {
        code: "23505",
        constraint: "users_email_unique",
      },
    });
  });

  it("accepts exactly the three supported roles and one assignment per user", async () => {
    const customer = await insertUser("roles-customer@example.com", "Customer");
    const admin = await insertUser("roles-admin@example.com", "Admin");
    const billing = await insertUser("roles-billing@example.com", "Billing");

    await database.insert(roleAssignments).values([
      { userId: customer.id, role: "CUSTOMER", assignedByUserId: admin.id },
      { userId: admin.id, role: "ADMIN", assignedByUserId: admin.id },
      { userId: billing.id, role: "BILLING", assignedByUserId: admin.id },
    ]);

    const assignedRoles = await database
      .select({ role: roleAssignments.role })
      .from(roleAssignments);

    expect(assignedRoles.map(({ role }) => role).sort()).toEqual([
      "ADMIN",
      "BILLING",
      "CUSTOMER",
    ]);

    await expect(
      database.execute(sql`
        insert into role_assignments (user_id, role)
        values (${randomUUID()}, 'OWNER')
      `),
    ).rejects.toMatchObject({ cause: { code: "22P02" } });

    await expect(
      database.insert(roleAssignments).values({
        userId: customer.id,
        role: "ADMIN",
        assignedByUserId: admin.id,
      }),
    ).rejects.toMatchObject({
      cause: {
        code: "23505",
        constraint: "role_assignments_user_unique",
      },
    });
  });

  it("rejects orphaned sessions, role assignments, and audit actors", async () => {
    const missingUserId = randomUUID();

    await expect(
      database.insert(sessions).values({
        userId: missingUserId,
        tokenHash: "missing-user-session-token-hash",
        expiresAt: new Date(Date.now() + 60_000),
      }),
    ).rejects.toMatchObject({
      cause: {
        code: "23503",
        constraint: "sessions_user_id_users_id_fk",
      },
    });

    await expect(
      database.insert(roleAssignments).values({
        userId: missingUserId,
        role: "CUSTOMER",
      }),
    ).rejects.toMatchObject({
      cause: {
        code: "23503",
        constraint: "role_assignments_user_id_users_id_fk",
      },
    });

    await expect(
      database.insert(auditEntries).values({
        actorUserId: missingUserId,
        action: "USER_CREATED",
        entityType: "user",
        entityId: missingUserId,
      }),
    ).rejects.toMatchObject({
      cause: {
        code: "23503",
        constraint: "audit_entries_actor_user_id_users_id_fk",
      },
    });
  });

  it("stores valid sessions and object-shaped audit changes", async () => {
    const actor = await insertUser("audit-actor@example.com", "Audit actor");

    const [session] = await database
      .insert(sessions)
      .values({
        userId: actor.id,
        tokenHash: "valid-session-token-hash",
        expiresAt: new Date(Date.now() + 60_000),
      })
      .returning({ id: sessions.id });

    const [auditEntry] = await database
      .insert(auditEntries)
      .values({
        actorUserId: actor.id,
        action: "USER_CREATED",
        entityType: "user",
        entityId: actor.id,
        changes: { status: { from: null, to: "ACTIVE" } },
      })
      .returning({ id: auditEntries.id });

    expect(session?.id).toBeTypeOf("string");
    expect(auditEntry?.id).toBeTypeOf("string");

    await expect(
      database.execute(sql`
        insert into audit_entries (action, entity_type, entity_id, changes)
        values ('INVALID_CHANGE', 'user', ${actor.id}, '[]'::jsonb)
      `),
    ).rejects.toMatchObject({
      cause: {
        code: "23514",
        constraint: "audit_entries_changes_is_object",
      },
    });
  });
});
