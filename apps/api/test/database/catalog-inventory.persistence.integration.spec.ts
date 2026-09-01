import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import "dotenv/config";
import { eq } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  inventoryBalances,
  inventoryMovements,
  productImages,
  products,
  users,
} from "../../src/database/schema";
import * as schema from "../../src/database/schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for PostgreSQL integration tests");
}

const testDatabaseName = `ecommerce_catalog_${randomUUID().replaceAll("-", "")}`;

if (!/^ecommerce_catalog_[a-f0-9]{32}$/.test(testDatabaseName)) {
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

async function insertProduct(sku: string, price = "999.90") {
  const [createdProduct] = await database
    .insert(products)
    .values({
      sku,
      name: `Product ${sku}`,
      description: `Technology product identified by ${sku}`,
      price,
      currency: "USD",
    })
    .returning({ id: products.id });

  if (!createdProduct) {
    throw new Error("PostgreSQL did not return the inserted product");
  }

  return createdProduct;
}

describe("catalog and inventory persistence constraints", () => {
  beforeAll(async () => {
    maintenancePool = new Pool({
      application_name: "technology-ecommerce-catalog-test-admin",
      connectionString: maintenanceUrl.toString(),
      max: 1,
    });

    await maintenancePool.query(
      `create database ${quotedTestDatabaseName} template template0`,
    );
    isolatedDatabaseCreated = true;

    testPool = new Pool({
      application_name: "technology-ecommerce-catalog-test",
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

  it("enforces case-insensitive unique product SKUs", async () => {
    await insertProduct("TECH-001");

    await expect(insertProduct("tech-001")).rejects.toMatchObject({
      cause: {
        code: "23505",
        constraint: "products_sku_unique",
      },
    });
  });

  it("accepts zero-priced products and rejects negative prices", async () => {
    const freeProduct = await insertProduct("FREE-001", "0.00");

    expect(freeProduct.id).toBeTypeOf("string");

    await expect(insertProduct("INVALID-PRICE", "-0.01")).rejects.toMatchObject({
      cause: {
        code: "23514",
        constraint: "products_price_non_negative",
      },
    });
  });

  it("prevents inventory balances from becoming negative", async () => {
    const product = await insertProduct("BALANCE-001");

    await expect(
      database.insert(inventoryBalances).values({
        productId: product.id,
        availableQuantity: -1,
      }),
    ).rejects.toMatchObject({
      cause: {
        code: "23514",
        constraint: "inventory_balances_quantity_non_negative",
      },
    });

    await database.insert(inventoryBalances).values({
      productId: product.id,
      availableQuantity: 0,
    });

    await expect(
      database
        .update(inventoryBalances)
        .set({ availableQuantity: -1 })
        .where(eq(inventoryBalances.productId, product.id)),
    ).rejects.toMatchObject({
      cause: {
        code: "23514",
        constraint: "inventory_balances_quantity_non_negative",
      },
    });
  });

  it("persists product images and auditable inventory movements", async () => {
    const product = await insertProduct("INVENTORY-001");
    const [actor] = await database
      .insert(users)
      .values({
        email: "inventory-actor@example.com",
        passwordHash: "integration-test-password-hash",
        displayName: "Inventory actor",
      })
      .returning({ id: users.id });

    if (!actor) {
      throw new Error("PostgreSQL did not return the inventory actor");
    }

    const [image] = await database
      .insert(productImages)
      .values({
        productId: product.id,
        storageKey: "products/inventory-001/cover.webp",
        url: "/media/products/inventory-001/cover.webp",
      })
      .returning({ id: productImages.id });

    await database.insert(inventoryBalances).values({
      productId: product.id,
      availableQuantity: 5,
    });

    const [movement] = await database
      .insert(inventoryMovements)
      .values({
        productId: product.id,
        type: "OPENING",
        quantityDelta: 5,
        balanceAfter: 5,
        reason: "Initial test inventory",
        actorUserId: actor.id,
      })
      .returning({ id: inventoryMovements.id });

    expect(image?.id).toBeTypeOf("string");
    expect(movement?.id).toBeTypeOf("string");

    await expect(
      database.insert(inventoryMovements).values({
        productId: product.id,
        type: "ADJUSTMENT",
        quantityDelta: 0,
        balanceAfter: 5,
        reason: "Invalid empty adjustment",
        actorUserId: actor.id,
      }),
    ).rejects.toMatchObject({
      cause: {
        code: "23514",
        constraint: "inventory_movements_quantity_non_zero",
      },
    });
  });
});
