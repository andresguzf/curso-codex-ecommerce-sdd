import { randomUUID } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { runDatabaseMigrations } from "../../src/database/migration-runner.js";
import { categories, products } from "../../src/database/schema/index.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for PostgreSQL integration tests");

const databaseName = `ecommerce_editorial_${randomUUID().replaceAll("-", "")}`;
if (!/^ecommerce_editorial_[a-f0-9]{32}$/.test(databaseName)) {
  throw new Error("Generated an unsafe PostgreSQL test database name");
}
const maintenanceUrl = new URL(databaseUrl);
maintenanceUrl.pathname = "/postgres";
const isolatedUrl = new URL(databaseUrl);
isolatedUrl.pathname = `/${databaseName}`;
const migrationsFolder = resolve("src/database/migrations");
const legacyCategoryId = randomUUID();
const legacyProductId = randomUUID();
let maintenancePool: Pool | undefined;
let pool: Pool;
let created = false;
let previousMigrationsFolder: string | undefined;
let legacySnapshot: unknown;

async function catalogSnapshot() {
  const result = await pool.query(`select jsonb_build_object(
    'product', (select to_jsonb(p) - 'is_featured' - 'featured_at' from products p where id = $1),
    'category', (select to_jsonb(c) - 'show_on_landing' - 'landing_order' from categories c where id = $2),
    'images', (select jsonb_agg(i order by sort_order) from product_images i where product_id = $1),
    'balance', (select to_jsonb(b) from inventory_balances b where product_id = $1),
    'tags', (select jsonb_agg(t) from product_tags t where product_id = $1)
  ) as snapshot`, [legacyProductId, legacyCategoryId]);
  return result.rows[0].snapshot as unknown;
}

async function createCategory(name: string) {
  const result = await pool.query<{ id: string }>(
    "insert into categories (name, slug) values ($1, $1) returning id", [name],
  );
  return result.rows[0]!.id;
}

