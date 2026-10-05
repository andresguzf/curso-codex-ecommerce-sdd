import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { readFile } from "node:fs/promises";

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
} from "../../src/database/schema/index.js";
import * as schema from "../../src/database/schema/index.js";

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

  it("stores multiple ordered images with one primary and validated metadata", async () => {
    const product = await insertProduct("GALLERY-001");
    const [cover] = await database.insert(productImages).values({ productId: product.id,
      storageKey: "gallery/cover", url: "/cover.webp", altText: "Vista frontal del monitor",
      width: 1200, height: 800, mimeType: "image/webp" }).returning();
    await database.insert(productImages).values({ productId: product.id,
      storageKey: "gallery/back", url: "/back.webp", altText: "Puertos del monitor", isPrimary: false, sortOrder: 1 });
    expect(cover).toMatchObject({ isPrimary: true, sortOrder: 0, width: 1200, height: 800, mimeType: "image/webp" });
    await expect(database.insert(productImages).values({ productId: product.id,
      storageKey: "gallery/duplicate-cover", url: "/other.webp", sortOrder: 2 })).rejects.toMatchObject({
        cause: { code: "23505", constraint: "product_images_primary_unique" },
      });
    await expect(database.insert(productImages).values({ productId: product.id,
      storageKey: "gallery/duplicate-order", url: "/other.webp", isPrimary: false, sortOrder: 1 })).rejects.toMatchObject({
        cause: { code: "23505", constraint: "product_images_product_order_unique" },
      });
    for (const [values, constraint] of [
      [{ sortOrder: -1 }, "product_images_sort_order_non_negative"],
      [{ altText: "  " }, "product_images_alt_text_not_blank"],
      [{ width: 0 }, "product_images_width_positive"],
      [{ height: -1 }, "product_images_height_positive"],
      [{ mimeType: "text/html" }, "product_images_mime_type_image"],
    ] as const) {
      await expect(database.insert(productImages).values({ productId: product.id,
        storageKey: `gallery/invalid-${constraint}`, url: "/other.webp", isPrimary: false, sortOrder: 3, ...values,
      })).rejects.toMatchObject({ cause: { code: "23514", constraint } });
    }
  });

  it("rejects creating or activating an active product without a primary image", async () => {
    await expect(database.insert(products).values({ sku: "MISSING-COVER", name: "Sin portada", description: "Prueba",
      price: "1.00", status: "ACTIVE" })).rejects.toMatchObject({ cause: { code: "23514", constraint: "products_active_primary_image_required" } });
    const product = await insertProduct("ONLY-GALLERY");
    await database.insert(productImages).values({ productId: product.id, storageKey: "gallery/only", url: "/only.webp", isPrimary: false });
    await expect(database.update(products).set({ status: "ACTIVE" }).where(eq(products.id, product.id)))
      .rejects.toMatchObject({ cause: { code: "23514", constraint: "products_active_primary_image_required" } });
  });

  it("preserves a cover at commit and permits an atomic cover replacement", async () => {
    const product = await insertProduct("SWAP-COVER");
    const [first] = await database.insert(productImages).values({ productId: product.id, storageKey: "swap/first", url: "/first.webp" }).returning();
    const [second] = await database.insert(productImages).values({ productId: product.id, storageKey: "swap/second", url: "/second.webp", isPrimary: false, sortOrder: 1 }).returning();
    await database.update(products).set({ status: "ACTIVE" }).where(eq(products.id, product.id));
    await expect(database.delete(productImages).where(eq(productImages.id, first!.id)))
      .rejects.toMatchObject({ cause: { constraint: "products_active_primary_image_required" } });
    await expect(database.update(productImages).set({ isPrimary: false }).where(eq(productImages.id, first!.id)))
      .rejects.toMatchObject({ cause: { constraint: "products_active_primary_image_required" } });
    await database.transaction(async (tx) => {
      await tx.update(productImages).set({ isPrimary: false }).where(eq(productImages.id, first!.id));
      await tx.update(productImages).set({ isPrimary: true }).where(eq(productImages.id, second!.id));
    });
    const rows = await database.select().from(productImages).where(eq(productImages.productId, product.id));
    expect(rows.filter((image) => image.isPrimary).map((image) => image.id)).toEqual([second!.id]);
    const other = await insertProduct("TRANSFER-COVER");
    await expect(database.update(productImages).set({ productId: other.id }).where(eq(productImages.id, second!.id)))
      .rejects.toMatchObject({ cause: { constraint: "products_active_primary_image_required" } });
    // Inactive products may be edited without a cover; cascading deletion remains valid.
    await database.transaction(async (tx) => {
      await tx.update(products).set({ status: "INACTIVE" }).where(eq(products.id, product.id));
      await tx.delete(productImages).where(eq(productImages.productId, product.id));
    });
    await database.delete(products).where(eq(products.id, product.id));
  });

  it("permits parent deletion to cascade without a spurious missing-cover failure", async () => {
    const product = await insertProduct("CASCADE-COVER");
    await database.insert(productImages).values({ productId: product.id, storageKey: "cascade/cover", url: "/cover.webp" });
    await database.update(products).set({ status: "ACTIVE" }).where(eq(products.id, product.id));
    await database.delete(products).where(eq(products.id, product.id));
    expect(await database.select().from(productImages).where(eq(productImages.productId, product.id))).toEqual([]);
  });

  it("serializes concurrent activation and cover deletion without invalid active products", async () => {
    const product = await insertProduct("CONCURRENT-COVER");
    await database.insert(productImages).values({ productId: product.id, storageKey: "concurrent/cover", url: "/cover.webp" });
    const results = await Promise.allSettled([
      database.update(products).set({ status: "ACTIVE" }).where(eq(products.id, product.id)),
      database.delete(productImages).where(eq(productImages.productId, product.id)),
    ]);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    const [stored] = await database.select().from(products).where(eq(products.id, product.id));
    const images = await database.select().from(productImages).where(eq(productImages.productId, product.id));
    expect(stored?.status !== "ACTIVE" || images.some((image) => image.isPrimary)).toBe(true);
  });

  it("migrates legacy images without losing data and supplies missing active covers", async () => {
    const legacyName = `ecommerce_catalog_${randomUUID().replaceAll("-", "")}`;
    const url = new URL(databaseUrl!); url.pathname = `/${legacyName}`;
    const pool = new Pool({ connectionString: url.toString(), max: 1 });
    await maintenancePool!.query(`create database "${legacyName}" template template0`);
    try {
      const folder = resolve("src/database/migrations");
      const journal = JSON.parse(await readFile(resolve(folder, "meta/_journal.json"), "utf8")) as { entries: { tag: string }[] };
      const imageMigrationIndex = journal.entries.findIndex((entry) => entry.tag === "0013_lucky_the_watchers");
      if (imageMigrationIndex < 0) throw new Error("Product image migration missing from journal");
      for (const entry of journal.entries.slice(0, imageMigrationIndex)) {
        for (const statement of (await readFile(resolve(folder, `${entry.tag}.sql`), "utf8")).split("--> statement-breakpoint")) await pool.query(statement);
      }
      const original = await pool.query("insert into products (sku,name,description,price,status) values ('LEGACY-COVER','Monitor histórico','Demo',10,'ACTIVE'), ('LEGACY-MISSING','Sin imagen','Demo',20,'ACTIVE') returning id,sku");
      const id = original.rows.find((row) => row.sku === "LEGACY-COVER").id;
      await pool.query("insert into product_images (product_id,storage_key,url) values ($1,'legacy/original','/original.webp')", [id]);
      for (const statement of (await readFile(resolve(folder, `${journal.entries[imageMigrationIndex]!.tag}.sql`), "utf8")).split("--> statement-breakpoint")) await pool.query(statement);
      const migrated = await pool.query("select * from product_images where product_id=$1", [id]);
      expect(migrated.rows[0]).toMatchObject({ storage_key: "legacy/original", url: "/original.webp", alt_text: "Monitor histórico", is_primary: true, sort_order: 0, width: null, height: null, mime_type: null });
      expect((await pool.query("select count(*)::int as total from product_images where is_primary")).rows[0].total).toBe(2);
    } finally {
      await pool.end();
      await maintenancePool!.query(`drop database "${legacyName}"`);
    }
  }, 30_000);
});
