import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import "dotenv/config";
import { eq } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  products,
  roleAssignments,
  users,
  wishlistItems,
  wishlists,
} from "../../src/database/schema";
import * as schema from "../../src/database/schema";
import {
  WishlistProductUnavailableError,
  WishlistRepository,
  type WishlistListQuery,
} from "../../src/product-catalog/wishlist.repository";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for wishlist persistence tests");

const testDatabaseName = `ecommerce_wishlist_${randomUUID().replaceAll("-", "")}`;
if (!/^ecommerce_wishlist_[a-f0-9]{32}$/.test(testDatabaseName)) {
  throw new Error("Generated an unsafe PostgreSQL test database name");
}
const quotedDatabaseName = `"${testDatabaseName}"`;
const maintenanceUrl = new URL(databaseUrl);
maintenanceUrl.pathname = "/postgres";
const isolatedUrl = new URL(databaseUrl);
isolatedUrl.pathname = `/${testDatabaseName}`;

let maintenancePool: Pool | undefined;
let testPool: Pool | undefined;
let createdDatabase = false;
let database: NodePgDatabase<typeof schema>;
let repository: WishlistRepository;
let customerA: string;
let customerB: string;
let activeProduct: string;
let laterInactiveProduct: string;

function listQuery(overrides: Partial<WishlistListQuery> = {}): WishlistListQuery {
  return {
    page: 1,
    pageSize: 20,
    sortBy: "createdAt",
    sortOrder: "desc",
    ...overrides,
  };
}

describe("wishlist persistence and ownership", () => {
  beforeAll(async () => {
    maintenancePool = new Pool({ connectionString: maintenanceUrl.toString(), max: 1 });
    await maintenancePool.query(`create database ${quotedDatabaseName} template template0`);
    createdDatabase = true;

    testPool = new Pool({ connectionString: isolatedUrl.toString(), max: 4 });
    database = drizzle({ client: testPool, schema });
    await migrate(database, {
      migrationsFolder: resolve("src/database/migrations"),
      migrationsSchema: "drizzle",
      migrationsTable: "__drizzle_migrations",
    });
    repository = new WishlistRepository({ client: database });

    const customerRows = await database.insert(users).values([
      { email: "wishlist-a@example.com", passwordHash: "integration-test-hash", displayName: "Customer A" },
      { email: "wishlist-b@example.com", passwordHash: "integration-test-hash", displayName: "Customer B" },
    ]).returning({ id: users.id });
    if (!customerRows[0] || !customerRows[1]) throw new Error("Customer fixtures were not created");
    customerA = customerRows[0].id;
    customerB = customerRows[1].id;
    await database.insert(roleAssignments).values([
      { userId: customerA, role: "CUSTOMER" },
      { userId: customerB, role: "CUSTOMER" },
    ]);

    const productRows = await database.insert(products).values([
      { sku: "WISHLIST-ACTIVE", name: "Keyboard", description: "Mechanical keyboard", price: "99.00", status: "ACTIVE" },
      { sku: "WISHLIST-LATER-INACTIVE", name: "Monitor", description: "Display", price: "299.00", status: "ACTIVE" },
    ]).returning({ id: products.id });
    if (!productRows[0] || !productRows[1]) throw new Error("Product fixtures were not created");
    activeProduct = productRows[0].id;
    laterInactiveProduct = productRows[1].id;
  }, 30_000);

  afterAll(async () => {
    await testPool?.end();
    if (maintenancePool && createdDatabase) {
      await maintenancePool.query(
        "select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()",
        [testDatabaseName],
      );
      await maintenancePool.query(`drop database ${quotedDatabaseName}`);
    }
    await maintenancePool?.end();
  }, 30_000);

  it("keeps one wishlist per customer and one row per product, including concurrent additions", async () => {
    const attempts = await Promise.all([
      repository.addItem(customerA, activeProduct),
      repository.addItem(customerA, activeProduct),
    ]);
    expect(attempts.sort()).toEqual([false, true]);
    expect(await repository.addItem(customerA, activeProduct)).toBe(false);
    const ownerLists = await database.select().from(wishlists).where(eq(wishlists.customerId, customerA));
    expect(ownerLists).toHaveLength(1);
    const entries = await database.select().from(wishlistItems).where(eq(wishlistItems.wishlistId, ownerLists[0]!.id));
    expect(entries).toHaveLength(1);
    await expect(database.insert(wishlists).values({ customerId: customerA })).rejects.toMatchObject({
      cause: { code: "23505", constraint: "wishlists_customer_unique" },
    });
    await expect(database.insert(wishlistItems).values({ wishlistId: ownerLists[0]!.id, productId: activeProduct })).rejects.toMatchObject({
      cause: { code: "23505", constraint: "wishlist_items_wishlist_product_unique" },
    });
  });

  it("scopes reads and removal to the supplied customer", async () => {
    expect((await repository.listForCustomer(customerB, listQuery())).items).toEqual([]);
    expect(await repository.removeItem(customerB, activeProduct)).toBe(false);
    expect((await repository.listForCustomer(customerA, listQuery())).items.map((item) => item.productId)).toEqual([activeProduct]);

    expect(await repository.addItem(customerB, activeProduct)).toBe(true);
    expect(await repository.removeItem(customerB, activeProduct)).toBe(true);
    expect((await repository.listForCustomer(customerB, listQuery())).totalItems).toBe(0);
    expect((await repository.listForCustomer(customerA, listQuery())).totalItems).toBe(1);
  });

  it("retains the product reference after deactivation and logical deletion", async () => {
    expect(await repository.addItem(customerA, laterInactiveProduct)).toBe(true);
    await database.update(products).set({ status: "INACTIVE", deletedAt: new Date() })
      .where(eq(products.id, laterInactiveProduct));

    const page = await repository.listForCustomer(customerA, listQuery({ pageSize: 1 }));
    expect(page).toMatchObject({ page: 1, pageSize: 1, totalItems: 2, totalPages: 2 });
    const allItems = await repository.listForCustomer(customerA, listQuery());
    expect(allItems.items.find((item) => item.productId === laterInactiveProduct)).toMatchObject({
      productStatus: "INACTIVE",
      productDeletedAt: expect.any(Date),
      product: { isAvailable: false },
    });
    const filteredPage = await repository.listForCustomer(customerA, listQuery({
      search: "Monitor",
      availability: "UNAVAILABLE",
      page: 2,
      pageSize: 1,
      sortBy: "name",
      sortOrder: "asc",
    }));
    expect(filteredPage).toMatchObject({ page: 2, pageSize: 1, totalItems: 1, totalPages: 1, items: [] });
    await expect(repository.addItem(customerB, laterInactiveProduct)).rejects.toBeInstanceOf(WishlistProductUnavailableError);
    await expect(repository.addItem(customerB, randomUUID())).rejects.toBeInstanceOf(WishlistProductUnavailableError);
    await expect(database.delete(products).where(eq(products.id, laterInactiveProduct))).rejects.toMatchObject({
      cause: { code: "23001", constraint: "wishlist_items_product_id_products_id_fk" },
    });
  });
});