describe("catalog editorial persistence (21.1)", () => {
  beforeAll(async () => {
    maintenancePool = new Pool({ connectionString: maintenanceUrl.toString(), max: 1 });
    await maintenancePool.query(`create database "${databaseName}" template template0`);
    created = true;
    pool = new Pool({ connectionString: isolatedUrl.toString(), max: 3 });

    // Reconstruct the actual schema immediately before 21.1, including its migration history.
    const journal = JSON.parse(await readFile(join(migrationsFolder, "meta/_journal.json"), "utf8")) as {
      entries: { tag: string; idx: number }[];
      dialect: string;
      version: string;
    };
    const targetIndex = journal.entries.findIndex((entry) => entry.tag === "0014_catalog_editorial_fields");
    if (targetIndex < 0) throw new Error("Editorial migration missing from journal");
    previousMigrationsFolder = await mkdtemp(join(tmpdir(), "ecommerce-editorial-migrations-"));
    await mkdir(join(previousMigrationsFolder, "meta"));
    const previousEntries = journal.entries.slice(0, targetIndex);
    await writeFile(join(previousMigrationsFolder, "meta/_journal.json"), JSON.stringify({ ...journal, entries: previousEntries }));
    for (const entry of previousEntries) {
      await copyFile(join(migrationsFolder, `${entry.tag}.sql`), join(previousMigrationsFolder, `${entry.tag}.sql`));
    }
    await runDatabaseMigrations({ databaseUrl: isolatedUrl.toString(), migrationsFolder: previousMigrationsFolder });

    const priorColumns = await pool.query("select column_name from information_schema.columns where table_name in ('products', 'categories') and column_name in ('is_featured', 'featured_at', 'show_on_landing', 'landing_order')");
    expect(priorColumns.rows).toEqual([]);
    await pool.query("insert into categories (id, name, slug) values ($1, 'legacy-category', 'legacy-category')", [legacyCategoryId]);
    await pool.query(`insert into products (id, sku, slug, category_id, name, description, price, created_at)
      values ($1, 'LEGACY-EDITORIAL', 'legacy-editorial', $2, 'Teclado de ejemplo', 'Conservar catálogo', '39.99', '2026-01-01T10:30:00Z')`, [legacyProductId, legacyCategoryId]);
    await pool.query(`insert into product_images (product_id, storage_key, url, alt_text)
      values ($1, 'legacy/keyboard', '/images/product-placeholder.svg', 'Teclado')`, [legacyProductId]);
    await pool.query("insert into inventory_balances (product_id, available_quantity) values ($1, 7)", [legacyProductId]);
    const tag = await pool.query<{ id: string }>("insert into tags (name, slug) values ('legacy-tag', 'legacy-tag') returning id");
    await pool.query("insert into product_tags (product_id, tag_id) values ($1, $2)", [legacyProductId, tag.rows[0]!.id]);
    legacySnapshot = await catalogSnapshot();

    await runDatabaseMigrations({ databaseUrl: isolatedUrl.toString(), migrationsFolder });
  }, 30_000);

  beforeEach(async () => {
    await pool.query("update categories set show_on_landing = false, landing_order = null");
  });

  afterAll(async () => {
    await pool?.end();
    if (maintenancePool && created) {
      await maintenancePool.query("select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()", [databaseName]);
      await maintenancePool.query(`drop database "${databaseName}"`);
    }
    await maintenancePool?.end();
    if (previousMigrationsFolder) await rm(previousMigrationsFolder, { recursive: true, force: true });
  }, 30_000);

  it("upgrades an existing catalog without changing data or associations and can run again", async () => {
    expect(await catalogSnapshot()).toEqual(legacySnapshot);
    const product = await pool.query("select is_featured, featured_at from products where id = $1", [legacyProductId]);
    const category = await pool.query("select show_on_landing, landing_order from categories where id = $1", [legacyCategoryId]);
    expect(product.rows[0]).toEqual({ is_featured: false, featured_at: null });
    expect(category.rows[0]).toEqual({ show_on_landing: false, landing_order: null });
    const before = await pool.query("select count(*)::int as count from drizzle.__drizzle_migrations");
    await runDatabaseMigrations({ databaseUrl: isolatedUrl.toString(), migrationsFolder });
    expect((await pool.query("select count(*)::int as count from drizzle.__drizzle_migrations")).rows).toEqual(before.rows);
    expect(await catalogSnapshot()).toEqual(legacySnapshot);
  });

  it("defaults new ORM products and categories to unselected", async () => {
    const database = drizzle(pool);
    const [product] = await database.insert(products).values({ sku: "DEFAULT-EDITORIAL", name: "Monitor", description: "Demo", price: "99.00" }).returning();
    const [category] = await database.insert(categories).values({ name: "default-category", slug: "default-category" }).returning();
    expect(product).toMatchObject({ isFeatured: false, featuredAt: null });
    expect(category).toMatchObject({ showOnLanding: false, landingOrder: null });
  });

  it("requires a timestamp for a featured product and stores its timezone correctly", async () => {
    await expect(pool.query("update products set is_featured = true where id = $1", [legacyProductId]))
      .rejects.toMatchObject({ code: "23514", constraint: "products_featured_timestamp_required" });
    await expect(pool.query("update products set is_featured = null where id = $1", [legacyProductId]))
      .rejects.toMatchObject({ code: "23502" });
    const result = await pool.query<{ featured_at: Date }>(`update products set is_featured = true, featured_at = '2026-10-01T09:30:00-03:00'
      where id = $1 returning featured_at`, [legacyProductId]);
    expect(result.rows[0]!.featured_at.toISOString()).toBe("2026-10-01T12:30:00.000Z");
    await pool.query("update products set status = 'INACTIVE', deleted_at = now() where id = $1", [legacyProductId]);
    expect((await pool.query("select is_featured from products where id = $1", [legacyProductId])).rows[0]).toEqual({ is_featured: true });
    // Removing the flag permits retaining the historical timestamp or clearing it.
    await pool.query("update products set is_featured = false where id = $1", [legacyProductId]);
    await pool.query("update products set featured_at = null where id = $1", [legacyProductId]);
  });

  it.each([null, -1, 0, 4])("rejects selected category position %s", async (position) => {
    await expect(pool.query("update categories set show_on_landing = true, landing_order = $2 where id = $1", [legacyCategoryId, position]))
      .rejects.toMatchObject({ code: "23514", constraint: "categories_landing_selection_consistent" });
  });

  it("requires unselected categories to have no position and rejects a null flag", async () => {
    await expect(pool.query("update categories set landing_order = 1 where id = $1", [legacyCategoryId]))
      .rejects.toMatchObject({ code: "23514", constraint: "categories_landing_selection_consistent" });
    await expect(pool.query("update categories set show_on_landing = null where id = $1", [legacyCategoryId]))
      .rejects.toMatchObject({ code: "23502" });
  });

  it("allows exactly three distinct slots, rejects a fourth selection, and releases a removed slot", async () => {
    const ids = await Promise.all([1, 2, 3, 4].map((n) => createCategory(`slots-${n}`)));
    for (const [index, id] of ids.slice(0, 3).entries()) {
      await pool.query("update categories set show_on_landing = true, landing_order = $2 where id = $1", [id, index + 1]);
    }
    for (const position of [1, 2, 3]) {
      await expect(pool.query("update categories set show_on_landing = true, landing_order = $2 where id = $1", [ids[3], position]))
        .rejects.toMatchObject({ code: "23505", constraint: "categories_landing_order_unique" });
    }
    expect((await pool.query("select landing_order from categories where show_on_landing order by landing_order")).rows)
      .toEqual([{ landing_order: 1 }, { landing_order: 2 }, { landing_order: 3 }]);
    await pool.query("update categories set status = 'INACTIVE', deleted_at = now() where id = $1", [ids[0]]);
    expect((await pool.query("select show_on_landing, landing_order from categories where id = $1", [ids[0]])).rows[0])
      .toEqual({ show_on_landing: true, landing_order: 1 });
    await pool.query("update categories set show_on_landing = false, landing_order = null where id = $1", [ids[0]]);
    await pool.query("update categories set show_on_landing = true, landing_order = 1 where id = $1", [ids[3]]);
  });

  it("prevents concurrent categories from claiming the same slot", async () => {
    const ids = await Promise.all(["concurrent-one", "concurrent-two"].map(createCategory));
    const results = await Promise.allSettled(ids.map((id) => pool.query(
      "update categories set show_on_landing = true, landing_order = 2 where id = $1", [id],
    )));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find((result) => result.status === "rejected")).toMatchObject({
      status: "rejected", reason: { code: "23505", constraint: "categories_landing_order_unique" },
    });
  });

  it("creates partial public indexes and the unique selected-category index", async () => {
    const result = await pool.query<{ indexname: string; indexdef: string }>(`select indexname, indexdef from pg_indexes
      where schemaname = 'public' and indexname in ('categories_landing_order_unique', 'products_public_featured_idx', 'products_public_recent_idx')`);
    expect(result.rows).toHaveLength(3);
    const indexes = Object.fromEntries(result.rows.map((row) => [row.indexname, row.indexdef]));
    expect(indexes.categories_landing_order_unique).toContain("UNIQUE INDEX");
    expect(indexes.categories_landing_order_unique).toContain("show_on_landing = true");
    expect(indexes.products_public_featured_idx).toContain("is_featured, featured_at DESC NULLS LAST, id DESC NULLS LAST");
    for (const name of ["products_public_featured_idx", "products_public_recent_idx"]) {
      expect(indexes[name]).toContain("status = 'ACTIVE'");
      expect(indexes[name]).toContain("deleted_at IS NULL");
    }
  });
});
