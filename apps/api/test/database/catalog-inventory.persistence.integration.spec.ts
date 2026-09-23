import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import "dotenv/config";
import { eq } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  categories,
  inventoryBalances,
  inventoryMovements,
  productImages,
  productTags,
  products,
  tags,
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

  it("migrates classifications, slugs and product-tag associations from zero", async () => {
    const [category] = await database.insert(categories).values({
      name: "Portátiles",
      slug: "portatiles",
    }).returning({ id: categories.id });
    const [tag] = await database.insert(tags).values({
      name: "Trabajo remoto",
      slug: "trabajo-remoto",
    }).returning({ id: tags.id });
    if (!category || !tag) throw new Error("Classification insert failed");

    const [product] = await database.insert(products).values({
      sku: "CLASSIFIED-001",
      slug: "portatil-pro",
      categoryId: category.id,
      name: "Portátil Pro",
      description: "Clasificado",
      price: "100.00",
    }).returning({ id: products.id });
    if (!product) throw new Error("Product insert failed");
    await database.insert(productTags).values({ productId: product.id, tagId: tag.id });

    await expect(database.insert(categories).values({ name: "PORTÁTILES", slug: "otro-slug" }))
      .rejects.toMatchObject({ cause: { code: "23505", constraint: "categories_name_unique" } });
    await expect(database.insert(tags).values({ name: "Otra etiqueta", slug: "trabajo-remoto" }))
      .rejects.toMatchObject({ cause: { code: "23505", constraint: "tags_slug_unique" } });
    await expect(database.insert(products).values({
      sku: "CLASSIFIED-002", slug: "portatil-pro", name: "Otro", description: "Otro", price: "1.00",
    })).rejects.toMatchObject({ cause: { code: "23505", constraint: "products_slug_unique" } });
    await expect(database.insert(productTags).values({ productId: product.id, tagId: tag.id }))
      .rejects.toMatchObject({ cause: { code: "23505", constraint: "product_tags_product_tag_unique" } });
    await expect(database.insert(products).values({
      sku: "CLASSIFIED-003", categoryId: randomUUID(), name: "Sin categoría", description: "Otro", price: "1.00",
    })).rejects.toMatchObject({ cause: { code: "23503" } });

    await database.update(categories).set({ status: "INACTIVE", deletedAt: new Date() })
      .where(eq(categories.id, category.id));
    await database.update(tags).set({ status: "INACTIVE", deletedAt: new Date() })
      .where(eq(tags.id, tag.id));
    const [storedProduct] = await database.select().from(products).where(eq(products.id, product.id));
    const [storedTag] = await database.select().from(productTags).where(eq(productTags.productId, product.id));
    expect(storedProduct?.categoryId).toBe(category.id);
    expect(storedTag?.tagId).toBe(tag.id);
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
