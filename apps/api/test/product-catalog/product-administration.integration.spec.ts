import { randomUUID } from "node:crypto";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import sharp from "sharp";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { insertProductFixtures } from "../product-fixtures";
import { resolve } from "node:path";

import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { FastifyInstance } from "fastify";
import { Pool } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ProductImagesRepository } from "../../src/product-catalog/product-images.repository";
import { ImageStorageService } from "../../src/product-catalog/image-storage/image-storage.service";

import { configureApplication } from "../../src/application";
import {
  auditEntries,
  categories,
  inventoryBalances,
  inventoryMovements,
  productImages,
  productTags,
  products,
  roleAssignments,
  tags,
  users,
} from "../../src/database/schema";
import * as schema from "../../src/database/schema";
import { hashPassword } from "../../src/identity-access/password/password";
import {
  InventoryStockUnavailableError,
} from "../../src/inventory-control/inventory-stock.repository";
import { InventoryStockService } from "../../src/inventory-control/inventory-stock.service";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for product administration tests");
}

const originalEnvironment = {
  accessSecret: process.env.AUTH_ACCESS_TOKEN_SECRET,
  accessTtl: process.env.AUTH_ACCESS_TOKEN_TTL_SECONDS,
  databaseUrl: process.env.DATABASE_URL,
  refreshTtl: process.env.AUTH_REFRESH_TOKEN_TTL_SECONDS,
  imageRoot: process.env.IMAGE_STORAGE_LOCAL_ROOT,
};
const testDatabaseName = `ecommerce_product_admin_${randomUUID().replaceAll("-", "")}`;
if (!/^ecommerce_product_admin_[a-f0-9]{32}$/.test(testDatabaseName)) {
  throw new Error("Generated an unsafe PostgreSQL test database name");
}

const maintenanceUrl = new URL(databaseUrl);
maintenanceUrl.pathname = "/postgres";
const isolatedDatabaseUrl = new URL(databaseUrl);
isolatedDatabaseUrl.pathname = `/${testDatabaseName}`;
const quotedTestDatabaseName = `"${testDatabaseName}"`;
const password = "ProductAdministrationPassword123!";

type Role = "ADMIN" | "BILLING" | "CUSTOMER";
type ProductResponse = Readonly<{
  id: string;
  sku: string;
  slug: string | null;
  name: string;
  description: string;
  price: string;
  currency: "USD";
  image: { storageKey: string; url: string };
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}>;

let maintenancePool: Pool | undefined;
let app: NestFastifyApplication;
let server: FastifyInstance;
let database: NodePgDatabase<typeof schema>;
let isolatedDatabaseCreated = false;
let tokens: Record<"admin" | "billing" | "customer", string>;
let userIds: Record<"admin" | "billing" | "customer", string>;
let imageRoot: string;
let imageBytes: Buffer;
const imageProductIds: string[] = [];
const imageCategoryIds: string[] = [];

const productPayload = {
  description: "Notebook profesional para desarrollo",
  image: {
    storageKey: "products/notebook-pro/cover.webp",
    url: "https://cdn.example.com/products/notebook-pro/cover.webp",
  },
  name: "Notebook Pro 14",
  price: "1299.90",
  sku: " notebook-001 ",
  status: "INACTIVE",
} as const;

function authorization(accessToken: string): { authorization: string } {
  return { authorization: `Bearer ${accessToken}` };
}

