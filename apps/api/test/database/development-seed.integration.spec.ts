import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import "dotenv/config";
import { asc, eq, sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  inventoryBalances,
  inventoryMovements,
  productImages,
  products,
  roleAssignments,
  users,
} from "../../src/database/schema";
import * as schema from "../../src/database/schema";
import {
  runDevelopmentSeed,
  type SeedAccount,
} from "../../src/database/seed/development-seed";
import { verifySeedPassword } from "../../src/database/seed/password";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for PostgreSQL integration tests");
}

const testDatabaseName = `ecommerce_seed_${randomUUID().replaceAll("-", "")}`;

if (!/^ecommerce_seed_[a-f0-9]{32}$/.test(testDatabaseName)) {
  throw new Error("Generated an unsafe PostgreSQL test database name");
}

const maintenanceUrl = new URL(databaseUrl);
maintenanceUrl.pathname = "/postgres";

const isolatedDatabaseUrl = new URL(databaseUrl);
isolatedDatabaseUrl.pathname = `/${testDatabaseName}`;

const quotedTestDatabaseName = `"${testDatabaseName}"`;

const seedAccounts = [
  {
    role: "ADMIN",
    email: "seed-admin@example.com",
    password: "SeedAdminPassword123!",
    displayName: "Seed administrator",
  },
  {
    role: "BILLING",
    email: "seed-billing@example.com",
    password: "SeedBillingPassword123!",
    displayName: "Seed billing manager",
  },
  {
    role: "CUSTOMER",
    email: "seed-customer@example.com",
    password: "SeedCustomerPassword123!",
    displayName: "Seed customer",
  },
] as const satisfies readonly SeedAccount[];

let maintenancePool: Pool | undefined;
let testPool: Pool | undefined;
let database: NodePgDatabase<typeof schema>;
let isolatedDatabaseCreated = false;

async function readSeedCounts() {
  const [userCount, roleCount, productCount, imageCount, balanceCount, movementCount] =
    await Promise.all([
      database.select({ count: sql<number>`count(*)::int` }).from(users),
      database
        .select({ count: sql<number>`count(*)::int` })
        .from(roleAssignments),
      database.select({ count: sql<number>`count(*)::int` }).from(products),
      database
        .select({ count: sql<number>`count(*)::int` })
        .from(productImages),
      database
        .select({ count: sql<number>`count(*)::int` })
        .from(inventoryBalances),
      database
        .select({ count: sql<number>`count(*)::int` })
        .from(inventoryMovements),
    ]);

  return {
    users: userCount[0]?.count,
    roleAssignments: roleCount[0]?.count,
    products: productCount[0]?.count,
    productImages: imageCount[0]?.count,
    inventoryBalances: balanceCount[0]?.count,
    inventoryMovements: movementCount[0]?.count,
  };
}

describe("development database seed", () => {
  beforeAll(async () => {
    maintenancePool = new Pool({
      application_name: "technology-ecommerce-seed-test-admin",
      connectionString: maintenanceUrl.toString(),
      max: 1,
    });

    await maintenancePool.query(
      `create database ${quotedTestDatabaseName} template template0`,
    );
    isolatedDatabaseCreated = true;

    testPool = new Pool({
      application_name: "technology-ecommerce-seed-test",
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

  it("creates all roles, an administrator, and catalog data without duplicates", async () => {
    const options = {
      accounts: seedAccounts,
      databaseUrl: isolatedDatabaseUrl.toString(),
      environment: "test" as const,
    };
    const firstResult = await runDevelopmentSeed(options);
    const firstUsers = await database
      .select({
        id: users.id,
        email: users.email,
        passwordHash: users.passwordHash,
      })
      .from(users)
      .orderBy(asc(users.email));
    const firstProducts = await database
      .select({ id: products.id, sku: products.sku })
      .from(products)
      .orderBy(asc(products.sku));
    const firstProductImages = await database
      .select({
        sku: products.sku,
        storageKey: productImages.storageKey,
        url: productImages.url,
      })
      .from(productImages)
      .innerJoin(products, eq(products.id, productImages.productId))
      .orderBy(asc(products.sku));

    expect(firstResult).toEqual({
      users: 3,
      roleAssignments: 3,
      products: 3,
      productImages: 3,
      inventoryBalances: 3,
      inventoryMovements: 3,
    });
    expect(await readSeedCounts()).toEqual(firstResult);
    expect(firstProductImages).toEqual([
      {
        sku: "DEV-KEYBOARD-001",
        storageKey: "development/products/dev-keyboard-001/cover.webp",
        url: "https://picsum.photos/id/2/1200/900.webp",
      },
      {
        sku: "DEV-LAPTOP-001",
        storageKey: "development/products/dev-laptop-001/cover.webp",
        url: "https://picsum.photos/id/0/1200/900.webp",
      },
      {
        sku: "DEV-MONITOR-001",
        storageKey: "development/products/dev-monitor-001/cover.webp",
        url: "https://picsum.photos/id/60/1200/900.webp",
      },
    ]);

    const assignedRoles = await database
      .select({ role: roleAssignments.role })
      .from(roleAssignments)
      .orderBy(asc(roleAssignments.role));

    expect(assignedRoles.map(({ role }) => role).sort()).toEqual([
      "ADMIN",
      "BILLING",
      "CUSTOMER",
    ]);

    for (const seededUser of firstUsers) {
      const account = seedAccounts.find(
        ({ email }) => email === seededUser.email,
      );

      expect(account).toBeDefined();
      expect(seededUser.passwordHash).not.toBe(account?.password);
      expect(
        await verifySeedPassword(account?.password ?? "", seededUser.passwordHash),
      ).toBe(true);
    }

    const secondResult = await runDevelopmentSeed(options);
    const secondUsers = await database
      .select({
        id: users.id,
        email: users.email,
        passwordHash: users.passwordHash,
      })
      .from(users)
      .orderBy(asc(users.email));
    const secondProducts = await database
      .select({ id: products.id, sku: products.sku })
      .from(products)
      .orderBy(asc(products.sku));

    expect(secondResult).toEqual(firstResult);
    expect(await readSeedCounts()).toEqual(firstResult);
    expect(secondUsers).toEqual(firstUsers);
    expect(secondProducts).toEqual(firstProducts);
  }, 30_000);

  it("rejects production before changing persisted data", async () => {
    const countsBefore = await readSeedCounts();

    await expect(
      runDevelopmentSeed({
        accounts: seedAccounts,
        databaseUrl: isolatedDatabaseUrl.toString(),
        environment: "production",
      }),
    ).rejects.toThrow("Development seed is disabled in production");

    expect(await readSeedCounts()).toEqual(countsBefore);
  });
});
