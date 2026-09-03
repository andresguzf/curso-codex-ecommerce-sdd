import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { and, asc, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { FastifyInstance } from "fastify";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { configureApplication } from "../../src/application";
import {
  auditEntries,
  inventoryBalances,
  inventoryMovements,
  productImages,
  products,
  roleAssignments,
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
  name: string;
  description: string;
  price: string;
  currency: string;
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

const productPayload = {
  currency: "clp",
  description: "Notebook profesional para desarrollo",
  image: {
    storageKey: "products/notebook-pro/cover.webp",
    url: "https://cdn.example.com/products/notebook-pro/cover.webp",
  },
  name: "Notebook Pro 14",
  price: "1299990.00",
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
  }, 30_000);

  it("rejects anonymous, CUSTOMER and BILLING product mutations", async () => {
    const responses = await Promise.all([
      server.inject({ method: "POST", url: "/api/v1/products", payload: productPayload }),
      server.inject({ method: "POST", url: "/api/v1/products", headers: authorization(tokens.customer), payload: productPayload }),
      server.inject({ method: "POST", url: "/api/v1/products", headers: authorization(tokens.billing), payload: productPayload }),
    ]);
    expect(responses.map((response) => response.statusCode)).toEqual([401, 403, 403]);
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
      currency: "CLP",
      image: productPayload.image,
      price: "1299990.00",
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
    const duplicate = await server.inject({
      method: "POST",
      url: "/api/v1/products",
      headers: authorization(tokens.admin),
      payload: { ...productPayload, image: { ...productPayload.image, storageKey: "products/duplicate/cover.webp" }, sku: "notebook-001" },
    });
    expect(negativePrice.statusCode).toBe(400);
    expect(directStock.statusCode).toBe(400);
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json()).toMatchObject({ code: "PRODUCT_SKU_ALREADY_EXISTS" });
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
      .select({ action: auditEntries.action })
      .from(auditEntries)
      .where(eq(auditEntries.entityId, existing.id))
      .orderBy(asc(auditEntries.createdAt));
    expect(persisted?.status).toBe("INACTIVE");
    expect(persisted?.deletedAt).toBeInstanceOf(Date);
    expect(persistedImage?.storageKey).toBe(productPayload.image.storageKey);
    expect(actions.map(({ action }) => action)).toEqual([
      "PRODUCT_CREATED",
      "PRODUCT_UPDATED",
      "PRODUCT_ACTIVATED",
      "PRODUCT_DELETED",
    ]);
  });

  it("lists public and administrative products with SQL filters, ordering and totals", async () => {
    const fixtures = [
      {
        currency: "USD",
        description: "Gaming performance notebook",
        name: "Gaming Laptop",
        price: "1500.00",
        sku: "GAMING-LAPTOP",
        status: "ACTIVE" as const,
        stock: 5,
      },
      {
        currency: "USD",
        description: "Quiet office keyboard",
        name: "Office Keyboard",
        price: "80.00",
        sku: "OFFICE-KEYBOARD",
        status: "ACTIVE" as const,
        stock: 10,
      },
      {
        currency: "USD",
        description: "Wireless gaming mouse",
        name: "Gaming Mouse",
        price: "50.00",
        sku: "GAMING-MOUSE",
        status: "ACTIVE" as const,
        stock: 0,
      },
      {
        currency: "USD",
        description: "Wide gaming display",
        name: "Gaming Monitor",
        price: "400.00",
        sku: "GAMING-MONITOR",
        status: "INACTIVE" as const,
        stock: 2,
      },
      {
        currency: "EUR",
        description: "Mirrorless travel camera",
        name: "Travel Camera",
        price: "900.00",
        sku: "TRAVEL-CAMERA",
        status: "ACTIVE" as const,
        stock: 3,
      },
    ];
    const created = await database
      .insert(products)
      .values(
        fixtures.map((fixture) => ({
          currency: fixture.currency,
          description: fixture.description,
          name: fixture.name,
          price: fixture.price,
          sku: fixture.sku,
          status: fixture.status,
        })),
      )
      .returning({ id: products.id, sku: products.sku });
    await database.insert(productImages).values(
      created.map((product) => ({
        productId: product.id,
        storageKey: `products/${product.sku.toLowerCase()}/cover.webp`,
        url: `https://cdn.example.com/products/${product.sku.toLowerCase()}/cover.webp`,
      })),
    );
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
      url: "/api/v1/products?search=gaming&availability=IN_STOCK&currency=usd&minPrice=1000.00&maxPrice=2000.00&sortBy=name&sortOrder=asc",
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
      .select({ action: auditEntries.action })
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
    expect(inventoryAudits).toEqual([
      { action: "INVENTORY_ADJUSTED" },
      { action: "INVENTORY_ADJUSTED" },
    ]);
  });

  it("atomically prevents two purchases from consuming the same last unit and restores it", async () => {
    const [product] = await database
      .insert(products)
      .values({
        currency: "CLP",
        description: "Fixture for concurrent inventory deduction",
        name: "Last Unit Fixture",
        price: "1000.00",
        sku: `LAST-UNIT-${randomUUID()}`,
        status: "ACTIVE",
      })
      .returning({ id: products.id });
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
});
