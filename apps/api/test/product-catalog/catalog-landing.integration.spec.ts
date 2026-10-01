import "dotenv/config";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import Ajv, { type AnySchema } from "ajv";
import addFormats from "ajv-formats";
import { eq, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { FastifyInstance } from "fastify";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { configureApplication } from "../../src/application";
import { DatabaseService, type DatabaseTransaction } from "../../src/database/database.service";
import { categories, inventoryBalances, productImages, productTags, products, roleAssignments, sessions, tags, users } from "../../src/database/schema";
import { AuthTokenService } from "../../src/identity-access/auth-token.service";
import { ProductAdministrationRepository } from "../../src/product-catalog/product-administration.repository";
import { insertProductFixtures } from "../product-fixtures";

const sourceUrl = process.env.DATABASE_URL;
if (!sourceUrl) throw new Error("DATABASE_URL is required for landing integration tests");
const databaseName = `ecommerce_landing_${randomUUID().replaceAll("-", "")}`;
if (!/^ecommerce_landing_[a-f0-9]{32}$/.test(databaseName)) throw new Error("Unsafe landing test database name");
const maintenanceUrl = new URL(sourceUrl);
maintenanceUrl.pathname = "/postgres";
const isolatedUrl = new URL(sourceUrl);
isolatedUrl.pathname = `/${databaseName}`;
const originalEnvironment = { ...process.env };
let maintenance: Pool;
let created = false;
let app: NestFastifyApplication;
let server: FastifyInstance;
let database: DatabaseService["client"];
let validateContract: ReturnType<Ajv["compile"]>;
const tokens: string[] = [];
const getLanding = (suffix = "", token?: string) => server.inject({ method: "GET", url: `/api/v1/catalog/landing${suffix}`, headers: token ? { authorization: `Bearer ${token}` } : {} });
const productId = (index: number) => `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
const base = Date.parse("2026-01-01T00:00:00Z");

async function fixture(count = 18, editorial = true) {
  const classificationRows = await database.insert(categories).values([0, 1, 2].map((index) => ({
    name: `Category ${index}`, slug: `category-${index}`, showOnLanding: editorial, landingOrder: editorial ? [3, 1, 2][index] : null,
  }))).returning();
  const rows = await insertProductFixtures(database, Array.from({ length: count }, (_, index) => ({
    id: productId(index), sku: `LANDING-${index}`, name: `Product ${index}`, slug: `product-${index}`,
    description: "Landing fixture", price: "100.00", status: "ACTIVE" as const,
    categoryId: classificationRows[index % 3]!.id, createdAt: new Date(base + index * 1000),
    isFeatured: editorial && index >= count - 4, featuredAt: editorial && index >= count - 4 ? new Date(base) : null,
  })));
  await database.insert(inventoryBalances).values(rows.map((row, index) => ({ productId: row.id, availableQuantity: index })));
  await database.insert(productImages).values(rows.map((row) => ({ productId: row.id, storageKey: `gallery/${row.id}`, url: "/images/other.svg", altText: "Additional image", isPrimary: false, sortOrder: 1 })));
  return classificationRows;
}

function bodyOf(response: Awaited<ReturnType<typeof getLanding>>) {
  expect(response.statusCode).toBe(200);
  const body = response.json();
  expect(validateContract(body), JSON.stringify(validateContract.errors)).toBe(true);
  return body as {
    featuredProducts: { id: string; category: { id: string; name: string } | null; tags: { id: string; name: string }[]; stockAvailable: number; coverImage: { isPrimary: boolean; altText: string }; name: string }[];
    latestProducts: { id: string; category: { id: string; name: string } | null; tags: { id: string; name: string }[]; stockAvailable: number; coverImage: { isPrimary: boolean; altText: string }; name: string }[];
    highlightedCategories: { category: { id: string; name: string }; products: { id: string; category: { id: string } | null }[] }[];
  };
}

describe("fixed public landing composition", () => {
  beforeAll(async () => {
    maintenance = new Pool({ connectionString: maintenanceUrl.toString(), max: 1 });
    await maintenance.query(`create database "${databaseName}" template template0`);
    created = true;
    Object.assign(process.env, { NODE_ENV: "test", DATABASE_URL: isolatedUrl.toString(), AUTH_ACCESS_TOKEN_SECRET: "landing-test-secret-at-least-32-characters", AUTH_ACCESS_TOKEN_TTL_SECONDS: "900", AUTH_REFRESH_TOKEN_TTL_SECONDS: "3600" });
    const { AppModule } = await import("../../src/app.module");
    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), { logger: false });
    configureApplication(app);
    await app.init();
    server = app.getHttpAdapter().getInstance() as FastifyInstance;
    await server.ready();
    database = app.get(DatabaseService).client;
    await migrate(database, { migrationsFolder: resolve("src/database/migrations") });
    for (const role of ["ADMIN", "BILLING", "CUSTOMER"] as const) {
      const [actor] = await database.insert(users).values({ email: `${role}@landing.example.com`, displayName: role, passwordHash: "unused-test-hash" }).returning();
      await database.insert(roleAssignments).values({ userId: actor!.id, role });
      const service = app.get(AuthTokenService);
      const refresh = service.createRefreshToken();
      const now = new Date();
      const expiresAt = service.createSessionExpiry(now);
      await database.insert(sessions).values({ id: refresh.sessionId, tokenHash: refresh.tokenHash, userId: actor!.id, expiresAt });
      tokens.push(service.createAccessToken({ now, sessionExpiresAt: expiresAt, sessionId: refresh.sessionId, userId: actor!.id }).token);
    }
    const document = JSON.parse(await readFile(resolve("openapi/openapi.json"), "utf8"));
    const operation = document.paths["/api/v1/catalog/landing"].get;
    expect(operation.operationId).toBe("getCatalogLanding");
    expect(operation.parameters ?? []).toEqual([]);
    expect(operation.security ?? []).toEqual([]);
    const ajv = new Ajv({ strict: false });
    addFormats(ajv);
    const schemaId = "urn:technology-ecommerce:landing-contract";
    const schema = JSON.parse(JSON.stringify(operation.responses["200"].content["application/json"].schema).replaceAll('"#/', `"${schemaId}#/`)) as AnySchema;
    ajv.addSchema(JSON.parse(JSON.stringify({ $id: schemaId, components: document.components }).replaceAll('"#/', `"${schemaId}#/`)));
    validateContract = ajv.compile(schema);
    expect(document.components.schemas.LandingProductDto.properties).not.toHaveProperty("isFeatured");
    expect(document.components.schemas.LandingProductDto.properties).not.toHaveProperty("featuredAt");
  }, 30_000);

  beforeEach(async () => {
    vi.restoreAllMocks();
    await database.execute(sql`truncate table products, categories, tags cascade`);
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await app?.close();
    for (const key of ["NODE_ENV", "DATABASE_URL", "AUTH_ACCESS_TOKEN_SECRET", "AUTH_ACCESS_TOKEN_TTL_SECONDS", "AUTH_REFRESH_TOKEN_TTL_SECONDS"]) {
      if (originalEnvironment[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnvironment[key];
    }
    if (created) {
      await maintenance.query("select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()", [databaseName]);
      await maintenance.query(`drop database "${databaseName}"`);
    }
    await maintenance?.end();
  }, 30_000);

  it("returns empty arrays on an empty catalog without requiring authentication", async () => {
    const response = await getLanding();
    expect(bodyOf(response)).toEqual({ featuredProducts: [], latestProducts: [], highlightedCategories: [] });
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("denies non-admin editorial writes without changing the public composition or persistence", async () => {
    const rows = await fixture(18, false);
    const before = bodyOf(await getLanding());
    const beforeProducts = await database.select().from(products).orderBy(products.id);
    const beforeCategories = await database.select().from(categories).orderBy(categories.id);
    for (const token of [undefined, tokens[1], tokens[2]]) {
      const headers = token ? { authorization: `Bearer ${token}` } : {};
      const expected = token ? 403 : 401;
      for (const command of [
        { url: `/api/v1/products/${productId(0)}`, payload: { isFeatured: true } },
        { url: `/api/v1/categories/${rows[0]!.id}`, payload: { showOnLanding: true } },
        { url: `/api/v1/categories/${rows[0]!.id}`, payload: { landingOrder: 1 } },
      ]) {
        const response = await server.inject({ method: "PATCH", headers, ...command });
        expect(response.statusCode).toBe(expected);
      }
    }
    expect(bodyOf(await getLanding())).toEqual(before);
    expect(await database.select().from(products).orderBy(products.id)).toEqual(beforeProducts);
    expect(await database.select().from(categories).orderBy(categories.id)).toEqual(beforeCategories);
  });

  it("reflects the administrative REST lifecycle in the public contract without changing inventory", async () => {
    const rows = await fixture(18, false);
    const beforeBalances = await database.select().from(inventoryBalances).orderBy(inventoryBalances.productId);
    const patch = (url: string, payload: Record<string, unknown>) => server.inject({ method: "PATCH", url, payload, headers: { authorization: `Bearer ${tokens[0]}` } });
    for (const index of [0, 1, 2]) expect((await patch(`/api/v1/products/${productId(index)}`, { isFeatured: true })).statusCode).toBe(200);
    for (const index of [2, 0, 1]) expect((await patch(`/api/v1/categories/${rows[index]!.id}`, { showOnLanding: true })).statusCode).toBe(200);
    const complete = bodyOf(await getLanding());
    expect(new Set(complete.featuredProducts.map((row) => row.id))).toEqual(new Set([0, 1, 2].map(productId)));
    expect(complete.latestProducts).toHaveLength(9);
    expect(complete.latestProducts.some((row) => complete.featuredProducts.some((featured) => featured.id === row.id))).toBe(false);
    expect(complete.highlightedCategories.map((section) => section.category.id)).toEqual([rows[2]!.id, rows[0]!.id, rows[1]!.id]);
    const [extra] = await database.insert(categories).values({ name: "Fourth", slug: "fourth" }).returning();
    expect((await patch(`/api/v1/categories/${extra!.id}`, { showOnLanding: true })).statusCode).toBe(409);
    expect(bodyOf(await getLanding())).toEqual(complete);
    expect((await patch(`/api/v1/categories/${rows[2]!.id}`, { landingOrder: 3 })).statusCode).toBe(200);
    expect(bodyOf(await getLanding()).highlightedCategories.map((section) => section.category.id)).toEqual([rows[1]!.id, rows[0]!.id, rows[2]!.id]);
    expect((await patch(`/api/v1/products/${productId(2)}/status`, { status: "INACTIVE" })).statusCode).toBe(200);
    expect((await patch(`/api/v1/categories/${rows[0]!.id}`, { status: "INACTIVE" })).statusCode).toBe(200);
    const partial = bodyOf(await getLanding());
    expect(partial.featuredProducts.map((row) => row.id)).not.toContain(productId(2));
    expect(partial.latestProducts.map((row) => row.id)).not.toContain(productId(2));
    expect(partial.highlightedCategories.map((section) => section.category.id)).toEqual([rows[1]!.id, rows[2]!.id]);
    expect((await patch(`/api/v1/products/${productId(0)}`, { isFeatured: false })).statusCode).toBe(200);
    expect((await patch(`/api/v1/categories/${rows[1]!.id}`, { showOnLanding: false })).statusCode).toBe(200);
    expect(bodyOf(await getLanding()).featuredProducts.map((row) => row.id)).toEqual([productId(1)]);
    expect(bodyOf(await getLanding()).highlightedCategories.map((section) => section.category.id)).toEqual([rows[2]!.id]);
    expect(await database.select().from(inventoryBalances).orderBy(inventoryBalances.productId)).toEqual(beforeBalances);
  });

  it("applies SQL limits, deterministic date/ID ordering, deduplication and category repetition", async () => {
    const categoryRows = await fixture();
    const body = bodyOf(await getLanding());
    expect(body.featuredProducts.map((row) => row.id)).toEqual([17, 16, 15].map(productId));
    expect(body.latestProducts.map((row) => row.id)).toEqual([14, 13, 12, 11, 10, 9, 8, 7, 6].map(productId));
    expect(body.highlightedCategories.map((section) => section.category.id)).toEqual([categoryRows[1]!.id, categoryRows[2]!.id, categoryRows[0]!.id]);
    expect(body.highlightedCategories.map((section) => section.products.map((row) => row.id))).toEqual([[16, 13, 10], [17, 14, 11], [15, 12, 9]].map((ids) => ids.map(productId)));
    expect(body.featuredProducts[0]).toMatchObject({ stockAvailable: 17, coverImage: { isPrimary: true, altText: "Product 17" } });
    const serialized = JSON.stringify(body);
    for (const field of ["isFeatured", "featuredAt", "showOnLanding", "landingOrder", "deletedAt", "availableQuantity", "images", "totalItems", "pageSize"]) expect(serialized).not.toContain(`"${field}"`);
    for (const token of tokens) expect(bodyOf(await getLanding("", token))).toEqual(body);
    await database.update(products).set({ featuredAt: new Date(base + 100_000), isFeatured: true }).where(eq(products.id, productId(0)));
    expect(bodyOf(await getLanding()).featuredProducts.map((row) => row.id)).toEqual([0, 17, 16].map(productId));
  });

  it("handles partial configuration, no editorial selection, missing stock and equal creation dates", async () => {
    await fixture(2, false);
    await database.delete(inventoryBalances).where(eq(inventoryBalances.productId, productId(0)));
    await database.update(products).set({ createdAt: new Date(base) });
    const body = bodyOf(await getLanding());
    expect(body.featuredProducts).toEqual([]);
    expect(body.highlightedCategories).toEqual([]);
    expect(body.latestProducts.map((row) => row.id)).toEqual([1, 0].map(productId));
    expect(body.latestProducts[1]!.stockAvailable).toBe(0);
  });

  it("omits inactive/deleted products, classifications and empty or inactive selected categories", async () => {
    const categoryRows = await fixture(4);
    await database.update(products).set({ status: "INACTIVE" }).where(eq(products.id, productId(3)));
    await database.update(products).set({ status: "INACTIVE", deletedAt: new Date() }).where(eq(products.id, productId(0)));
    await database.update(categories).set({ status: "INACTIVE" }).where(eq(categories.id, categoryRows[1]!.id));
    const tagRows = await database.insert(tags).values([{ name: "Active", slug: "active" }, { name: "Inactive", slug: "inactive", status: "INACTIVE" }, { name: "Deleted", slug: "deleted", status: "INACTIVE", deletedAt: new Date() }]).returning();
    await database.insert(productTags).values(tagRows.map((tag, sortOrder) => ({ productId: productId(1), tagId: tag.id, sortOrder })));
    const body = bodyOf(await getLanding());
    expect(body.featuredProducts.map((row) => row.id)).toEqual([2, 1].map(productId));
    expect(body.latestProducts).toEqual([]);
    expect(body.highlightedCategories.map((section) => section.category.id)).toEqual([categoryRows[2]!.id]);
    expect(body.featuredProducts[1]).toMatchObject({ category: null, tags: [{ id: tagRows[0]!.id }] });
    await database.update(categories).set({ status: "INACTIVE", deletedAt: new Date() }).where(eq(categories.id, categoryRows[2]!.id));
    expect(bodyOf(await getLanding()).highlightedCategories).toEqual([]);
  });

  it.each(["page=1", "pageSize=100", "search=notebook", "categoryId=x", "tagIds=x", "view=administrative", "sortBy=price", "status=INACTIVE", "unknown=x"])("rejects unsupported query %s", async (query) => {
    const response = await getLanding(`?${query}`);
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: "REQUEST_VALIDATION_FAILED" });
  });

  it("hydrates classifications from the same snapshot despite a concurrent committed edit", async () => {
    const categoryRows = await fixture(2, false);
    const [tag] = await database.insert(tags).values({ name: "Before", slug: "before" }).returning();
    await database.insert(productTags).values({ productId: productId(1), tagId: tag!.id });
    const repository = app.get(ProductAdministrationRepository);
    // Interleave a real second connection before the hydration reads; no production hook.
    const reader = repository as unknown as { loadClassifications(ids: string[], transaction: DatabaseTransaction, publicOnly: boolean): Promise<unknown> };
    const original = reader.loadClassifications.bind(repository);
    vi.spyOn(reader, "loadClassifications").mockImplementationOnce(async (...args) => {
      await database.transaction(async (transaction) => {
        await transaction.update(categories).set({ name: "After category" }).where(eq(categories.id, categoryRows[1]!.id));
        await transaction.update(tags).set({ name: "After tag" }).where(eq(tags.id, tag!.id));
      });
      return original(...args);
    });
    const body = bodyOf(await getLanding());
    expect(body.latestProducts[0]).toMatchObject({ category: { name: "Category 1" }, tags: [{ name: "Before" }] });
    const next = bodyOf(await getLanding());
    expect(next.latestProducts[0]).toMatchObject({ category: { name: "After category" }, tags: [{ name: "After tag" }] });
  });
});