function restoreEnvironment(): void {
  for (const [key, value] of Object.entries({
    AUTH_ACCESS_TOKEN_SECRET: originalEnvironment.accessSecret,
    AUTH_ACCESS_TOKEN_TTL_SECONDS: originalEnvironment.accessTtl,
    AUTH_REFRESH_TOKEN_TTL_SECONDS: originalEnvironment.refreshTtl,
    DATABASE_URL: originalEnvironment.databaseUrl,
    IMAGE_STORAGE_LOCAL_ROOT: originalEnvironment.imageRoot,
  })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
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

describe("administrative product lifecycle", () => {
  beforeAll(async () => {
    maintenancePool = new Pool({
      application_name: "technology-ecommerce-product-administration-test-admin",
      connectionString: maintenanceUrl.toString(),
      max: 1,
    });
    await maintenancePool.query(
      `create database ${quotedTestDatabaseName} template template0`,
    );
    isolatedDatabaseCreated = true;

    process.env.DATABASE_URL = isolatedDatabaseUrl.toString();
    process.env.AUTH_ACCESS_TOKEN_SECRET =
      "product-administration-test-secret-at-least-32-characters";
    process.env.AUTH_ACCESS_TOKEN_TTL_SECONDS = "900";
    process.env.AUTH_REFRESH_TOKEN_TTL_SECONDS = "3600";
    imageRoot = await mkdtemp(resolve(tmpdir(), "ecommerce-product-images-"));
    process.env.IMAGE_STORAGE_LOCAL_ROOT = imageRoot;
    imageBytes = await sharp({ create: { width: 8, height: 6, channels: 3, background: "blue" } }).png().toBuffer();

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

    const passwordHash = await hashPassword(password);
    const fixtureInputs = [
      { key: "admin", role: "ADMIN" },
      { key: "billing", role: "BILLING" },
      { key: "customer", role: "CUSTOMER" },
    ] as const;
    const emails = {} as Record<(typeof fixtureInputs)[number]["key"], string>;
    userIds = {} as Record<(typeof fixtureInputs)[number]["key"], string>;
    for (const fixture of fixtureInputs) {
      const email = `products-${fixture.key}@example.com`;
      const [user] = await database
        .insert(users)
        .values({ displayName: fixture.key, email, passwordHash })
        .returning({ id: users.id });
      if (!user) throw new Error(`Product fixture ${fixture.key} failed`);
      await database.insert(roleAssignments).values({
        role: fixture.role as Role,
        userId: user.id,
      });
      emails[fixture.key] = email;
      userIds[fixture.key] = user.id;
    }
    tokens = {
      admin: await login(emails.admin),
      billing: await login(emails.billing),
      customer: await login(emails.customer),
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
    if (imageRoot) await rm(imageRoot, { recursive: true, force: true });
  }, 30_000);

  it("rejects anonymous, CUSTOMER and BILLING product mutations", async () => {
    const responses = await Promise.all([
      server.inject({ method: "POST", url: "/api/v1/products", payload: productPayload }),
      server.inject({ method: "POST", url: "/api/v1/products", headers: authorization(tokens.customer), payload: productPayload }),
      server.inject({ method: "POST", url: "/api/v1/products", headers: authorization(tokens.billing), payload: productPayload }),
    ]);
    expect(responses.map((response) => response.statusCode)).toEqual([401, 403, 403]);
  });

  async function imageProduct(active = false) {
    const [category] = await database.insert(categories).values({ name: `Images ${randomUUID()}`, slug: `images-${randomUUID()}`, status: "ACTIVE" }).returning();
    const [product] = await insertProductFixtures(database, { name: "Gallery", description: "Gallery fixture", sku: randomUUID(), price: "10.00", categoryId: category!.id, status: active ? "ACTIVE" : "INACTIVE" });
    imageProductIds.push(product!.id);
    imageCategoryIds.push(category!.id);
    return product!;
  }
  afterEach(async () => {
    if (imageProductIds.length) await database.delete(products).where(inArray(products.id, imageProductIds.splice(0)));
    if (imageCategoryIds.length) await database.delete(categories).where(inArray(categories.id, imageCategoryIds.splice(0)));
  });
  function uploadImage(productId: string, query = "altText=Teclado", token = tokens.admin, bytes = imageBytes) {
    return server.inject({ method: "POST", url: `/api/v1/products/${productId}/images?${query}`, headers: { ...authorization(token), "content-type": "image/png" }, payload: bytes });
  }
  type GalleryImage = { id: string; isPrimary: boolean; sortOrder: number; storageKey: string; width: number; height: number; altText: string };

  async function editorialCategory() {
    const [category] = await database.insert(categories).values({ name: `Editorial ${randomUUID()}`, slug: `editorial-${randomUUID()}` }).returning();
    imageCategoryIds.push(category!.id);
    return category!;
  }
  function patchCategory(id: string, payload: Record<string, unknown>, token = tokens.admin) {
    return server.inject({ method: "PATCH", url: `/api/v1/categories/${id}`, headers: authorization(token), payload });
  }

  it("activates and withdraws product destaque with server timestamps, audit and no association/stock changes", async () => {
    const product = await imageProduct(true);
    const patch = (payload: Record<string, unknown>) => server.inject({ method: "PATCH", url: `/api/v1/products/${product.id}`, headers: authorization(tokens.admin), payload });
    const beforeImages = await database.select().from(productImages).where(eq(productImages.productId, product.id));
    const beforeStock = await database.select().from(inventoryBalances).where(eq(inventoryBalances.productId, product.id));
    const highlighted = await patch({ isFeatured: true });
    expect(highlighted.statusCode).toBe(200);
    const featuredAt = highlighted.json().featuredAt as string;
    expect(highlighted.json()).toMatchObject({ isFeatured: true, categoryId: product.categoryId });
    expect(Number.isNaN(Date.parse(featuredAt))).toBe(false);
    expect((await patch({ description: "Edit without changing destaque" })).json().featuredAt).toBe(featuredAt);
    expect((await patch({ isFeatured: true })).json().featuredAt).toBe(featuredAt);
    const adminDetail = await server.inject({ method: "GET", url: `/api/v1/products/${product.id}?view=administrative`, headers: authorization(tokens.admin) });
    expect(adminDetail.json()).toMatchObject({ isFeatured: true, featuredAt });
    const publicDetail = await server.inject({ method: "GET", url: `/api/v1/products/${product.id}` });
    expect(publicDetail.json()).not.toHaveProperty("isFeatured");
    expect(publicDetail.json()).not.toHaveProperty("featuredAt");
    const audit = await database.select().from(auditEntries).where(and(eq(auditEntries.entityId, product.id), eq(auditEntries.action, "PRODUCT_UPDATED")));
    expect(audit[0]!.actorUserId).toBe(userIds.admin);
    expect(audit[0]!.changes).toMatchObject({ before: { isFeatured: false, featuredAt: null }, after: { isFeatured: true, featuredAt } });
    expect((await patch({ isFeatured: false })).json()).toMatchObject({ isFeatured: false, featuredAt: null });
    await database.update(products).set({ featuredAt: new Date("2020-01-01T00:00:00Z") }).where(eq(products.id, product.id));
    const again = await patch({ isFeatured: true });
    expect(again.json().featuredAt).not.toBe("2020-01-01T00:00:00.000Z");
    expect((await patch({ featuredAt: "2000-01-01T00:00:00Z" })).statusCode).toBe(400);
    expect(await database.select().from(productImages).where(eq(productImages.productId, product.id))).toEqual(beforeImages);
    expect(await database.select().from(inventoryBalances).where(eq(inventoryBalances.productId, product.id))).toEqual(beforeStock);
    expect((await database.select().from(products).where(eq(products.id, product.id)))[0]!.categoryId).toBe(product.categoryId);
    await database.update(products).set({ status: "INACTIVE" }).where(eq(products.id, product.id));
    await database.delete(productImages).where(eq(productImages.productId, product.id));
    expect((await patch({ isFeatured: false })).json()).toMatchObject({ isFeatured: false, featuredAt: null });
  });

  it("rejects inactive destaque and unauthorized editorial commands without mutations", async () => {
    const product = await imageProduct(false);
    const category = await editorialCategory();
    const anonymous = await server.inject({ method: "PATCH", url: `/api/v1/products/${product.id}`, payload: { isFeatured: true } });
    expect(anonymous.statusCode).toBe(401);
    for (const token of [tokens.billing, tokens.customer]) {
      expect((await server.inject({ method: "PATCH", url: `/api/v1/products/${product.id}`, headers: authorization(token), payload: { isFeatured: true } })).statusCode).toBe(403);
      expect((await patchCategory(category.id, { showOnLanding: true }, token)).statusCode).toBe(403);
    }
    expect((await server.inject({ method: "PATCH", url: `/api/v1/categories/${category.id}`, payload: { showOnLanding: true } })).statusCode).toBe(401);
    const inactive = await server.inject({ method: "PATCH", url: `/api/v1/products/${product.id}`, headers: authorization(tokens.admin), payload: { isFeatured: true } });
    expect(inactive.statusCode).toBe(400);
    expect(inactive.json().code).toBe("PRODUCT_FEATURED_REQUIRES_ACTIVE");
    expect((await database.select().from(products).where(eq(products.id, product.id)))[0]!.isFeatured).toBe(false);
    expect(await database.select().from(auditEntries).where(eq(auditEntries.entityId, category.id))).toEqual([]);
  });

  it("selects up to three categories, swaps positions, removes selections and preserves associations", async () => {
    const product = await imageProduct(true);
    const existingCategory = (await database.select().from(categories).where(eq(categories.id, product.categoryId!)))[0]!;
    await database.update(categories).set({ description: "Preserve this category description" }).where(eq(categories.id, existingCategory.id));
    const configured = [existingCategory, await editorialCategory(), await editorialCategory(), await editorialCategory()];
    for (const [index, category] of configured.slice(0, 3).entries()) {
      const result = await patchCategory(category.id, { showOnLanding: true });
      expect(result.statusCode).toBe(200);
      expect(result.json()).toMatchObject({ showOnLanding: true, landingOrder: index + 1 });
    }
    const fourth = await patchCategory(configured[3]!.id, { showOnLanding: true });
    expect(fourth.statusCode).toBe(409);
    expect(fourth.json().code).toBe("CATEGORY_LANDING_LIMIT_EXCEEDED");
    const swapped = await patchCategory(existingCategory.id, { landingOrder: 3 });
    expect(swapped.statusCode).toBe(200);
    const third = (await database.select().from(categories).where(eq(categories.id, configured[2]!.id)))[0]!;
    expect(third.landingOrder).toBe(1);
    expect((await database.select().from(auditEntries).where(eq(auditEntries.entityId, third.id))).at(-1)!.changes)
      .toMatchObject({ before: { landingOrder: 3 }, after: { landingOrder: 1 } });
    expect((await patchCategory(configured[1]!.id, { showOnLanding: false })).json()).toMatchObject({ showOnLanding: false, landingOrder: null });
    expect((await patchCategory(configured[3]!.id, { showOnLanding: true })).json().landingOrder).toBe(2);
    const publicCategory = await server.inject({ method: "GET", url: `/api/v1/categories/${existingCategory.id}` });
    expect(publicCategory.json()).not.toHaveProperty("showOnLanding");
    const administrative = await server.inject({ method: "GET", url: `/api/v1/categories/${existingCategory.id}?view=administrative`, headers: authorization(tokens.admin) });
    expect(administrative.json()).toMatchObject({ showOnLanding: true, landingOrder: 3 });
    expect((await patchCategory(existingCategory.id, { status: "INACTIVE" })).statusCode).toBe(200);
    expect((await patchCategory(existingCategory.id, { showOnLanding: true })).statusCode).toBe(400);
    expect((await patchCategory(existingCategory.id, { showOnLanding: false })).statusCode).toBe(200);
    for (const payload of [{ showOnLanding: true, landingOrder: null }, { landingOrder: 0 }, { landingOrder: 4 }, { landingOrder: 1.5 }, { showOnLanding: "true" }, { showOnLanding: false, landingOrder: 2 }]) {
      expect((await patchCategory(configured[1]!.id, payload)).statusCode).toBe(400);
    }
    expect((await database.select().from(products).where(eq(products.id, product.id)))[0]!.categoryId).toBe(existingCategory.id);
    expect((await database.select().from(categories).where(eq(categories.id, existingCategory.id)))[0]!.description).toBe("Preserve this category description");
    const deleted = await server.inject({ method: "DELETE", url: `/api/v1/categories/${configured[3]!.id}`, headers: authorization(tokens.admin) });
    expect(deleted.statusCode).toBe(204);
    expect((await database.select().from(categories).where(eq(categories.id, configured[3]!.id)))[0])
      .toMatchObject({ showOnLanding: false, landingOrder: null, status: "INACTIVE" });
    expect((await patchCategory(configured[1]!.id, { showOnLanding: true })).statusCode).toBe(200);
  });

  it("serializes competing fourth-category selections and atomically rolls back a failed audit", async () => {
    const configured = await Promise.all([1, 2, 3, 4].map(() => editorialCategory()));
    for (const category of configured.slice(0, 2)) expect((await patchCategory(category.id, { showOnLanding: true })).statusCode).toBe(200);
    const competing = await Promise.all(configured.slice(2).map((category) => patchCategory(category.id, { showOnLanding: true })));
    expect(competing.map((response) => response.statusCode).sort()).toEqual([200, 409]);
    const before = await database.select().from(categories).where(inArray(categories.id, configured.map((category) => category.id))).orderBy(asc(categories.id));
    const auditBefore = await database.select().from(auditEntries).where(inArray(auditEntries.entityId, configured.map((category) => category.id)));
    const product = await imageProduct(true);
    await database.execute(sql`create function fail_editorial_audit() returns trigger language plpgsql as $$
      begin if NEW.action in ('CATEGORY_UPDATED', 'PRODUCT_UPDATED') then raise exception 'simulated audit failure'; end if; return NEW; end; $$`);
    await database.execute(sql`create trigger fail_editorial_audit before insert on audit_entries for each row execute function fail_editorial_audit()`);
    try {
      const failed = await patchCategory(configured[0]!.id, { landingOrder: 2 });
      expect(failed.statusCode).toBe(500);
      expect(await database.select().from(categories).where(inArray(categories.id, configured.map((category) => category.id))).orderBy(asc(categories.id))).toEqual(before);
      expect(await database.select().from(auditEntries).where(inArray(auditEntries.entityId, configured.map((category) => category.id)))).toEqual(auditBefore);
      const failedProduct = await server.inject({ method: "PATCH", url: `/api/v1/products/${product.id}`, headers: authorization(tokens.admin), payload: { isFeatured: true } });
      expect(failedProduct.statusCode).toBe(500);
      expect((await database.select().from(products).where(eq(products.id, product.id)))[0]).toMatchObject({ isFeatured: false, featuredAt: null });
    } finally {
      await database.execute(sql`drop trigger fail_editorial_audit on audit_entries`);
      await database.execute(sql`drop function fail_editorial_audit()`);
    }
  });

  it("returns only the cover in lists and an ordered gallery in both detail routes", async () => {
    const product = await imageProduct(true);
    const slug = `public-gallery-${product.id}`;
    await database.transaction(async (transaction) => {
      await transaction.update(products).set({ slug }).where(eq(products.id, product.id));
      await transaction.update(productImages).set({ isPrimary: false }).where(eq(productImages.productId, product.id));
      await transaction.insert(productImages).values([
        { productId: product.id, storageKey: `gallery/${product.id}/side`, url: "https://example.com/side.webp", altText: "Vista lateral", isPrimary: false, sortOrder: 1, width: 800, height: 600, mimeType: "image/webp" },
        { productId: product.id, storageKey: `gallery/${product.id}/cover`, url: "https://example.com/cover.webp", altText: "Portada seleccionada", isPrimary: true, sortOrder: 2, width: 1200, height: 900, mimeType: "image/webp" },
      ]);
    });
    const listing = await server.inject({ method: "GET", url: `/api/v1/products?search=${product.sku}&pageSize=1` });
    expect(listing.statusCode).toBe(200);
    const page = listing.json<{ items: Record<string, unknown>[]; totalItems: number }>();
    expect(page.totalItems).toBe(1);
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).not.toHaveProperty("images");
    expect(page.items[0]?.coverImage).toMatchObject({ isPrimary: true, sortOrder: 2, altText: "Portada seleccionada", width: 1200, height: 900 });
    const byId = await server.inject({ method: "GET", url: `/api/v1/products/${product.id}` });
    const bySlug = await server.inject({ method: "GET", url: `/api/v1/products/slug/${slug}` });
    expect(byId.statusCode).toBe(200);
    expect(bySlug.statusCode).toBe(200);
    expect(bySlug.json()).toEqual(byId.json());
    const detail = byId.json<{ coverImage: Record<string, unknown>; images: { id: string; sortOrder: number; isPrimary: boolean }[] }>();
    expect(detail.images.map((image) => image.sortOrder)).toEqual([0, 1, 2]);
    expect(detail.images.filter((image) => image.isPrimary)).toHaveLength(1);
    expect(detail.coverImage).toEqual(detail.images[2]);
    expect(detail.images[0]).not.toHaveProperty("productId");
    expect(detail.images[0]).not.toHaveProperty("createdAt");
    const document = (await server.inject({ method: "GET", url: "/api/v1/openapi.json" })).json<{ components: object }>();
    const validator = new Ajv({ strict: false });
    addFormats(validator);
    validator.addSchema({ $id: "urn:technology-ecommerce:catalog-images-contract", components: document.components });
    for (const [type, body] of [["ProductPageResponseDto", listing.json()], ["ProductDetailResponseDto", byId.json()]]) {
      const validate = validator.compile({ $ref: `urn:technology-ecommerce:catalog-images-contract#/components/schemas/${type}` });
      expect(validate(body), JSON.stringify(validate.errors)).toBe(true);
    }
  });

  it("returns one-image galleries and a safe fallback for drafts without a cover", async () => {
    const product = await imageProduct();
    const path = `/api/v1/products/${product.id}?view=administrative`;
    const headers = authorization(tokens.admin);
    const single = await server.inject({ method: "GET", url: path, headers });
    expect(single.statusCode).toBe(200);
    const one = single.json<{ coverImage: unknown; images: unknown[] }>();
    expect(one.images).toHaveLength(1);
    expect(one.coverImage).toEqual(one.images[0]);
    expect(one.coverImage).toMatchObject({ url: "/images/product-placeholder.svg", altText: "Gallery" });
    await database.delete(productImages).where(eq(productImages.productId, product.id));
    const empty = await server.inject({ method: "GET", url: path, headers });
    expect(empty.statusCode).toBe(200);
    expect(empty.json()).toMatchObject({ coverImage: null, images: [], image: { url: "/images/product-placeholder.svg" } });
    const document = (await server.inject({ method: "GET", url: "/api/v1/openapi.json" })).json<{ components: object }>();
    const validator = new Ajv({ strict: false });
    addFormats(validator);
    validator.addSchema({ $id: "urn:technology-ecommerce:empty-gallery", components: document.components });
    const validate = validator.compile({ $ref: "urn:technology-ecommerce:empty-gallery#/components/schemas/ProductDetailResponseDto" });
    expect(validate(empty.json()), JSON.stringify(validate.errors)).toBe(true);
    const administrative = await server.inject({ method: "GET", url: `/api/v1/products?view=administrative&search=${product.sku}`, headers });
    expect(administrative.statusCode).toBe(200);
    expect(administrative.json()).toMatchObject({ totalItems: 1, items: [{ id: product.id, coverImage: null }] });
    expect((await server.inject({ method: "GET", url: `/api/v1/products/${product.id}` })).statusCode).toBe(404);
    expect((await server.inject({ method: "GET", url: `/api/v1/products?search=${product.sku}` })).json()).toMatchObject({ totalItems: 0, items: [] });
    // An inactive gallery may exist without a selected primary image.
    await database.insert(productImages).values({ productId: product.id, storageKey: `draft/${product.id}/side`, url: "/images/product-placeholder.svg", altText: "Imagen del borrador", isPrimary: false, sortOrder: 0 });
    const unselected = await server.inject({ method: "GET", url: path, headers });
    expect(unselected.json()).toMatchObject({ coverImage: null, images: [{ isPrimary: false, sortOrder: 0 }] });
  });

  it("authorizes all image mutations exclusively for ADMIN", async () => {
    const product = await imageProduct();
    for (const method of ["POST", "PATCH", "DELETE"] as const) {
      for (const role of [undefined, "customer", "billing"] as const) {
        const response = await server.inject({ method, url: `/api/v1/products/${product.id}/images${method === "POST" ? "?altText=Test" : `/${randomUUID()}`}`, ...(role ? { headers: authorization(tokens[role]) } : {}), ...(method === "PATCH" ? { payload: { altText: "Test" } } : {}) });
        expect(response.statusCode).toBe(role ? 403 : 401);
      }
    }
  });

  it("uploads validated bytes, captures dimensions, edits metadata, reorders and selects a cover atomically", async () => {
    const product = await imageProduct(true);
    const added = await uploadImage(product.id);
    expect(added.statusCode, added.body).toBe(201);
    const image = added.json<GalleryImage>();
    const document = (await server.inject({ method: "GET", url: "/api/v1/openapi.json" })).json<{ components: object }>();
    const validator = new Ajv({ strict: false });
    addFormats(validator);
    validator.addSchema({ $id: "urn:technology-ecommerce:product-images", components: document.components });
    const validateResponse = validator.compile({ $ref: "urn:technology-ecommerce:product-images#/components/schemas/ProductGalleryImageDto" });
    expect(validateResponse(image), JSON.stringify(validateResponse.errors)).toBe(true);
    expect(image).toMatchObject({ altText: "Teclado", width: 8, height: 6, isPrimary: false, sortOrder: 1 });
    expect((await app.get(ImageStorageService).read(image.storageKey)).data).toEqual(imageBytes);
    const changed = await server.inject({ method: "PATCH", url: `/api/v1/products/${product.id}/images/${image.id}`, headers: authorization(tokens.admin), payload: { isPrimary: true, sortOrder: 0, altText: "Teclado iluminado" } });
    expect(changed.statusCode, changed.body).toBe(200);
    expect(changed.json()).toMatchObject({ isPrimary: true, sortOrder: 0, altText: "Teclado iluminado" });
    const gallery = await database.select().from(productImages).where(eq(productImages.productId, product.id)).orderBy(asc(productImages.sortOrder));
    expect(gallery.map((row) => row.sortOrder)).toEqual([0, 1]);
    expect(gallery.filter((row) => row.isPrimary).map((row) => row.id)).toEqual([image.id]);
    const audits = await database.select().from(auditEntries).where(eq(auditEntries.entityId, product.id));
    expect(audits.map((row) => row.action)).toEqual(["PRODUCT_IMAGE_ADD", "PRODUCT_IMAGE_EDIT"]);
  });

  it("rejects deleting or demoting an active cover and rejects cross-product image IDs", async () => {
    const product = await imageProduct(true);
    const [cover] = await database.select().from(productImages).where(eq(productImages.productId, product.id));
    for (const method of ["DELETE", "PATCH"] as const) {
      const response = await server.inject({ method, url: `/api/v1/products/${product.id}/images/${cover!.id}`, headers: authorization(tokens.admin), ...(method === "PATCH" ? { payload: { isPrimary: false } } : {}) });
      expect(response.statusCode).toBe(409);
      expect(response.json().code).toBe("PRODUCT_PRIMARY_IMAGE_REQUIRED");
    }
    const other = await imageProduct();
    const response = await server.inject({ method: "DELETE", url: `/api/v1/products/${other.id}/images/${cover!.id}`, headers: authorization(tokens.admin) });
    expect(response.statusCode).toBe(404);
    expect(response.json().code).toBe("PRODUCT_IMAGE_NOT_FOUND");
  });

  it("removes an additional image and its managed file, normalizing positions", async () => {
    const product = await imageProduct(true);
    const first = (await uploadImage(product.id)).json<GalleryImage>();
    const second = (await uploadImage(product.id)).json<GalleryImage>();
    const response = await server.inject({ method: "DELETE", url: `/api/v1/products/${product.id}/images/${first.id}`, headers: authorization(tokens.admin) });
    expect(response.statusCode).toBe(204);
    expect(await readdir(imageRoot)).not.toContain(first.storageKey);
    const [remaining] = await database.select().from(productImages).where(eq(productImages.id, second.id));
    expect(remaining!.sortOrder).toBe(1);
  });

  it("supports an empty inactive gallery, first cover upload and insertion between existing images", async () => {
    const product = await imageProduct();
    const [placeholder] = await database.select().from(productImages).where(eq(productImages.productId, product.id));
    expect((await server.inject({ method: "DELETE", url: `/api/v1/products/${product.id}/images/${placeholder!.id}`, headers: authorization(tokens.admin) })).statusCode).toBe(204);
    const first = (await uploadImage(product.id)).json<GalleryImage>();
    expect(first).toMatchObject({ isPrimary: true, sortOrder: 0 });
    const second = (await uploadImage(product.id)).json<GalleryImage>();
    const middleResponse = await uploadImage(product.id, "altText=Detalle&sortOrder=1");
    expect(middleResponse.statusCode).toBe(201);
    const middle = middleResponse.json<GalleryImage>();
    const gallery = await database.select().from(productImages).where(eq(productImages.productId, product.id)).orderBy(asc(productImages.sortOrder));
    expect(gallery.map((row) => row.id)).toEqual([first.id, middle.id, second.id]);
    expect(gallery.map((row) => row.sortOrder)).toEqual([0, 1, 2]);
  });

  it("serializes concurrent cover selections without duplicate covers or positions", async () => {
    const product = await imageProduct(true);
    const images = [(await uploadImage(product.id)).json<GalleryImage>(), (await uploadImage(product.id)).json<GalleryImage>()];
    const responses = await Promise.all(images.map((image) => server.inject({ method: "PATCH", url: `/api/v1/products/${product.id}/images/${image.id}`, headers: authorization(tokens.admin), payload: { isPrimary: true, sortOrder: 0 } })));
    expect(responses.map((response) => response.statusCode)).toEqual([200, 200]);
    const gallery = await database.select().from(productImages).where(eq(productImages.productId, product.id)).orderBy(asc(productImages.sortOrder));
    expect(gallery.map((row) => row.sortOrder)).toEqual([0, 1, 2]);
    expect(gallery.filter((row) => row.isPrimary)).toHaveLength(1);
  });

  it("rejects invalid metadata, positions, unsupported bytes, oversized bodies and missing products without orphan uploads", async () => {
    const product = await imageProduct();
    const before = await readdir(imageRoot);
    for (const query of ["", "altText=", "altText=X&isPrimary=1", "altText=X&sortOrder=-1", "altText=X&sortOrder=4", "altText=X&url=https://bad.example"]) expect((await uploadImage(product.id, query)).statusCode).toBe(400);
    expect((await uploadImage(product.id, "altText=X", tokens.admin, Buffer.from("not an image"))).statusCode).toBe(400);
    expect((await uploadImage(product.id, "altText=X", tokens.admin, imageBytes.subarray(0, 8))).statusCode).toBe(400);
    const limit = app.get(ConfigService).get<number>("IMAGE_STORAGE_MAX_BYTES")!;
    expect((await uploadImage(product.id, "altText=X", tokens.admin, Buffer.alloc(limit + 1))).statusCode).toBe(413);
    expect((await uploadImage(randomUUID())).statusCode).toBe(404);
    const [cover] = await database.select().from(productImages).where(eq(productImages.productId, product.id));
    for (const payload of [{}, { sortOrder: 2 }, { isPrimary: "true" }, { storageKey: "fake" }]) expect((await server.inject({ method: "PATCH", url: `/api/v1/products/${product.id}/images/${cover!.id}`, headers: authorization(tokens.admin), payload })).statusCode).toBe(400);
    expect(await readdir(imageRoot)).toEqual(before);
  });

  it("cleans up an upload after a repository failure and never masks that failure", async () => {
    const product = await imageProduct();
    const before = await readdir(imageRoot);
    const spy = vi.spyOn(app.get(ProductImagesRepository), "mutate").mockRejectedValueOnce(new Error("simulated persistence failure"));
    try { expect((await uploadImage(product.id)).statusCode).toBe(500); } finally { spy.mockRestore(); }
    expect(await readdir(imageRoot)).toEqual(before);
  });

  it("does not report a failed mutation when post-commit file cleanup fails", async () => {
    const product = await imageProduct();
    const image = (await uploadImage(product.id)).json<GalleryImage>();
    const spy = vi.spyOn(app.get(ImageStorageService), "deleteIfUnreferenced").mockRejectedValueOnce(new Error("storage temporarily unavailable"));
    try { expect((await server.inject({ method: "DELETE", url: `/api/v1/products/${product.id}/images/${image.id}`, headers: authorization(tokens.admin) })).statusCode).toBe(204); } finally { spy.mockRestore(); }
    expect(await database.select().from(productImages).where(eq(productImages.id, image.id))).toHaveLength(0);
    expect(await readdir(imageRoot)).toContain(image.storageKey);
    await app.get(ImageStorageService).deleteIfUnreferenced(image.storageKey);
  });

  it("allows ADMIN to create and read a normalized product with its image", async () => {
    const createdResponse = await server.inject({
      method: "POST",
      url: "/api/v1/products",
      headers: authorization(tokens.admin),
      payload: productPayload,
    });
    const created = createdResponse.json<ProductResponse>();
    expect(createdResponse.statusCode).toBe(201);
    expect(created).toMatchObject({
      currency: "USD",
      slug: "notebook-pro-14",
      image: productPayload.image,
      price: "1299.90",
      sku: "NOTEBOOK-001",
      status: "INACTIVE",
    });
    expect(new Date(created.createdAt).toString()).not.toBe("Invalid Date");

    const detail = await server.inject({
      method: "GET",
      url: `/api/v1/products/${created.id}?view=administrative`,
      headers: authorization(tokens.admin),
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json()).toMatchObject({
      availability: "OUT_OF_STOCK",
      currency: created.currency,
      id: created.id,
      image: created.image,
      name: created.name,
      price: created.price,
      sku: created.sku,
      status: created.status,
      stockAvailable: 0,
    });

    const hiddenFromPublic = await server.inject({
      method: "GET",
      url: `/api/v1/products/${created.id}`,
    });
    expect(hiddenFromPublic.statusCode).toBe(404);
  });

  it("resolves concurrent slug collisions and preserves slugs when names change", async () => {
    const requests = [1, 2].map((number) => server.inject({
      method: "POST",
      url: "/api/v1/products",
      headers: authorization(tokens.admin),
      payload: {
        ...productPayload,
        sku: `SLUG-RACE-${number}`,
        image: { ...productPayload.image, storageKey: `products/slug-race-${number}/cover.webp` },
      },
    }));
    const created = await Promise.all(requests);
    expect(created.map((response) => response.statusCode)).toEqual([201, 201]);
    const slugs = created.map((response) => response.json<ProductResponse>().slug).sort();
    expect(slugs).toEqual(["notebook-pro-14-2", "notebook-pro-14-3"]);

    const product = created[0]!.json<ProductResponse>();
    const renamed = await server.inject({
      method: "PATCH",
      url: `/api/v1/products/${product.id}`,
      headers: authorization(tokens.admin),
      payload: { name: "Nombre completamente nuevo" },
    });
    expect(renamed.json<ProductResponse>().slug).toBe(product.slug);

    const explicitCollision = await server.inject({
      method: "PATCH",
      url: `/api/v1/products/${product.id}`,
      headers: authorization(tokens.admin),
      payload: { slug: "notebook-pro-14" },
    });
    expect(explicitCollision.statusCode).toBe(409);
    expect(explicitCollision.json()).toMatchObject({ code: "PRODUCT_SLUG_ALREADY_EXISTS" });

    const explicitChange = await server.inject({
      method: "PATCH",
      url: `/api/v1/products/${product.id}`,
      headers: authorization(tokens.admin),
      payload: { slug: "  Nuevo & Slug  " },
    });
    expect(explicitChange.statusCode).toBe(200);
    expect(explicitChange.json<ProductResponse>().slug).toBe("nuevo-slug");
    for (const response of created) {
      await database.update(products).set({ deletedAt: new Date(), status: "INACTIVE" })
        .where(eq(products.id, response.json<ProductResponse>().id));
    }
  });

  it("rejects invalid money, stock mutation and duplicate SKU", async () => {
    const negativePrice = await server.inject({
      method: "POST",
      url: "/api/v1/products",
      headers: authorization(tokens.admin),
      payload: { ...productPayload, image: { ...productPayload.image, storageKey: "products/invalid/cover.webp" }, price: "-1.00", sku: "INVALID-PRICE" },
    });
    const directStock = await server.inject({
      method: "PATCH",
      url: `/api/v1/products/${randomUUID()}`,
      headers: authorization(tokens.admin),
      payload: { stock: 100 },
    });
    const foreignCurrency = await server.inject({
      method: "POST",
      url: "/api/v1/products",
      headers: authorization(tokens.admin),
      payload: { ...productPayload, currency: "EUR", sku: "INVALID-CURRENCY" },
    });
    const duplicate = await server.inject({
      method: "POST",
      url: "/api/v1/products",
      headers: authorization(tokens.admin),
      payload: { ...productPayload, image: { ...productPayload.image, storageKey: "products/duplicate/cover.webp" }, sku: "notebook-001" },
    });
    expect(negativePrice.statusCode).toBe(400);
    expect(directStock.statusCode).toBe(400);
    expect(foreignCurrency.statusCode).toBe(400);
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json()).toMatchObject({ code: "PRODUCT_SKU_ALREADY_EXISTS" });
    await expect(
      database.insert(products).values({
        currency: "EUR",
        description: "Persistence currency guard fixture",
        name: "Foreign currency fixture",
        price: "10.00",
        sku: `EUR-${randomUUID()}`,
      }),
    ).rejects.toMatchObject({
      cause: { constraint: "products_currency_usd_only" },
    });
  });

  it("updates, activates and soft-deletes without destroying image history", async () => {
    const [existing] = await database
      .select({ id: products.id })
      .from(products)
      .where(eq(products.sku, "NOTEBOOK-001"));
    if (!existing) throw new Error("Expected the created product fixture");

    const updatedResponse = await server.inject({
      method: "PATCH",
      url: `/api/v1/products/${existing.id}`,
      headers: authorization(tokens.admin),
      payload: { name: "Notebook Pro 14 Gen 2", price: "1399990.00" },
    });
    expect(updatedResponse.statusCode).toBe(200);
    expect(updatedResponse.json<ProductResponse>()).toMatchObject({
      name: "Notebook Pro 14 Gen 2",
      price: "1399990.00",
    });

    const [category] = await database.insert(categories).values({ name: "Categoría notebook", slug: "categoria-notebook" }).returning({ id: categories.id });
    if (!category) throw new Error("Expected activation category");
    const classified = await server.inject({
      method: "PATCH",
      url: `/api/v1/products/${existing.id}`,
      headers: authorization(tokens.admin),
      payload: { categoryId: category.id },
    });
    expect(classified.statusCode).toBe(200);

    const activated = await server.inject({
      method: "PATCH",
      url: `/api/v1/products/${existing.id}/status`,
      headers: authorization(tokens.admin),
      payload: { status: "ACTIVE" },
    });
    expect(activated.statusCode).toBe(200);
    expect(activated.json<ProductResponse>().status).toBe("ACTIVE");

    const deleted = await server.inject({
      method: "DELETE",
      url: `/api/v1/products/${existing.id}`,
      headers: authorization(tokens.admin),
    });
    expect(deleted.statusCode).toBe(204);
    const detail = await server.inject({
      method: "GET",
      url: `/api/v1/products/${existing.id}?view=administrative`,
      headers: authorization(tokens.admin),
    });
    expect(detail.statusCode).toBe(404);

    const [persisted] = await database
      .select({ deletedAt: products.deletedAt, status: products.status })
      .from(products)
      .where(eq(products.id, existing.id));
    const [persistedImage] = await database
      .select({ storageKey: productImages.storageKey })
      .from(productImages)
      .where(eq(productImages.productId, existing.id));
    const actions = await database
      .select({
        action: auditEntries.action,
        actorUserId: auditEntries.actorUserId,
        changes: auditEntries.changes,
        createdAt: auditEntries.createdAt,
        entityId: auditEntries.entityId,
        entityType: auditEntries.entityType,
      })
      .from(auditEntries)
      .where(eq(auditEntries.entityId, existing.id))
      .orderBy(asc(auditEntries.createdAt));
    expect(persisted?.status).toBe("INACTIVE");
    expect(persisted?.deletedAt).toBeInstanceOf(Date);
    expect(persistedImage?.storageKey).toBe(productPayload.image.storageKey);
    expect(actions.map(({ action }) => action)).toEqual([
      "PRODUCT_CREATED",
      "PRODUCT_UPDATED",
      "PRODUCT_UPDATED",
      "PRODUCT_ACTIVATED",
      "PRODUCT_DELETED",
    ]);
    expect(
      actions.every(
        (entry) =>
          entry.actorUserId === userIds.admin &&
          entry.entityId === existing.id &&
          entry.entityType === "PRODUCT" &&
          entry.createdAt instanceof Date &&
          Object.keys(entry.changes).length > 0,
      ),
    ).toBe(true);
    expect(JSON.stringify(actions)).not.toMatch(/password|token|secret/i);
  });

  it("lists public and administrative products with SQL filters, ordering and totals", async () => {
    const fixtures = [
      {
        description: "Gaming performance notebook",
        name: "Gaming Laptop",
        price: "1500.00",
        sku: "GAMING-LAPTOP",
        status: "ACTIVE" as const,
        stock: 5,
      },
      {
        description: "Quiet office keyboard",
        name: "Office Keyboard",
        price: "80.00",
        sku: "OFFICE-KEYBOARD",
        status: "ACTIVE" as const,
        stock: 10,
      },
      {
        description: "Wireless gaming mouse",
        name: "Gaming Mouse",
        price: "50.00",
        sku: "GAMING-MOUSE",
        status: "ACTIVE" as const,
        stock: 0,
      },
      {
        description: "Wide gaming display",
        name: "Gaming Monitor",
        price: "400.00",
        sku: "GAMING-MONITOR",
        status: "INACTIVE" as const,
        stock: 2,
      },
      {
        description: "Mirrorless travel camera",
        name: "Travel Camera",
        price: "900.00",
        sku: "TRAVEL-CAMERA",
        status: "ACTIVE" as const,
        stock: 3,
      },
    ];
    const created = await insertProductFixtures(database,
        fixtures.map((fixture) => ({
          description: fixture.description,
          name: fixture.name,
          price: fixture.price,
          sku: fixture.sku,
          status: fixture.status,
        })),
      (product) => ({
        storageKey: `products/${product.sku.toLowerCase()}/cover.webp`,
        url: `https://cdn.example.com/products/${product.sku.toLowerCase()}/cover.webp`,
      }));
    await database.insert(productImages).values(created.map((product) => ({
      productId: product.id, storageKey: `products/${product.sku.toLowerCase()}/gallery.webp`,
      url: "/images/product-placeholder.svg", altText: `Vista adicional de ${product.name}`, isPrimary: false, sortOrder: 1,
    })));
    await database.insert(inventoryBalances).values(
      created
        .map((product) => ({
          availableQuantity:
            fixtures.find((fixture) => fixture.sku === product.sku)?.stock ?? 0,
          productId: product.id,
        }))
        .filter(({ availableQuantity }) => availableQuantity > 0),
    );

    const firstPage = await server.inject({
      method: "GET",
      url: "/api/v1/products?page=1&pageSize=2&sortBy=price&sortOrder=asc",
    });
    expect(firstPage.statusCode).toBe(200);
    expect(firstPage.json()).toMatchObject({
      items: [
        { sku: "GAMING-MOUSE", status: "ACTIVE", stockAvailable: 0 },
        { sku: "OFFICE-KEYBOARD", status: "ACTIVE", stockAvailable: 10 },
      ],
      page: 1,
      pageSize: 2,
      totalItems: 4,
      totalPages: 2,
    });

    const combined = await server.inject({
      method: "GET",
      url: "/api/v1/products?search=gaming&availability=IN_STOCK&minPrice=1000.00&maxPrice=2000.00&sortBy=name&sortOrder=asc",
    });
    expect(combined.statusCode).toBe(200);
    expect(combined.json()).toMatchObject({
      items: [{ sku: "GAMING-LAPTOP", stockAvailable: 5 }],
      totalItems: 1,
      totalPages: 1,
    });

    const [anonymousAdmin, customerAdmin, billingAdmin, administrative] =
      await Promise.all([
        server.inject({
          method: "GET",
          url: "/api/v1/products?view=administrative",
        }),
        server.inject({
          method: "GET",
          url: "/api/v1/products?view=administrative",
          headers: authorization(tokens.customer),
        }),
        server.inject({
          method: "GET",
          url: "/api/v1/products?view=administrative",
          headers: authorization(tokens.billing),
        }),
        server.inject({
          method: "GET",
          url: "/api/v1/products?view=administrative&status=INACTIVE",
          headers: authorization(tokens.admin),
        }),
      ]);
    expect([
      anonymousAdmin.statusCode,
      customerAdmin.statusCode,
      billingAdmin.statusCode,
    ]).toEqual([401, 403, 403]);
    expect(administrative.statusCode).toBe(200);
    expect(administrative.json()).toMatchObject({
      items: [{ sku: "GAMING-MONITOR", status: "INACTIVE" }],
      totalItems: 1,
      totalPages: 1,
    });

    const outsideRange = await server.inject({
      method: "GET",
      url: "/api/v1/products?page=99&pageSize=2",
    });
    expect(outsideRange.json()).toMatchObject({
      items: [],
      page: 99,
      pageSize: 2,
      totalItems: 4,
      totalPages: 2,
    });

    const invalidQueries = await Promise.all([
      server.inject({ method: "GET", url: "/api/v1/products?page=0" }),
      server.inject({ method: "GET", url: "/api/v1/products?pageSize=101" }),
      server.inject({ method: "GET", url: "/api/v1/products?sortBy=description" }),
      server.inject({ method: "GET", url: "/api/v1/products?status=INACTIVE" }),
      server.inject({
        method: "GET",
        url: "/api/v1/products?minPrice=20.00&maxPrice=10.00",
      }),
    ]);
    expect(invalidQueries.map((response) => response.statusCode)).toEqual([
      400, 400, 400, 400, 400,
    ]);
  });

  it("returns public detail only for active products and projects availability", async () => {
    const productRows = await database
      .select({ id: products.id, sku: products.sku })
      .from(products);
    const productId = (sku: string): string => {
      const product = productRows.find((row) => row.sku === sku);
      if (!product) throw new Error(`Expected product fixture ${sku}`);
      return product.id;
    };

    const [available, exhausted, inactive, deleted, missing] = await Promise.all([
      server.inject({
        method: "GET",
        url: `/api/v1/products/${productId("GAMING-LAPTOP")}`,
      }),
      server.inject({
        method: "GET",
        url: `/api/v1/products/${productId("GAMING-MOUSE")}`,
      }),
      server.inject({
        method: "GET",
        url: `/api/v1/products/${productId("GAMING-MONITOR")}`,
      }),
      server.inject({
        method: "GET",
        url: `/api/v1/products/${productId("NOTEBOOK-001")}`,
      }),
      server.inject({
        method: "GET",
        url: `/api/v1/products/${randomUUID()}`,
      }),
    ]);

    expect(available.statusCode).toBe(200);
    expect(available.json()).toMatchObject({
      availability: "IN_STOCK",
      sku: "GAMING-LAPTOP",
      status: "ACTIVE",
      stockAvailable: 5,
    });
    expect(exhausted.statusCode).toBe(200);
    expect(exhausted.json()).toMatchObject({
      availability: "OUT_OF_STOCK",
      sku: "GAMING-MOUSE",
      status: "ACTIVE",
      stockAvailable: 0,
    });
    expect([inactive.statusCode, deleted.statusCode, missing.statusCode]).toEqual([
      404, 404, 404,
    ]);

    const administrative = await server.inject({
      method: "GET",
      url: `/api/v1/products/${productId("GAMING-MONITOR")}?view=administrative`,
      headers: authorization(tokens.admin),
    });
    expect(administrative.statusCode).toBe(200);
    expect(administrative.json()).toMatchObject({
      availability: "IN_STOCK",
      sku: "GAMING-MONITOR",
      status: "INACTIVE",
      stockAvailable: 2,
    });
  });

  it("applies ADMIN inventory adjustments as auditable movements without negative stock", async () => {
    const [product] = await database
      .select({ id: products.id })
      .from(products)
      .where(eq(products.sku, "GAMING-LAPTOP"));
    if (!product) throw new Error("Expected the inventory product fixture");
    const payload = { quantityDelta: 4, reason: " Warehouse recount " };

    const forbidden = await Promise.all([
      server.inject({
        method: "POST",
        url: `/api/v1/inventory/${product.id}/adjustments`,
        payload,
      }),
      server.inject({
        method: "POST",
        url: `/api/v1/inventory/${product.id}/adjustments`,
        headers: authorization(tokens.customer),
        payload,
      }),
      server.inject({
        method: "POST",
        url: `/api/v1/inventory/${product.id}/adjustments`,
        headers: authorization(tokens.billing),
        payload,
      }),
    ]);
    expect(forbidden.map((response) => response.statusCode)).toEqual([
      401, 403, 403,
    ]);

    const increased = await server.inject({
      method: "POST",
      url: `/api/v1/inventory/${product.id}/adjustments`,
      headers: authorization(tokens.admin),
      payload,
    });
    expect(increased.statusCode).toBe(201);
    expect(increased.json()).toMatchObject({
      availableQuantity: 9,
      productId: product.id,
      version: 1,
      movement: {
        actorUserId: userIds.admin,
        balanceAfter: 9,
        productId: product.id,
        quantityDelta: 4,
        reason: "Warehouse recount",
        type: "ADJUSTMENT",
      },
    });

    const reduced = await server.inject({
      method: "POST",
      url: `/api/v1/inventory/${product.id}/adjustments`,
      headers: authorization(tokens.admin),
      payload: { quantityDelta: -7, reason: "Damaged units" },
    });
    expect(reduced.statusCode).toBe(201);
    expect(reduced.json()).toMatchObject({
      availableQuantity: 2,
      version: 2,
      movement: { balanceAfter: 2, quantityDelta: -7 },
    });

    const insufficient = await server.inject({
      method: "POST",
      url: `/api/v1/inventory/${product.id}/adjustments`,
      headers: authorization(tokens.admin),
      payload: { quantityDelta: -3, reason: "Invalid reduction" },
    });
    expect(insufficient.statusCode).toBe(409);
    expect(insufficient.json()).toMatchObject({
      code: "INVENTORY_INSUFFICIENT_STOCK",
      details: { availableQuantity: 2 },
    });

    const invalid = await Promise.all([
      server.inject({
        method: "POST",
        url: `/api/v1/inventory/${product.id}/adjustments`,
        headers: authorization(tokens.admin),
        payload: { quantityDelta: 0, reason: "No change" },
      }),
      server.inject({
        method: "POST",
        url: `/api/v1/inventory/${product.id}/adjustments`,
        headers: authorization(tokens.admin),
        payload: { quantityDelta: 1, reason: "   " },
      }),
    ]);
    expect(invalid.map((response) => response.statusCode)).toEqual([400, 400]);

    const missing = await server.inject({
      method: "POST",
      url: `/api/v1/inventory/${randomUUID()}/adjustments`,
      headers: authorization(tokens.admin),
      payload: { quantityDelta: 1, reason: "Missing product" },
    });
    expect(missing.statusCode).toBe(404);

    const forbiddenHistory = await server.inject({
      method: "GET",
      url: `/api/v1/inventory/${product.id}/movements`,
      headers: authorization(tokens.billing),
    });
    expect(forbiddenHistory.statusCode).toBe(403);

    const firstHistoryPage = await server.inject({
      method: "GET",
      url: `/api/v1/inventory/${product.id}/movements?page=1&pageSize=1`,
      headers: authorization(tokens.admin),
    });
    expect(firstHistoryPage.statusCode).toBe(200);
    expect(firstHistoryPage.json()).toMatchObject({
      items: [
        {
          actor: {
            displayName: "admin",
            email: "products-admin@example.com",
            id: userIds.admin,
          },
          balanceAfter: 2,
          quantityDelta: -7,
          reason: "Damaged units",
          type: "ADJUSTMENT",
        },
      ],
      page: 1,
      pageSize: 1,
      totalItems: 2,
      totalPages: 2,
    });

    const secondHistoryPage = await server.inject({
      method: "GET",
      url: `/api/v1/inventory/${product.id}/movements?page=2&pageSize=1`,
      headers: authorization(tokens.admin),
    });
    expect(secondHistoryPage.statusCode).toBe(200);
    expect(secondHistoryPage.json()).toMatchObject({
      items: [{ balanceAfter: 9, quantityDelta: 4 }],
      page: 2,
    });

    const filteredHistory = await server.inject({
      method: "GET",
      url: `/api/v1/inventory/${product.id}/movements?search=Damaged%20units&type=ADJUSTMENT&sortBy=balanceAfter&sortOrder=asc&page=1&pageSize=1`,
      headers: authorization(tokens.admin),
    });
    expect(filteredHistory.statusCode).toBe(200);
    expect(filteredHistory.json()).toMatchObject({
      page: 1,
      pageSize: 1,
      totalItems: 1,
      totalPages: 1,
      items: [{ balanceAfter: 2, reason: "Damaged units", type: "ADJUSTMENT" }],
    });
    const invalidHistoryQueries = await Promise.all([
      server.inject({ method: "GET", url: `/api/v1/inventory/${product.id}/movements?page=0`, headers: authorization(tokens.admin) }),
      server.inject({ method: "GET", url: `/api/v1/inventory/${product.id}/movements?createdFrom=2026-09-29T12:00:00Z&createdTo=2026-09-28T12:00:00Z`, headers: authorization(tokens.admin) }),
    ]);
    expect(invalidHistoryQueries.map((response) => response.statusCode)).toEqual([400, 400]);

    const [balance] = await database
      .select({
        availableQuantity: inventoryBalances.availableQuantity,
        version: inventoryBalances.version,
      })
      .from(inventoryBalances)
      .where(eq(inventoryBalances.productId, product.id));
    const movements = await database
      .select({
        actorUserId: inventoryMovements.actorUserId,
        balanceAfter: inventoryMovements.balanceAfter,
        quantityDelta: inventoryMovements.quantityDelta,
        reason: inventoryMovements.reason,
      })
      .from(inventoryMovements)
      .where(
        and(
          eq(inventoryMovements.productId, product.id),
          eq(inventoryMovements.type, "ADJUSTMENT"),
        ),
      )
      .orderBy(asc(inventoryMovements.createdAt));
    const inventoryAudits = await database
      .select({
        action: auditEntries.action,
        actorUserId: auditEntries.actorUserId,
        changes: auditEntries.changes,
        createdAt: auditEntries.createdAt,
        entityId: auditEntries.entityId,
        entityType: auditEntries.entityType,
      })
      .from(auditEntries)
      .where(
        and(
          eq(auditEntries.entityId, product.id),
          eq(auditEntries.entityType, "INVENTORY_BALANCE"),
        ),
      );
    expect(balance).toEqual({ availableQuantity: 2, version: 2 });
    expect(movements).toEqual([
      {
        actorUserId: userIds.admin,
        balanceAfter: 9,
        quantityDelta: 4,
        reason: "Warehouse recount",
      },
      {
        actorUserId: userIds.admin,
        balanceAfter: 2,
        quantityDelta: -7,
        reason: "Damaged units",
      },
    ]);
    expect(inventoryAudits.map(({ action }) => action)).toEqual([
      "INVENTORY_ADJUSTED",
      "INVENTORY_ADJUSTED",
    ]);
    expect(
      inventoryAudits.every(
        (entry) =>
          entry.actorUserId === userIds.admin &&
          entry.entityId === product.id &&
          entry.entityType === "INVENTORY_BALANCE" &&
          entry.createdAt instanceof Date &&
          Object.keys(entry.changes).length > 0,
      ),
    ).toBe(true);
  });

  it("atomically prevents two purchases from consuming the same last unit and restores it", async () => {
    const [product] = await insertProductFixtures(database, {
        description: "Fixture for concurrent inventory deduction",
        name: "Last Unit Fixture",
        price: "1000.00",
        sku: `LAST-UNIT-${randomUUID()}`,
        status: "ACTIVE",
      });
    if (!product) throw new Error("Expected the concurrent inventory fixture");
    await database.insert(inventoryBalances).values({
      availableQuantity: 1,
      productId: product.id,
    });

    const inventory = app.get(InventoryStockService);
    const attempts = await Promise.allSettled([
      inventory.deduct([{ productId: product.id, quantity: 1 }], {
        actorUserId: userIds.customer,
        reason: "Approved checkout",
        referenceId: "order-concurrent-a",
        referenceType: "ORDER",
      }),
      inventory.deduct([{ productId: product.id, quantity: 1 }], {
        actorUserId: userIds.customer,
        reason: "Approved checkout",
        referenceId: "order-concurrent-b",
        referenceType: "ORDER",
      }),
    ]);

    const fulfilled = attempts.filter((attempt) => attempt.status === "fulfilled");
    const rejected = attempts.filter((attempt) => attempt.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(fulfilled[0]?.value[0]?.availableQuantity).toBe(0);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toBeInstanceOf(InventoryStockUnavailableError);

    const [afterSales] = await database
      .select({
        availableQuantity: inventoryBalances.availableQuantity,
        version: inventoryBalances.version,
      })
      .from(inventoryBalances)
      .where(eq(inventoryBalances.productId, product.id));
    const sales = await database
      .select({
        balanceAfter: inventoryMovements.balanceAfter,
        quantityDelta: inventoryMovements.quantityDelta,
        referenceId: inventoryMovements.referenceId,
        type: inventoryMovements.type,
      })
      .from(inventoryMovements)
      .where(
        and(
          eq(inventoryMovements.productId, product.id),
          eq(inventoryMovements.type, "SALE"),
        ),
      );
    expect(afterSales).toEqual({ availableQuantity: 0, version: 1 });
    expect(sales).toHaveLength(1);
    expect(sales[0]).toMatchObject({
      balanceAfter: 0,
      quantityDelta: -1,
      type: "SALE",
    });

    await inventory.restore([{ productId: product.id, quantity: 1 }], {
      actorUserId: userIds.admin,
      reason: "Eligible order cancellation",
      referenceId: sales[0]?.referenceId ?? "missing-order-reference",
      referenceType: "ORDER",
    });

    const [restored] = await database
      .select({
        availableQuantity: inventoryBalances.availableQuantity,
        version: inventoryBalances.version,
      })
      .from(inventoryBalances)
      .where(eq(inventoryBalances.productId, product.id));
    const cancellationMovements = await database
      .select({
        balanceAfter: inventoryMovements.balanceAfter,
        quantityDelta: inventoryMovements.quantityDelta,
        type: inventoryMovements.type,
      })
      .from(inventoryMovements)
      .where(
        and(
          eq(inventoryMovements.productId, product.id),
          eq(inventoryMovements.type, "CANCELLATION"),
        ),
      );
    expect(restored).toEqual({ availableQuantity: 1, version: 2 });
    expect(cancellationMovements).toEqual([
      { balanceAfter: 1, quantityDelta: 1, type: "CANCELLATION" },
    ]);
  });

  it("creates a unique local placeholder when the image is omitted", async () => {
    const response = await server.inject({
      method: "POST",
      url: "/api/v1/products",
      headers: authorization(tokens.admin),
      payload: {
        description: "Producto temporal sin imagen cargada",
        name: "Producto Placeholder",
        price: "10.00",
        sku: "DEFAULT-IMAGE-001",
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json<ProductResponse>().image).toEqual({
      storageKey: "defaults/products/default-image-001/placeholder.svg",
      url: "/images/product-placeholder.svg",
    });
  });

  it("administers categories and tags with authorized paginated REST queries and soft deletion", async () => {
    for (const path of ["categories", "tags"]) {
      const payload = { name: path === "categories" ? "Portátiles" : "Gamer" };
      const attempts = await Promise.all([
        server.inject({ method: "POST", url: `/api/v1/${path}`, payload }),
        server.inject({ method: "POST", url: `/api/v1/${path}`, headers: authorization(tokens.customer), payload }),
        server.inject({ method: "POST", url: `/api/v1/${path}`, headers: authorization(tokens.billing), payload }),
      ]);
      expect(attempts.map((response) => response.statusCode)).toEqual([401, 403, 403]);
      const invalid = await server.inject({ method: "POST", url: `/api/v1/${path}`, headers: authorization(tokens.admin), payload: { name: " " } });
      expect(invalid.statusCode).toBe(400);
    }

    const categoryResponse = await server.inject({ method: "POST", url: "/api/v1/categories", headers: authorization(tokens.admin), payload: { name: "Portátiles", description: "Equipos móviles" } });
    const tagResponse = await server.inject({ method: "POST", url: "/api/v1/tags", headers: authorization(tokens.admin), payload: { name: "Gamer" } });
    expect([categoryResponse.statusCode, tagResponse.statusCode]).toEqual([201, 201]);
    const isoDate = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
    for (const response of [categoryResponse, tagResponse]) {
      expect(response.json()).toMatchObject({ createdAt: expect.stringMatching(isoDate), updatedAt: expect.stringMatching(isoDate), deletedAt: null });
    }
    const category = categoryResponse.json<{ id: string; slug: string }>();
    const tag = tagResponse.json<{ id: string; slug: string }>();
    expect(category.slug).toBe("portatiles");
    expect(tag.slug).toBe("gamer");

    const secondCategory = await server.inject({ method: "POST", url: "/api/v1/categories", headers: authorization(tokens.admin), payload: { name: "Audio", slug: "audio" } });
    const secondTag = await server.inject({ method: "POST", url: "/api/v1/tags", headers: authorization(tokens.admin), payload: { name: "Ofertas" } });
    expect([secondCategory.statusCode, secondTag.statusCode]).toEqual([201, 201]);
    const duplicate = await server.inject({ method: "POST", url: "/api/v1/categories", headers: authorization(tokens.admin), payload: { name: "Otro nombre", slug: "portatiles" } });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json()).toMatchObject({ code: "CLASSIFICATION_SLUG_ALREADY_EXISTS" });
    const duplicateName = await server.inject({ method: "POST", url: "/api/v1/tags", headers: authorization(tokens.admin), payload: { name: "GAMER", slug: "gamer-alternativo" } });
    expect(duplicateName.statusCode).toBe(409);
    expect(duplicateName.json()).toMatchObject({ code: "CLASSIFICATION_NAME_ALREADY_EXISTS" });

    for (const [path, search] of [["categories", "Port"], ["tags", "Gam"]] as const) {
      const page = await server.inject({ method: "GET", url: `/api/v1/${path}?search=${search}&page=1&pageSize=1&sortBy=name&sortOrder=asc` });
      expect(page.statusCode).toBe(200);
      expect(page.json()).toMatchObject({ page: 1, pageSize: 1, totalItems: 1, totalPages: 1 });
      expect(page.json<{ items: { createdAt: string; updatedAt: string }[] }>().items[0]).toMatchObject({
        createdAt: expect.stringMatching(isoDate), updatedAt: expect.stringMatching(isoDate),
      });
      const secondPage = await server.inject({ method: "GET", url: `/api/v1/${path}?page=2&pageSize=1&sortBy=name&sortOrder=asc` });
      expect(secondPage.statusCode).toBe(200);
      expect(secondPage.json()).toMatchObject({ page: 2, pageSize: 1, totalItems: path === "categories" ? 3 : 2, totalPages: path === "categories" ? 3 : 2 });
      const denied = await server.inject({ method: "GET", url: `/api/v1/${path}?view=administrative`, headers: authorization(tokens.billing) });
      expect(denied.statusCode).toBe(403);
      const invalidStatus = await server.inject({ method: "GET", url: `/api/v1/${path}?status=INACTIVE` });
      expect(invalidStatus.statusCode).toBe(400);
    }

    const renamedCategory = await server.inject({ method: "PATCH", url: `/api/v1/categories/${category.id}`, headers: authorization(tokens.admin), payload: { name: "Notebooks" } });
    expect(renamedCategory.statusCode).toBe(200);
    expect(renamedCategory.json()).toMatchObject({ name: "Notebooks", slug: "portatiles", updatedAt: expect.stringMatching(isoDate) });
    const collisionResolved = await server.inject({ method: "POST", url: "/api/v1/categories", headers: authorization(tokens.admin), payload: { name: "Portatiles" } });
    expect(collisionResolved.statusCode).toBe(201);
    expect(collisionResolved.json()).toMatchObject({ slug: "portatiles-2" });
    const renamedTag = await server.inject({ method: "PATCH", url: `/api/v1/tags/${tag.id}`, headers: authorization(tokens.admin), payload: { name: "Juego", slug: "juego" } });
    expect(renamedTag.statusCode).toBe(200);
    expect(renamedTag.json()).toMatchObject({ name: "Juego", slug: "juego" });
    const inactiveTag = await server.inject({ method: "PATCH", url: `/api/v1/tags/${tag.id}`, headers: authorization(tokens.admin), payload: { status: "INACTIVE" } });
    expect(inactiveTag.statusCode).toBe(200);
    expect((await server.inject({ method: "GET", url: `/api/v1/tags/${tag.id}` })).statusCode).toBe(404);
    expect((await server.inject({ method: "GET", url: `/api/v1/tags/${tag.id}?view=administrative`, headers: authorization(tokens.admin) })).statusCode).toBe(200);
    const filteredTags = await server.inject({ method: "GET", url: "/api/v1/tags?view=administrative&status=INACTIVE&sortBy=updatedAt&sortOrder=desc", headers: authorization(tokens.admin) });
    expect(filteredTags.statusCode).toBe(200);
    expect(filteredTags.json()).toMatchObject({ totalItems: 1, items: [{ id: tag.id, status: "INACTIVE" }] });
    const publicTags = await server.inject({ method: "GET", url: "/api/v1/tags" });
    expect(publicTags.json()).toMatchObject({ totalItems: 1, items: [{ name: "Ofertas" }] });
    const reactivatedTag = await server.inject({ method: "PATCH", url: `/api/v1/tags/${tag.id}`, headers: authorization(tokens.admin), payload: { status: "ACTIVE" } });
    expect(reactivatedTag.statusCode).toBe(200);
    expect((await server.inject({ method: "GET", url: `/api/v1/tags/${tag.id}` })).statusCode).toBe(200);

    const product = await database.insert(products).values({ sku: "CLASSIFICATION-REF-001", name: "Producto clasificado", description: "Referencia histórica", price: "10.00", categoryId: category.id }).returning({ id: products.id });
    expect(product[0]).toBeDefined();
    await database.insert(productTags).values({ productId: product[0]!.id, tagId: tag.id });
    const deletedCategory = await server.inject({ method: "DELETE", url: `/api/v1/categories/${category.id}`, headers: authorization(tokens.admin) });
    const deletedTag = await server.inject({ method: "DELETE", url: `/api/v1/tags/${tag.id}`, headers: authorization(tokens.admin) });
    expect([deletedCategory.statusCode, deletedTag.statusCode]).toEqual([204, 204]);
    const [storedProduct] = await database.select().from(products).where(eq(products.id, product[0]!.id));
    const [storedProductTag] = await database.select().from(productTags).where(eq(productTags.productId, product[0]!.id));
    const [storedCategory] = await database.select().from(categories).where(eq(categories.id, category.id));
    const [storedTag] = await database.select().from(tags).where(eq(tags.id, tag.id));
    expect(storedProduct?.categoryId).toBe(category.id);
    expect(storedProductTag?.tagId).toBe(tag.id);
    expect(storedCategory).toMatchObject({ status: "INACTIVE" });
    expect(storedCategory?.deletedAt).toBeInstanceOf(Date);
    expect(storedTag?.deletedAt).toBeInstanceOf(Date);
    expect((await server.inject({ method: "GET", url: `/api/v1/categories/${category.id}?view=administrative`, headers: authorization(tokens.admin) })).statusCode).toBe(404);

    const openapi = await server.inject({ method: "GET", url: "/api/v1/openapi.json" });
    expect(openapi.statusCode).toBe(200);
    expect(openapi.json()).toMatchObject({ paths: {
      "/api/v1/categories": { get: { operationId: "listCategories" }, post: { operationId: "createCategory" } },
      "/api/v1/tags": { get: { operationId: "listTags" }, post: { operationId: "createTag" } },
    } });
  });

  it("classifies products, filters combinations and resolves only public slugs", async () => {
    const [category, otherCategory] = await database.insert(categories).values([
      { name: "Clasificación audio", slug: "clasificacion-audio" },
      { name: "Clasificación video", slug: "clasificacion-video" },
    ]).returning({ id: categories.id });
    const [tag, otherTag] = await database.insert(tags).values([
      { name: "Clasificación premium", slug: "clasificacion-premium" },
      { name: "Clasificación portátil", slug: "clasificacion-portatil" },
    ]).returning({ id: tags.id });
    if (!category || !otherCategory || !tag || !otherTag) throw new Error("Classification fixtures failed");

    const missingCategory = await server.inject({ method: "POST", url: "/api/v1/products", headers: authorization(tokens.admin), payload: { ...productPayload, sku: "CLASS-NO-CAT", status: "ACTIVE" } });
    expect(missingCategory.statusCode).toBe(400);
    expect(missingCategory.json()).toMatchObject({ code: "PRODUCT_CATEGORY_REQUIRED" });

    const created = await server.inject({ method: "POST", url: "/api/v1/products", headers: authorization(tokens.admin), payload: { ...productPayload, sku: "CLASS-AUDIO-001", name: "Altavoz Clasificado", status: "ACTIVE", categoryId: category.id, tagIds: [tag.id, otherTag.id], image: { storageKey: "products/class-audio/cover.webp", url: "/images/product-placeholder.svg" } } });
    expect(created.statusCode).toBe(201);
    const product = created.json<ProductResponse>();
    expect(product).toMatchObject({ slug: "altavoz-clasificado", category: { id: category.id }, tags: [{ id: tag.id }, { id: otherTag.id }] });
    const slugDetail = await server.inject({ method: "GET", url: `/api/v1/products/slug/${product.slug}` });
    expect(slugDetail.statusCode).toBe(200);
    expect(slugDetail.json()).toMatchObject({ id: product.id, category: { id: category.id }, tags: [{ id: tag.id }, { id: otherTag.id }] });

    const creationDate = new Date().toISOString().slice(0, 10);
    await database.update(products).set({ createdAt: new Date(`${creationDate}T23:59:59.999Z`) }).where(eq(products.id, product.id));

    const filtered = await server.inject({ method: "GET", url: `/api/v1/products?categoryId=${category.id}&tagIds=${tag.id},${otherTag.id}&search=Altavoz&minPrice=1000&maxPrice=2000` });
    expect(filtered.statusCode).toBe(200);
    expect(filtered.json()).toMatchObject({ totalItems: 1, items: [{ id: product.id }] });
    const administrativeFilters = await server.inject({
      method: "GET",
      url: `/api/v1/products?view=administrative&categoryId=${category.id}&tagIds=${tag.id},${otherTag.id}&minPrice=1000&maxPrice=2000&createdFrom=${creationDate}&createdTo=${creationDate}`,
      headers: authorization(tokens.admin),
    });
    expect(administrativeFilters.statusCode).toBe(200);
    expect(administrativeFilters.json()).toMatchObject({ totalItems: 1, items: [{ id: product.id }] });
    const outsideCreationDate = await server.inject({
      method: "GET",
      url: `/api/v1/products?view=administrative&createdFrom=2020-01-01&createdTo=2020-01-01`,
      headers: authorization(tokens.admin),
    });
    expect(outsideCreationDate.json()).toMatchObject({ totalItems: 0, items: [] });
    for (const invalidUrl of [
      "/api/v1/products?view=administrative&createdFrom=2026-02-30",
      "/api/v1/products?view=administrative&createdFrom=2026-09-30&createdTo=2026-09-01",
      "/api/v1/products?createdFrom=2026-09-01",
    ]) {
      const invalid = await server.inject({ method: "GET", url: invalidUrl, headers: authorization(tokens.admin) });
      expect(invalid.statusCode).toBe(400);
    }
    const wrongCategory = await server.inject({ method: "GET", url: `/api/v1/products?categoryId=${otherCategory.id}&tagIds=${tag.id}` });
    expect(wrongCategory.json()).toMatchObject({ totalItems: 0 });

    const edited = await server.inject({ method: "PATCH", url: `/api/v1/products/${product.id}`, headers: authorization(tokens.admin), payload: { name: "Altavoz Nuevo", tagIds: [otherTag.id] } });
    expect(edited.statusCode).toBe(200);
    expect(edited.json()).toMatchObject({ slug: product.slug, tags: [{ id: otherTag.id }] });
    const [links] = await database.select().from(productTags).where(eq(productTags.productId, product.id));
    expect(links?.tagId).toBe(otherTag.id);

    await database.update(tags).set({ status: "INACTIVE" }).where(eq(tags.id, tag.id));
    const invalidTag = await server.inject({ method: "PATCH", url: `/api/v1/products/${product.id}`, headers: authorization(tokens.admin), payload: { tagIds: [tag.id] } });
    expect(invalidTag.statusCode).toBe(400);
    expect(invalidTag.json()).toMatchObject({ code: "PRODUCT_CLASSIFICATION_UNAVAILABLE" });
    await database.update(categories).set({ status: "INACTIVE" }).where(eq(categories.id, otherCategory.id));
    const invalidCategory = await server.inject({ method: "PATCH", url: `/api/v1/products/${product.id}`, headers: authorization(tokens.admin), payload: { categoryId: otherCategory.id } });
    expect(invalidCategory.statusCode).toBe(400);
    expect(invalidCategory.json()).toMatchObject({ code: "PRODUCT_CLASSIFICATION_UNAVAILABLE" });
    const current = await server.inject({ method: "GET", url: `/api/v1/products/slug/${product.slug}` });
    expect(current.statusCode).toBe(200);
    expect(current.json()).toMatchObject({ tags: [{ id: otherTag.id }] });
    await database.update(products).set({ status: "INACTIVE" }).where(eq(products.id, product.id));
    expect((await server.inject({ method: "GET", url: `/api/v1/products/slug/${product.slug}` })).statusCode).toBe(404);
  });

  it("creates or reuses inline tags with product changes in one transaction", async () => {
    const [existing] = await database.insert(tags).values({ name: "Inline RGB", slug: "inline-rgb" }).returning({ id: tags.id });
    if (!existing) throw new Error("Tag fixture failed");
    const created = await server.inject({
      method: "POST", url: "/api/v1/products", headers: authorization(tokens.admin),
      payload: { ...productPayload, sku: "INLINE-TAGS-001", image: { storageKey: "products/inline-tags-001/cover.webp", url: "/images/product-placeholder.svg" }, tagIds: [existing.id], tagNames: ["  inline rgb  ", "Óptico", "óptico"] },
    });
    expect(created.statusCode).toBe(201);
    const product = created.json<ProductResponse & { tags: { id: string; name: string; slug: string }[] }>();
    expect(product.tags).toHaveLength(2);
    expect(product.tags.map((tag) => tag.id)).toContain(existing.id);
    expect(product.tags.map((tag) => tag.slug)).toContain("optico");
    expect(await database.select({ id: tags.id }).from(tags).where(eq(tags.slug, "optico"))).toHaveLength(1);

    const updated = await server.inject({ method: "PATCH", url: `/api/v1/products/${product.id}`, headers: authorization(tokens.admin), payload: { slug: "inline-producto-renovado", tagIds: [existing.id], tagNames: ["ÓPTICO", "Nuevo inline"] } });
    expect(updated.statusCode).toBe(200);
    expect(updated.json<{ slug: string; tags: unknown[] }>()).toMatchObject({ slug: "inline-producto-renovado" });
    expect(updated.json<{ tags: unknown[] }>().tags).toHaveLength(3);
    expect(await database.select({ id: productTags.tagId }).from(productTags).where(eq(productTags.productId, product.id))).toHaveLength(3);

    const unchanged = await server.inject({ method: "PATCH", url: `/api/v1/products/${product.id}`, headers: authorization(tokens.admin), payload: { name: "Producto renombrado" } });
    expect(unchanged.statusCode).toBe(200);
    expect(unchanged.json<{ tags: unknown[] }>().tags).toHaveLength(3);

    const rollback = await server.inject({ method: "POST", url: "/api/v1/products", headers: authorization(tokens.admin), payload: { ...productPayload, sku: "INLINE-TAGS-001", image: { storageKey: "products/inline-rollback/cover.webp", url: "/images/product-placeholder.svg" }, tagNames: ["Etiqueta reversible"] } });
    expect(rollback.statusCode).toBe(409);
    expect(await database.select({ id: tags.id }).from(tags).where(eq(tags.name, "Etiqueta reversible"))).toHaveLength(0);

    const [inactive] = await database.insert(tags).values({ name: "Inline inactiva", slug: "inline-inactiva", status: "INACTIVE" }).returning({ id: tags.id });
    if (!inactive) throw new Error("Inactive tag fixture failed");
    const rejected = await server.inject({ method: "PATCH", url: `/api/v1/products/${product.id}`, headers: authorization(tokens.admin), payload: { tagNames: ["INLINE INACTIVA"] } });
    expect(rejected.statusCode).toBe(400);
    expect(rejected.json()).toMatchObject({ code: "PRODUCT_TAG_INACTIVE", details: [{ field: "tagNames" }] });
    const limited = await server.inject({ method: "PATCH", url: `/api/v1/products/${product.id}`, headers: authorization(tokens.admin), payload: { tagIds: [existing.id], tagNames: Array.from({ length: 20 }, (_, index) => `Etiqueta límite ${index}`) } });
    expect(limited.statusCode).toBe(400);
    expect(limited.json()).toMatchObject({ code: "PRODUCT_TAG_LIMIT_EXCEEDED" });
    expect(await database.select({ id: tags.id }).from(tags).where(eq(tags.name, "Etiqueta límite 0"))).toHaveLength(0);
  });

  it("reuses a single tag when product creations race", async () => {
    const responses = await Promise.all([1, 2].map((number) => server.inject({
      method: "POST", url: "/api/v1/products", headers: authorization(tokens.admin),
      payload: { ...productPayload, sku: `INLINE-RACE-${number}`, image: { storageKey: `products/inline-race-${number}/cover.webp`, url: "/images/product-placeholder.svg" }, tagNames: ["Concurrente inline"] },
    })));
    expect(responses.map((response) => response.statusCode)).toEqual([201, 201]);
    const [first, second] = responses.map((response) => response.json<{ tags: { id: string }[] }>());
    expect(first?.tags[0]?.id).toBe(second?.tags[0]?.id);
    expect(await database.select({ id: tags.id }).from(tags).where(eq(tags.name, "Concurrente inline"))).toHaveLength(1);
  });
});
