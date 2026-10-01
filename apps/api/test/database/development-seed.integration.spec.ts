import { randomUUID, scryptSync } from "node:crypto";
import { resolve } from "node:path";

import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import type { FastifyInstance } from "fastify";
import { asc, eq, sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  categories,
  tags,
  productTags,
  inventoryBalances,
  inventoryMovements,
  productImages,
  products,
  roleAssignments,
  storeProfiles,
  users,
} from "../../src/database/schema";
import * as schema from "../../src/database/schema";
import {
  runDevelopmentSeed,
  type SeedAccount,
} from "../../src/database/seed/development-seed";
import { getDevelopmentProductImageManifest } from "../../src/database/seed/product-image-manifest";
import { verifySeedPassword } from "../../src/database/seed/password";
import { insertProductFixtures } from "../product-fixtures";
import { configureApplication } from "../../src/application";

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
let app: NestFastifyApplication | undefined;
let server: FastifyInstance;
const environmentKeys = ["NODE_ENV", "DATABASE_URL", "AUTH_ACCESS_TOKEN_SECRET", "AUTH_COOKIE_SECURE", "CORS_ALLOWED_ORIGINS"] as const;
const originalEnvironment = Object.fromEntries(environmentKeys.map((key) => [key, process.env[key]]));

async function readSeedCounts() {
  const [userCount, roleCount, productCount, imageCount, balanceCount, movementCount, storeProfileCount] =
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
      database
        .select({ count: sql<number>`count(*)::int` })
        .from(storeProfiles),
    ]);

  const [categoryCount, tagCount, productTagCount] = await Promise.all([
    database.select({ count: sql<number>`count(*)::int` }).from(categories),
    database.select({ count: sql<number>`count(*)::int` }).from(tags),
    database.select({ count: sql<number>`count(*)::int` }).from(productTags),
  ]);
  return {
    categories: categoryCount[0]?.count,
    tags: tagCount[0]?.count,
    productTags: productTagCount[0]?.count,
    users: userCount[0]?.count,
    roleAssignments: roleCount[0]?.count,
    products: productCount[0]?.count,
    productImages: imageCount[0]?.count,
    inventoryBalances: balanceCount[0]?.count,
    inventoryMovements: movementCount[0]?.count,
    storeProfiles: storeProfileCount[0]?.count,
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
    process.env.NODE_ENV = "test";
    process.env.DATABASE_URL = isolatedDatabaseUrl.toString();
    process.env.AUTH_ACCESS_TOKEN_SECRET = "isolated-seed-authentication-test-secret-at-least-32-characters";
    process.env.AUTH_COOKIE_SECURE = "false";
    process.env.CORS_ALLOWED_ORIGINS = "http://localhost:3000,http://localhost:3002";
    const { AppModule } = await import("../../src/app.module");
    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), { logger: false });
    configureApplication(app);
    await app.init();
    server = app.getHttpAdapter().getInstance() as FastifyInstance;
    await server.ready();
  }, 30_000);

  afterAll(async () => {
    await app?.close();
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
    for (const key of environmentKeys) {
      const value = originalEnvironment[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }, 30_000);

  it("creates all roles, an administrator, and catalog data without duplicates", async () => {
    // Reproduce the earlier three-product seed, then upgrade without changing its IDs.
    const legacySkus = ["DEV-LAPTOP-001", "DEV-MONITOR-001", "DEV-KEYBOARD-001"];
    const legacyProducts = await insertProductFixtures(database, legacySkus.map((sku) => ({
      sku, name: sku, description: "Legacy demo product", price: "100.00", currency: "USD", status: "ACTIVE",
    })), (product) => ({
      storageKey: `development/products/${product.sku.toLowerCase()}/cover.webp`,
      url: "https://picsum.photos/id/2/1200/900.webp",
    }));
    for (const product of legacyProducts) {
      const quantity = product.sku.includes("LAPTOP") ? 12 : product.sku.includes("MONITOR") ? 8 : 20;
      await database.transaction(async (transaction) => {
        await transaction.insert(inventoryBalances).values({ productId: product.id, availableQuantity: quantity });
        await transaction.insert(inventoryMovements).values({
          productId: product.id, type: "OPENING", quantityDelta: quantity, balanceAfter: quantity,
          reason: "Legacy development opening", referenceType: "DEVELOPMENT_SEED", referenceId: product.sku,
        });
      });
    }
    const legacyImages = await database.select().from(productImages);
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
      .orderBy(asc(products.sku), asc(productImages.storageKey));

    expect(firstResult).toEqual({
      users: 3,
      roleAssignments: 3,
      categories: 4,
      tags: 2,
      productTags: 40,
      products: 20,
      productImages: 60,
      inventoryBalances: 20,
      inventoryMovements: 17,
      storeProfiles: 1,
    });
    expect(await readSeedCounts()).toEqual({ ...firstResult, inventoryMovements: 20 });
    for (const product of legacyProducts) {
      expect(firstProducts.find((row) => row.sku === product.sku)?.id).toBe(product.id);
    }
    for (const image of legacyImages) {
      const [updatedImage] = await database.select().from(productImages).where(eq(productImages.storageKey, image.storageKey));
      expect(updatedImage?.id).toBe(image.id);
    }
    const [seededStoreProfile] = await database.select().from(storeProfiles);
    expect(seededStoreProfile).toMatchObject({
      id: 1,
      tradeName: "DEMO - Nexo Tech",
      legalName: "DEMO - Nexo Tecnología Sociedad Ficticia",
      taxIdentifier: "DEMO-NO-VALIDO",
      addressLine1: "DEMO - Calle Ejemplo 123",
      addressCity: "DEMO - Ciudad Ejemplo",
      addressCountryCode: "CL",
      contactEmail: "demo@example.invalid",
      logoStorageKey: null,
      logoUrl: null,
      logoSha256: null,
    });
    const manifest = getDevelopmentProductImageManifest("test");
    expect(firstProductImages).toEqual(manifest.flatMap((entry) =>
      entry.images.map((image) => ({ sku: entry.sku, storageKey: image.storageKey, url: image.url }))
    ).sort((left, right) => left.sku.localeCompare(right.sku) || left.storageKey.localeCompare(right.storageKey)));
    const catalog = await database.select().from(products);
    expect(catalog.filter((product) => product.status === "ACTIVE")).toHaveLength(18);
    expect(new Set(catalog.map((product) => product.slug)).size).toBe(20);
    for (const product of catalog) {
      expect(product.currency).toBe("USD");
      expect(Number(product.price)).toBeGreaterThan(0);
      expect(product.categoryId).not.toBeNull();
      const images = await database.select().from(productImages)
        .where(eq(productImages.productId, product.id)).orderBy(asc(productImages.sortOrder));
      expect(images.map((image) => image.sortOrder)).toEqual([0, 1, 2]);
      expect(images.filter((image) => image.isPrimary)).toHaveLength(1);
      expect(images[0]?.isPrimary).toBe(true);
      expect(images.every((image) => image.altText.length > 0 && image.width === 1200 &&
        image.height === 900 && image.mimeType === "image/webp")).toBe(true);
      const [balance] = await database.select().from(inventoryBalances).where(eq(inventoryBalances.productId, product.id));
      const movements = await database.select().from(inventoryMovements).where(eq(inventoryMovements.productId, product.id));
      expect(movements).toHaveLength(1);
      expect(movements[0]).toMatchObject({ type: "OPENING", balanceAfter: balance?.availableQuantity,
        quantityDelta: balance?.availableQuantity, referenceType: "DEVELOPMENT_SEED", referenceId: product.sku });
    }
    const firstImageIds = await database.select({ id: productImages.id }).from(productImages).orderBy(asc(productImages.id));
    const firstCategoryIds = await database.select({ id: categories.id }).from(categories).orderBy(asc(categories.id));
    const firstTagIds = await database.select({ id: tags.id }).from(tags).orderBy(asc(tags.id));

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

    await database
      .update(storeProfiles)
      .set({
        tradeName: "Empresa configurada por Admin",
        legalName: "Empresa configurada por Admin SpA",
        taxIdentifier: "ADMIN-TAX-ID",
      });

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

    expect(secondResult).toEqual({ ...firstResult, inventoryMovements: 0 });
    expect(await database.select({ id: productImages.id }).from(productImages).orderBy(asc(productImages.id))).toEqual(firstImageIds);
    expect(await database.select({ id: categories.id }).from(categories).orderBy(asc(categories.id))).toEqual(firstCategoryIds);
    expect(await database.select({ id: tags.id }).from(tags).orderBy(asc(tags.id))).toEqual(firstTagIds);
    expect(await readSeedCounts()).toEqual({ ...firstResult, inventoryMovements: 20 });
    expect(secondUsers).toEqual(firstUsers);
    expect(secondProducts).toEqual(firstProducts);
    const [profileAfterRerun] = await database.select().from(storeProfiles);
    expect(profileAfterRerun).toMatchObject({
      tradeName: "Empresa configurada por Admin",
      legalName: "Empresa configurada por Admin SpA",
      taxIdentifier: "ADMIN-TAX-ID",
    });
  }, 30_000);

  it("publishes seeded covers, ordered galleries and nine recent products consistently through REST", async () => {
    type PublicCard = { id: string; slug: string; status: string; createdAt: string; coverImage: { id: string; url: string }; images?: unknown };
    const first = await server.inject({ method: "GET", url: "/api/v1/products?view=public&page=1&pageSize=12&sortBy=createdAt&sortOrder=desc" });
    const second = await server.inject({ method: "GET", url: "/api/v1/products?view=public&page=2&pageSize=12&sortBy=createdAt&sortOrder=desc" });
    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    const page1 = first.json<{ items: PublicCard[]; totalItems: number; totalPages: number }>();
    const page2 = second.json<{ items: PublicCard[]; totalItems: number }>();
    expect(page1).toMatchObject({ totalItems: 18, totalPages: 2 });
    expect(page1.items).toHaveLength(12);
    expect(page2.items).toHaveLength(6);
    const cards = [...page1.items, ...page2.items];
    expect(new Set(cards.map((card) => card.id)).size).toBe(18);
    expect(cards.every((card) => card.status === "ACTIVE" && card.coverImage && card.images === undefined)).toBe(true);
    const response = await server.inject({ method: "GET", url: "/api/v1/catalog/landing" });
    expect(response.statusCode).toBe(200);
    const landing = response.json<{ latestProducts: PublicCard[]; featuredProducts: PublicCard[]; highlightedCategories: unknown[] }>();
    // Seed writes share timestamps; landing explicitly breaks ties by ID DESC,
    // whereas the general catalog uses ID ASC as its stable secondary key.
    const expectedRecent = [...cards].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt) || right.id.localeCompare(left.id)).slice(0, 9);
    expect(landing.latestProducts.map((product) => product.id)).toEqual(expectedRecent.map((product) => product.id));
    // The editorial seed is deliberately deferred to 21.6.
    expect(landing.featuredProducts).toEqual([]);
    expect(landing.highlightedCategories).toEqual([]);
    expect(Object.keys(landing).sort()).toEqual(["featuredProducts", "highlightedCategories", "latestProducts"]);
    for (const card of landing.latestProducts) {
      const byId = await server.inject({ method: "GET", url: `/api/v1/products/${card.id}` });
      const bySlug = await server.inject({ method: "GET", url: `/api/v1/products/slug/${card.slug}` });
      expect(byId.statusCode).toBe(200);
      expect(bySlug.statusCode).toBe(200);
      const detail = byId.json<{ coverImage: PublicCard["coverImage"]; images: { id: string; isPrimary: boolean; sortOrder: number; altText: string }[] }>();
      expect(bySlug.json()).toEqual(byId.json());
      expect(detail.coverImage).toEqual(card.coverImage);
      expect(detail.images).toHaveLength(3);
      expect(detail.images.map((image) => image.sortOrder)).toEqual([0, 1, 2]);
      expect(detail.images.filter((image) => image.isPrimary).map((image) => image.id)).toEqual([card.coverImage.id]);
      expect(detail.images.every((image) => image.altText.trim().length > 0)).toBe(true);
    }
    const [inactive] = await database.select().from(products).where(eq(products.status, "INACTIVE")).limit(1);
    expect((await server.inject({ method: "GET", url: `/api/v1/products/${inactive!.id}` })).statusCode).toBe(404);
    expect((await server.inject({ method: "GET", url: `/api/v1/products/slug/${inactive!.slug}` })).statusCode).toBe(404);
  });

  it("authenticates seeded ADMIN and CUSTOMER through REST before and after a rerun", async () => {
    const accounts = seedAccounts.filter((account) => account.role !== "BILLING");
    const identities = new Map<string, string>();
    for (const phase of ["initial", "rerun"]) {
      if (phase === "rerun") await runDevelopmentSeed({
        accounts: seedAccounts, databaseUrl: isolatedDatabaseUrl.toString(), environment: "test",
      });
      for (const account of accounts) {
        const response = await server.inject({ method: "POST", url: "/api/v1/auth/login",
          payload: { email: account.email, password: account.password } });
        expect(response.statusCode).toBe(200);
        const session = response.json<{ accessToken: string; user: { id: string; email: string; role: string } }>();
        expect(session.user).toMatchObject({ email: account.email, role: account.role });
        if (phase === "initial") identities.set(account.role, session.user.id);
        else expect(session.user.id).toBe(identities.get(account.role));
        expect((response.headers["set-cookie"] as string[]).some((cookie) => cookie.includes("HttpOnly"))).toBe(true);
        const headers = { authorization: `Bearer ${session.accessToken}` };
        const me = await server.inject({ method: "GET", url: "/api/v1/auth/me", headers });
        expect(me.statusCode).toBe(200);
        expect(me.json()).toMatchObject({ id: session.user.id, role: account.role });
        const administrative = await server.inject({ method: "GET", url: "/api/v1/users", headers });
        expect(administrative.statusCode).toBe(account.role === "ADMIN" ? 200 : 403);
        const ownOrders = await server.inject({ method: "GET", url: "/api/v1/orders/mine", headers });
        expect(ownOrders.statusCode).toBe(account.role === "CUSTOMER" ? 200 : 403);
        const [persisted] = await database.select().from(users).where(eq(users.id, session.user.id));
        expect(persisted?.passwordHash.startsWith("$argon2id$")).toBe(true);
        expect(persisted?.passwordHash).not.toBe(account.password);
        const wrongPassword = await server.inject({ method: "POST", url: "/api/v1/auth/login",
          payload: { email: account.email, password: "IncorrectTestPassword123!" } });
        expect(wrongPassword.statusCode).toBe(401);
      }
    }
  }, 30_000);

  it("updates a changed demonstration password without duplicating the user or role", async () => {
    const [before] = await database.select().from(users).where(eq(users.email, seedAccounts[0].email));
    if (!before) throw new Error("Missing seed administrator");
    const changedPassword = "ChangedTestOnlyAdminPassword123!";
    const legacySalt = Buffer.from("seed-legacy-test-salt");
    const legacyKey = scryptSync(seedAccounts[0].password, legacySalt, 64, { N: 16_384, r: 8, p: 1 });
    const legacyHash = ["scrypt", "16384", "8", "1", legacySalt.toString("base64url"), legacyKey.toString("base64url")].join("$");
    await database.update(users).set({ passwordHash: legacyHash }).where(eq(users.id, before.id));
    await runDevelopmentSeed({ accounts: seedAccounts, databaseUrl: isolatedDatabaseUrl.toString(), environment: "test" });
    const [upgraded] = await database.select().from(users).where(eq(users.id, before.id));
    expect(upgraded?.passwordHash.startsWith("$argon2id$")).toBe(true);
    expect(await verifySeedPassword(seedAccounts[0].password, upgraded?.passwordHash ?? "")).toBe(true);
    const changedAccounts = seedAccounts.map((account) => ({
      ...account, password: account.role === "ADMIN" ? changedPassword : account.password,
    }));
    const options = { accounts: changedAccounts, databaseUrl: isolatedDatabaseUrl.toString(), environment: "test" as const };
    const countsBefore = await readSeedCounts();
    await runDevelopmentSeed(options);
    const [after] = await database.select().from(users).where(eq(users.id, before.id));
    expect(after?.passwordHash).not.toBe(before.passwordHash);
    expect(after?.passwordHash.startsWith("$argon2id$")).toBe(true);
    expect(await verifySeedPassword(changedPassword, after?.passwordHash ?? "")).toBe(true);
    expect(await readSeedCounts()).toEqual(countsBefore);
    const oldLogin = await server.inject({ method: "POST", url: "/api/v1/auth/login",
      payload: { email: seedAccounts[0].email, password: seedAccounts[0].password } });
    expect(oldLogin.statusCode).toBe(401);
    const newLogin = await server.inject({ method: "POST", url: "/api/v1/auth/login",
      payload: { email: seedAccounts[0].email, password: changedPassword } });
    expect(newLogin.statusCode).toBe(200);
    expect(newLogin.json()).toMatchObject({ user: { id: before.id, role: "ADMIN" } });
    await runDevelopmentSeed(options);
    const [afterRerun] = await database.select().from(users).where(eq(users.id, before.id));
    expect(afterRerun?.passwordHash).toBe(after?.passwordHash);
  }, 30_000);

  it("preserves consumed stock and unrelated data during concurrent reruns", async () => {
    const [product] = await database.select().from(products).where(eq(products.sku, "DEV-LAPTOP-001"));
    if (!product) throw new Error("Missing demo laptop");
    await database.transaction(async (transaction) => {
      await transaction.update(inventoryBalances).set({ availableQuantity: 11, version: 1 })
        .where(eq(inventoryBalances.productId, product.id));
      await transaction.insert(inventoryMovements).values({
        productId: product.id, type: "SALE", quantityDelta: -1, balanceAfter: 11,
        reason: "Test sale", referenceType: "TEST", referenceId: "sale-1",
      });
      await transaction.update(products).set({ slug: "published-laptop" }).where(eq(products.id, product.id));
      await transaction.insert(productImages).values({
        productId: product.id, storageKey: "custom/laptop/image", url: "https://example.com/laptop.webp",
        altText: "Additional administrator image", isPrimary: false, sortOrder: 3,
      });
    });
    const counts = await readSeedCounts();
    const results = await Promise.all([1, 2].map(() => runDevelopmentSeed({
      accounts: seedAccounts, databaseUrl: isolatedDatabaseUrl.toString(), environment: "test",
    })));
    expect(results.every((result) => result.inventoryMovements === 0)).toBe(true);
    expect(await readSeedCounts()).toEqual(counts);
    const [balance] = await database.select().from(inventoryBalances).where(eq(inventoryBalances.productId, product.id));
    expect(balance).toMatchObject({ availableQuantity: 11, version: 1 });
    const [updated] = await database.select().from(products).where(eq(products.id, product.id));
    expect(updated?.slug).toBe("published-laptop");
    const images = await database.select().from(productImages).where(eq(productImages.productId, product.id))
      .orderBy(asc(productImages.sortOrder));
    expect(images.map((image) => image.sortOrder)).toEqual([0, 1, 2, 3]);
    expect(images[3]?.storageKey).toBe("custom/laptop/image");
  }, 30_000);

  it("rolls back the entire seed when an image write fails", async () => {
    const beforeProducts = await database.select().from(products).orderBy(asc(products.id));
    const beforeImages = await database.select().from(productImages).orderBy(asc(productImages.id));
    const beforeUsers = await database.select().from(users).orderBy(asc(users.id));
    const counts = await readSeedCounts();
    await database.execute(sql`create function reject_test_seed_image() returns trigger language plpgsql as $$
      begin
        if new.storage_key = 'development/products/dev-phone-005/gallery-2.webp' then
          raise exception 'Simulated seed image failure';
        end if;
        return new;
      end;
    $$`);
    await database.execute(sql`create trigger reject_test_seed_image before insert or update on product_images
      for each row execute function reject_test_seed_image()`);
    try {
      await expect(runDevelopmentSeed({
        accounts: seedAccounts, databaseUrl: isolatedDatabaseUrl.toString(), environment: "test",
      })).rejects.toThrow();
      expect(await readSeedCounts()).toEqual(counts);
      expect(await database.select().from(products).orderBy(asc(products.id))).toEqual(beforeProducts);
      expect(await database.select().from(productImages).orderBy(asc(productImages.id))).toEqual(beforeImages);
      expect(await database.select().from(users).orderBy(asc(users.id))).toEqual(beforeUsers);
    } finally {
      await database.execute(sql`drop trigger reject_test_seed_image on product_images`);
      await database.execute(sql`drop function reject_test_seed_image()`);
    }
  }, 30_000);

  it("rejects production before changing persisted data", async () => {
    const countsBefore = await readSeedCounts();
    const usersBefore = await database.select().from(users).orderBy(asc(users.id));

    await expect(
      runDevelopmentSeed({
        accounts: seedAccounts,
        databaseUrl: isolatedDatabaseUrl.toString(),
        environment: "production",
      }),
    ).rejects.toThrow("Development seed is disabled in production");

    expect(await readSeedCounts()).toEqual(countsBefore);
    expect(await database.select().from(users).orderBy(asc(users.id))).toEqual(usersBefore);
  });
});
