import { createHash, randomBytes, randomUUID } from "node:crypto";
import { resolve } from "node:path";

import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { FastifyInstance } from "fastify";
import { Pool } from "pg";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { configureApplication } from "../../src/application";
import {
  cartItems,
  auditEntries,
  invoiceLines,
  invoices,
  carts,
  idempotencyRecords,
  inventoryBalances,
  inventoryMovements,
  orderItems,
  orders,
  payments,
  productImages,
  products,
  roleAssignments,
  users,
} from "../../src/database/schema";
import * as schema from "../../src/database/schema";
import { hashPassword } from "../../src/identity-access/password/password";
import { InventoryStockService } from "../../src/inventory-control/inventory-stock.service";
import { AnonymousCartCleanupService } from "../../src/shopping-cart-checkout/anonymous-cart-cleanup.service";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for cart integration tests");
}

const originalEnvironment = {
  accessSecret: process.env.AUTH_ACCESS_TOKEN_SECRET,
  accessTtl: process.env.AUTH_ACCESS_TOKEN_TTL_SECONDS,
  databaseUrl: process.env.DATABASE_URL,
  refreshTtl: process.env.AUTH_REFRESH_TOKEN_TTL_SECONDS,
};
const testDatabaseName = `ecommerce_cart_${randomUUID().replaceAll("-", "")}`;
if (!/^ecommerce_cart_[a-f0-9]{32}$/.test(testDatabaseName)) {
  throw new Error("Generated an unsafe PostgreSQL test database name");
}

const maintenanceUrl = new URL(databaseUrl);
maintenanceUrl.pathname = "/postgres";
const isolatedDatabaseUrl = new URL(databaseUrl);
isolatedDatabaseUrl.pathname = `/${testDatabaseName}`;
const quotedTestDatabaseName = `"${testDatabaseName}"`;
const password = "CartIntegrationPassword123!";

type FixtureRole = "ADMIN" | "BILLING" | "CUSTOMER";
type FixtureKey = "admin" | "billing" | "customerA" | "customerB";
type CartResponse = Readonly<{
  id: string;
  customerId: string | null;
  status: "ACTIVE";
  currency: string | null;
  subtotal: string;
  total: string;
  totalQuantity: number;
  items: readonly Readonly<{
    id: string;
    productId: string;
    quantity: number;
    subtotal: string;
    product: Readonly<{
      id: string;
      currency: string;
      price: string;
      stockAvailable: number;
      isAvailable: boolean;
    }>;
  }>[];
}>;

let maintenancePool: Pool | undefined;
let app: NestFastifyApplication;
let server: FastifyInstance;
let database: NodePgDatabase<typeof schema>;
let isolatedDatabaseCreated = false;
let accessTokens: Record<FixtureKey, string>;
let userIds: Record<FixtureKey, string>;
let productIds: Record<
  "available" | "inactive" | "outOfStock" | "precise",
  string
>;

function authorization(accessToken: string): { authorization: string } {
  return { authorization: `Bearer ${accessToken}` };
}

function responseCookie(response: Readonly<{ headers: Record<string, unknown> }>): string {
  const header = response.headers["set-cookie"];
  const value = Array.isArray(header) ? header[0] : header;
  if (typeof value !== "string") throw new Error("Expected anonymous cart cookie");
  return value.split(";", 1)[0] ?? "";
}

function checkoutPayload(
  paymentMethod:
    | "SIMULATED_CARD_APPROVED"
    | "SIMULATED_CARD_REJECTED" = "SIMULATED_CARD_APPROVED",
) {
  return {
    paymentMethod,
    shippingMethod: "STANDARD",
    shippingAddress: {
      city: "Santiago",
      countryCode: "CL",
      line1: "Avenida Tecnología 123",
      postalCode: "8320000",
      recipientName: "Cliente de integración",
      region: "Región Metropolitana",
    },
  } as const;
}

function checkoutRequest(
  customer: "customerA" | "customerB",
  idempotencyKey: string,
  paymentMethod?: "SIMULATED_CARD_APPROVED" | "SIMULATED_CARD_REJECTED",
) {
  return server.inject({
    method: "POST",
    url: "/api/v1/checkout",
    headers: {
      ...authorization(accessTokens[customer]),
      "idempotency-key": idempotencyKey,
    },
    payload: checkoutPayload(paymentMethod),
  });
}

async function addToCart(
  customer: "customerA" | "customerB",
  productId: string,
  quantity: number,
): Promise<void> {
  const response = await server.inject({
    method: "POST",
    url: "/api/v1/cart/items",
    headers: authorization(accessTokens[customer]),
    payload: { productId, quantity },
  });
  expect(response.statusCode).toBe(201);
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

async function createProduct(input: {
  price?: string;
  sku: string;
  status: "ACTIVE" | "INACTIVE";
  stock: number;
}): Promise<string> {
  const [product] = await database
    .insert(products)
    .values({
      currency: "USD",
      description: `Cart fixture ${input.sku}`,
      name: `Cart product ${input.sku}`,
      price: input.price ?? "100.00",
      sku: input.sku,
      status: input.status,
    })
    .returning({ id: products.id });
  if (!product) throw new Error(`Cart product ${input.sku} was not created`);

  await database.insert(productImages).values({
    productId: product.id,
    storageKey: `products/${input.sku.toLowerCase()}/cover.webp`,
    url: `https://cdn.example.com/products/${input.sku.toLowerCase()}/cover.webp`,
  });
  await database.insert(inventoryBalances).values({
    availableQuantity: input.stock,
    productId: product.id,
  });

  return product.id;
}

describe("persistent public cart", () => {
  beforeAll(async () => {
    maintenancePool = new Pool({
      application_name: "technology-ecommerce-cart-test-admin",
      connectionString: maintenanceUrl.toString(),
      max: 1,
    });
    await maintenancePool.query(
      `create database ${quotedTestDatabaseName} template template0`,
    );
    isolatedDatabaseCreated = true;

    process.env.DATABASE_URL = isolatedDatabaseUrl.toString();
    process.env.AUTH_ACCESS_TOKEN_SECRET =
      "cart-integration-test-secret-at-least-32-characters";
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
    const fixtures = [
      { key: "admin", role: "ADMIN" },
      { key: "billing", role: "BILLING" },
      { key: "customerA", role: "CUSTOMER" },
      { key: "customerB", role: "CUSTOMER" },
    ] as const satisfies readonly { key: FixtureKey; role: FixtureRole }[];
    const emails = {} as Record<FixtureKey, string>;
    userIds = {} as Record<FixtureKey, string>;

    for (const fixture of fixtures) {
      const email = `cart-${fixture.key.toLowerCase()}@example.com`;
      const [user] = await database
        .insert(users)
        .values({ displayName: fixture.key, email, passwordHash })
        .returning({ id: users.id });
      if (!user) throw new Error(`Cart user ${fixture.key} was not created`);
      await database.insert(roleAssignments).values({
        role: fixture.role,
        userId: user.id,
      });
      emails[fixture.key] = email;
      userIds[fixture.key] = user.id;
    }

    accessTokens = {
      admin: await login(emails.admin),
      billing: await login(emails.billing),
      customerA: await login(emails.customerA),
      customerB: await login(emails.customerB),
    };
    productIds = {
      available: await createProduct({
        price: "100.00",
        sku: "CART-AVAILABLE",
        status: "ACTIVE",
        stock: 5,
      }),
      inactive: await createProduct({
        sku: "CART-INACTIVE",
        status: "INACTIVE",
        stock: 5,
      }),
      outOfStock: await createProduct({
        sku: "CART-EMPTY",
        status: "ACTIVE",
        stock: 0,
      }),
      precise: await createProduct({
        price: "0.29",
        sku: "CART-PRECISE",
        status: "ACTIVE",
        stock: 10,
      }),
    };
  }, 30_000);

  beforeEach(async () => {
    await database.delete(inventoryMovements).where(eq(inventoryMovements.type, "CANCELLATION"));
    await database.delete(invoices);
    await database.delete(idempotencyRecords);
    await database.delete(payments);
    await database.delete(orderItems);
    await database.delete(orders);
    await database.delete(carts);
    await database
      .delete(inventoryMovements)
      .where(eq(inventoryMovements.type, "SALE"));
    await database
      .update(products)
      .set({
        deletedAt: null,
        price: "100.00",
        status: "ACTIVE",
        updatedAt: new Date(),
      })
      .where(eq(products.id, productIds.available));
    await database
      .update(inventoryBalances)
      .set({ availableQuantity: 5, version: 0 })
      .where(eq(inventoryBalances.productId, productIds.available));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  it("allows visitors and CUSTOMER to read a cart", async () => {
    const responses = await Promise.all([
      server.inject({ method: "GET", url: "/api/v1/cart" }),
      server.inject({ method: "GET", url: "/api/v1/cart", headers: authorization(accessTokens.admin) }),
      server.inject({ method: "GET", url: "/api/v1/cart", headers: authorization(accessTokens.billing) }),
      server.inject({ method: "GET", url: "/api/v1/cart", headers: authorization(accessTokens.customerA) }),
    ]);

    expect(responses.map((response) => response.statusCode)).toEqual([
      200, 403, 403, 200,
    ]);
    expect(responses[0]?.json<CartResponse>()).toMatchObject({
      customerId: null,
      items: [],
      status: "ACTIVE",
    });
    expect(responseCookie(responses[0]!)).toContain("technology_ecommerce_cart=");
    expect(responses[3]?.json<CartResponse>()).toMatchObject({
      customerId: userIds.customerA,
      currency: null,
      items: [],
      status: "ACTIVE",
      subtotal: "0.00",
      total: "0.00",
      totalQuantity: 0,
    });
  });

  it("persists and isolates an anonymous cart by its opaque cookie", async () => {
    const created = await server.inject({
      method: "POST",
      url: "/api/v1/cart/items",
      payload: { productId: productIds.available, quantity: 2 },
    });
    expect(created.statusCode).toBe(201);
    const cookie = responseCookie(created);
    const rawToken = cookie.split("=", 2)[1]!;
    const anonymousCart = created.json<CartResponse>();
    expect(anonymousCart).toMatchObject({
      customerId: null,
      items: [{ productId: productIds.available, quantity: 2 }],
      totalQuantity: 2,
    });
    const [storedOwner] = await database
      .select({ anonymousTokenHash: carts.anonymousTokenHash })
      .from(carts)
      .where(eq(carts.id, anonymousCart.id));
    expect(storedOwner?.anonymousTokenHash).toBe(
      createHash("sha256").update(rawToken).digest("hex"),
    );
    expect(storedOwner?.anonymousTokenHash).not.toBe(rawToken);
    expect(JSON.stringify(anonymousCart)).not.toContain(rawToken);

    const restored = await server.inject({
      method: "GET",
      url: "/api/v1/cart",
      headers: { cookie },
    });
    expect(restored.statusCode).toBe(200);
    expect(restored.json<CartResponse>().id).toBe(anonymousCart.id);
    expect(restored.json<CartResponse>().items).toHaveLength(1);

    const isolated = await server.inject({ method: "GET", url: "/api/v1/cart" });
    expect(isolated.json<CartResponse>()).toMatchObject({
      customerId: null,
      items: [],
    });
    expect(isolated.json<CartResponse>().id).not.toBe(anonymousCart.id);

    const foreignUpdate = await server.inject({
      method: "PATCH",
      url: `/api/v1/cart/items/${anonymousCart.items[0]?.id}`,
      headers: { cookie: responseCookie(isolated) },
      payload: { quantity: 1 },
    });
    expect(foreignUpdate.statusCode).toBe(404);
  });

  it("removes only expired anonymous carts during scheduled cleanup", async () => {
    const now = new Date("2026-09-08T18:00:00.000Z");
    const [expiredGuest, currentGuest, customerCart] = await database
      .insert(carts)
      .values([
        {
          anonymousTokenHash: "a".repeat(64),
          expiresAt: new Date("2026-09-08T17:59:59.000Z"),
        },
        {
          anonymousTokenHash: "b".repeat(64),
          expiresAt: new Date("2026-09-08T18:00:01.000Z"),
        },
        { customerId: userIds.customerA },
      ])
      .returning({ id: carts.id });

    const inventoryBefore = await database
      .select()
      .from(inventoryBalances);
    const cleanup = app.get(AnonymousCartCleanupService);
    expect(await cleanup.run(now)).toBe(1);

    const remaining = await database
      .select({ id: carts.id })
      .from(carts);
    expect(remaining.map(({ id }) => id)).toEqual(expect.arrayContaining([
      currentGuest!.id,
      customerCart!.id,
    ]));
    expect(remaining.map(({ id }) => id)).not.toContain(expiredGuest!.id);
    expect(await database.select().from(inventoryBalances)).toEqual(inventoryBefore);
  });

  it("does not expose an expired anonymous cart", async () => {
    const rawToken = randomBytes(32).toString("base64url");
    const [expired] = await database
      .insert(carts)
      .values({
        anonymousTokenHash: createHash("sha256").update(rawToken).digest("hex"),
        expiresAt: new Date(Date.now() - 1_000),
      })
      .returning({ id: carts.id });

    const response = await server.inject({
      method: "GET",
      url: "/api/v1/cart",
      headers: { cookie: `technology_ecommerce_cart=${rawToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json<CartResponse>().id).not.toBe(expired!.id);
    const [oldCart] = await database
      .select({ status: carts.status })
      .from(carts)
      .where(eq(carts.id, expired!.id));
    expect(oldCart?.status).toBe("ABANDONED");
  });

  it("claims an anonymous cart for a customer without losing its lines", async () => {
    const anonymousAddition = await server.inject({
      method: "POST",
      url: "/api/v1/cart/items",
      payload: { productId: productIds.available, quantity: 2 },
    });
    const cookie = responseCookie(anonymousAddition);
    const anonymousCart = anonymousAddition.json<CartResponse>();

    const claimed = await server.inject({
      method: "POST",
      url: "/api/v1/cart/claim",
      headers: {
        ...authorization(accessTokens.customerA),
        cookie,
      },
    });

    expect(claimed.statusCode).toBe(200);
    expect(claimed.json()).toMatchObject({
      adjustedProductIds: [],
      cart: {
        customerId: userIds.customerA,
        id: anonymousCart.id,
        items: [{ productId: productIds.available, quantity: 2 }],
      },
    });
    expect(String(claimed.headers["set-cookie"])).toContain(
      "technology_ecommerce_cart=;",
    );
  });

  it("merges duplicate anonymous lines into the customer cart and reports stock adjustments", async () => {
    await addToCart("customerA", productIds.available, 4);
    const anonymousAddition = await server.inject({
      method: "POST",
      url: "/api/v1/cart/items",
      payload: { productId: productIds.available, quantity: 3 },
    });

    const merged = await server.inject({
      method: "POST",
      url: "/api/v1/cart/claim",
      headers: {
        ...authorization(accessTokens.customerA),
        cookie: responseCookie(anonymousAddition),
      },
    });

    expect(merged.statusCode).toBe(200);
    expect(merged.json()).toMatchObject({
      adjustedProductIds: [productIds.available],
      cart: {
        customerId: userIds.customerA,
        items: [{ productId: productIds.available, quantity: 5 }],
        totalQuantity: 5,
      },
    });
    const activeCarts = await database
      .select({ customerId: carts.customerId })
      .from(carts)
      .where(eq(carts.status, "ACTIVE"));
    expect(activeCarts).toEqual([{ customerId: userIds.customerA }]);
  });

  it("returns the same single persistent active cart for a customer", async () => {
    const responses = await Promise.all(
      Array.from({ length: 4 }, () =>
        server.inject({
          method: "GET",
          url: "/api/v1/cart",
          headers: authorization(accessTokens.customerA),
        }),
      ),
    );
    expect(responses.map((response) => response.statusCode)).toEqual([
      200, 200, 200, 200,
    ]);
    expect(
      new Set(responses.map((response) => response.json<CartResponse>().id)).size,
    ).toBe(1);
    const customerCarts = await database
      .select({ id: carts.id })
      .from(carts)
      .where(
        and(
          eq(carts.customerId, userIds.customerA),
          eq(carts.status, "ACTIVE"),
        ),
      );
    expect(customerCarts).toHaveLength(1);
  });

  it("adds and increments one line while isolating it from another customer", async () => {
    const first = await server.inject({
      method: "POST",
      url: "/api/v1/cart/items",
      headers: authorization(accessTokens.customerA),
      payload: { productId: productIds.available, quantity: 1 },
    });
    const second = await server.inject({
      method: "POST",
      url: "/api/v1/cart/items",
      headers: authorization(accessTokens.customerA),
      payload: { productId: productIds.available, quantity: 2 },
    });
    expect([first.statusCode, second.statusCode]).toEqual([201, 201]);
    const cart = second.json<CartResponse>();
    expect(cart).toMatchObject({
      customerId: userIds.customerA,
      items: [{ productId: productIds.available, quantity: 3 }],
      totalQuantity: 3,
    });
    expect(cart.items[0]?.product).toMatchObject({
      id: productIds.available,
      isAvailable: true,
      stockAvailable: 5,
    });

    const itemId = cart.items[0]?.id;
    if (!itemId) throw new Error("Expected an item in customer A's cart");
    const foreignResponses = await Promise.all([
      server.inject({
        method: "PATCH",
        url: `/api/v1/cart/items/${itemId}`,
        headers: authorization(accessTokens.customerB),
        payload: { quantity: 1 },
      }),
      server.inject({
        method: "DELETE",
        url: `/api/v1/cart/items/${itemId}`,
        headers: authorization(accessTokens.customerB),
      }),
    ]);
    expect(foreignResponses.map((response) => response.statusCode)).toEqual([
      404, 404,
    ]);

    const customerB = await server.inject({
      method: "GET",
      url: "/api/v1/cart",
      headers: authorization(accessTokens.customerB),
    });
    expect(customerB.json<CartResponse>().items).toEqual([]);
    expect(await database.select().from(cartItems)).toHaveLength(1);
  });

  it("recalculates exact totals from current prices after every mutation", async () => {
    const firstAddition = await server.inject({
      method: "POST",
      url: "/api/v1/cart/items",
      headers: authorization(accessTokens.customerA),
      payload: { productId: productIds.available, quantity: 2 },
    });
    expect(firstAddition.json<CartResponse>()).toMatchObject({
      currency: "USD",
      items: [
        {
          productId: productIds.available,
          quantity: 2,
          subtotal: "200.00",
        },
      ],
      subtotal: "200.00",
      total: "200.00",
    });

    const secondAddition = await server.inject({
      method: "POST",
      url: "/api/v1/cart/items",
      headers: authorization(accessTokens.customerA),
      payload: { productId: productIds.precise, quantity: 3 },
    });
    const cartAfterAddition = secondAddition.json<CartResponse>();
    expect(cartAfterAddition).toMatchObject({
      currency: "USD",
      items: [
        { productId: productIds.available, subtotal: "200.00" },
        { productId: productIds.precise, subtotal: "0.87" },
      ],
      subtotal: "200.87",
      total: "200.87",
      totalQuantity: 5,
    });

    await database
      .update(products)
      .set({ price: "100.05", updatedAt: new Date() })
      .where(eq(products.id, productIds.available));
    const preciseItem = cartAfterAddition.items.find(
      (item) => item.productId === productIds.precise,
    );
    if (!preciseItem) throw new Error("Expected the precision test item");

    const quantityChange = await server.inject({
      method: "PATCH",
      url: `/api/v1/cart/items/${preciseItem.id}`,
      headers: authorization(accessTokens.customerA),
      payload: { quantity: 2 },
    });
    const cartAfterQuantityChange = quantityChange.json<CartResponse>();
    expect(cartAfterQuantityChange).toMatchObject({
      items: [
        {
          product: { price: "100.05" },
          productId: productIds.available,
          subtotal: "200.10",
        },
        {
          productId: productIds.precise,
          quantity: 2,
          subtotal: "0.58",
        },
      ],
      subtotal: "200.68",
      total: "200.68",
      totalQuantity: 4,
    });

    const availableItem = cartAfterQuantityChange.items.find(
      (item) => item.productId === productIds.available,
    );
    if (!availableItem) throw new Error("Expected the current-price test item");
    const removal = await server.inject({
      method: "DELETE",
      url: `/api/v1/cart/items/${availableItem.id}`,
      headers: authorization(accessTokens.customerA),
    });
    expect(removal.json<CartResponse>()).toMatchObject({
      currency: "USD",
      items: [{ productId: productIds.precise, subtotal: "0.58" }],
      subtotal: "0.58",
      total: "0.58",
      totalQuantity: 2,
    });
  });

  it("rejects non-positive or non-integer quantities", async () => {
    const responses = await Promise.all([
      server.inject({
        method: "POST",
        url: "/api/v1/cart/items",
        headers: authorization(accessTokens.customerA),
        payload: { productId: productIds.available, quantity: 0 },
      }),
      server.inject({
        method: "POST",
        url: "/api/v1/cart/items",
        headers: authorization(accessTokens.customerA),
        payload: { productId: productIds.available, quantity: -1 },
      }),
      server.inject({
        method: "POST",
        url: "/api/v1/cart/items",
        headers: authorization(accessTokens.customerA),
        payload: { productId: productIds.available, quantity: 1.5 },
      }),
    ]);

    expect(responses.map((response) => response.statusCode)).toEqual([
      400, 400, 400,
    ]);
  });

  it("rejects stock shortages and preserves the last valid quantity", async () => {
    const created = await server.inject({
      method: "POST",
      url: "/api/v1/cart/items",
      headers: authorization(accessTokens.customerA),
      payload: { productId: productIds.available, quantity: 2 },
    });
    const itemId = created.json<CartResponse>().items[0]?.id;
    if (!itemId) throw new Error("Expected a cart item for shortage checks");

    const [addShortage, updateShortage, emptyStock] = await Promise.all([
      server.inject({
        method: "POST",
        url: "/api/v1/cart/items",
        headers: authorization(accessTokens.customerA),
        payload: { productId: productIds.available, quantity: 4 },
      }),
      server.inject({
        method: "PATCH",
        url: `/api/v1/cart/items/${itemId}`,
        headers: authorization(accessTokens.customerA),
        payload: { quantity: 6 },
      }),
      server.inject({
        method: "POST",
        url: "/api/v1/cart/items",
        headers: authorization(accessTokens.customerB),
        payload: { productId: productIds.outOfStock, quantity: 1 },
      }),
    ]);

    expect([addShortage.statusCode, updateShortage.statusCode, emptyStock.statusCode]).toEqual([
      409, 409, 409,
    ]);
    expect(addShortage.json()).toMatchObject({
      code: "CART_INSUFFICIENT_STOCK",
      details: { availableQuantity: 5, requestedQuantity: 6 },
    });
    const current = await server.inject({
      method: "GET",
      url: "/api/v1/cart",
      headers: authorization(accessTokens.customerA),
    });
    expect(current.json<CartResponse>().items).toMatchObject([{ quantity: 2 }]);
  });

  it("rejects unavailable products and removes an owned line", async () => {
    const inactive = await server.inject({
      method: "POST",
      url: "/api/v1/cart/items",
      headers: authorization(accessTokens.customerA),
      payload: { productId: productIds.inactive, quantity: 1 },
    });
    expect(inactive.statusCode).toBe(409);
    expect(inactive.json()).toMatchObject({ code: "CART_PRODUCT_UNAVAILABLE" });

    const created = await server.inject({
      method: "POST",
      url: "/api/v1/cart/items",
      headers: authorization(accessTokens.customerA),
      payload: { productId: productIds.available, quantity: 1 },
    });
    const itemId = created.json<CartResponse>().items[0]?.id;
    if (!itemId) throw new Error("Expected a cart item to remove");

    const removed = await server.inject({
      method: "DELETE",
      url: `/api/v1/cart/items/${itemId}`,
      headers: authorization(accessTokens.customerA),
    });
    expect(removed.statusCode).toBe(200);
    expect(removed.json<CartResponse>()).toMatchObject({
      items: [],
      totalQuantity: 0,
    });
    expect(await database.select().from(cartItems)).toHaveLength(0);
  });

  it("confirms checkout once and replays the same idempotent result without duplicates", async () => {
    const shippingOptions = await server.inject({ method: "GET", url: "/api/v1/checkout/shipping-methods", headers: authorization(accessTokens.customerA) });
    expect(shippingOptions.statusCode).toBe(200);
    expect(shippingOptions.json()).toEqual(expect.arrayContaining([
      { method: "STANDARD", currency: "USD", cost: "5.00" },
    ]));
    const forbiddenShipping = await server.inject({ method: "GET", url: "/api/v1/checkout/shipping-methods", headers: authorization(accessTokens.billing) });
    expect(forbiddenShipping.statusCode).toBe(403);
    const addition = await server.inject({
      method: "POST",
      url: "/api/v1/cart/items",
      headers: authorization(accessTokens.customerA),
      payload: { productId: productIds.available, quantity: 2 },
    });
    expect(addition.statusCode).toBe(201);

    const first = await checkoutRequest(
      "customerA",
      "checkout-customer-a-0001",
    );
    const repeated = await checkoutRequest(
      "customerA",
      "checkout-customer-a-0001",
    );

    expect([first.statusCode, repeated.statusCode]).toEqual([201, 201]);
    expect(repeated.json()).toEqual(first.json());
    const receiptUrl = `/api/v1/checkout/orders/${first.json<{ order: { id: string } }>().order.id}`;
    const receipt = await server.inject({ method: "GET", url: receiptUrl, headers: authorization(accessTokens.customerA) });
    expect(receipt.statusCode).toBe(200);
    expect(receipt.json()).toEqual(first.json());
    const foreignReceipt = await server.inject({ method: "GET", url: receiptUrl, headers: authorization(accessTokens.customerB) });
    expect(foreignReceipt.statusCode).toBe(404);
    const anonymousReceipt = await server.inject({ method: "GET", url: receiptUrl });
    expect(anonymousReceipt.statusCode).toBe(401);
    expect(first.json()).toMatchObject({
      order: {
        currency: "USD",
        items: [
          {
            lineTotal: "200.00",
            productId: productIds.available,
            quantity: 2,
            unitPrice: "100.00",
          },
        ],
        shippingTotal: "5.00",
        status: "PROCESSING",
        subtotal: "200.00",
        taxTotal: "0.00",
        total: "205.00",
      },
      payment: {
        method: "SIMULATED_CARD_APPROVED",
        status: "APPROVED",
      },
    });

    const [storedOrders, storedLines, storedPayments, storedIdempotency, sales] =
      await Promise.all([
        database.select().from(orders),
        database.select().from(orderItems),
        database.select().from(payments),
        database.select().from(idempotencyRecords),
        database
          .select()
          .from(inventoryMovements)
          .where(eq(inventoryMovements.type, "SALE")),
      ]);
    expect(storedOrders).toHaveLength(1);
    expect(storedLines).toHaveLength(1);
    expect(storedPayments).toHaveLength(1);
    expect(storedIdempotency).toHaveLength(1);
    expect(storedIdempotency[0]).toMatchObject({
      orderId: storedOrders[0]?.id,
      status: "COMPLETED",
    });
    expect(sales).toHaveLength(1);
    expect(sales[0]).toMatchObject({
      balanceAfter: 3,
      quantityDelta: -2,
      referenceId: storedOrders[0]?.id,
      referenceType: "ORDER",
    });

    const [balance] = await database
      .select({ availableQuantity: inventoryBalances.availableQuantity })
      .from(inventoryBalances)
      .where(eq(inventoryBalances.productId, productIds.available));
    const [closedCart] = await database
      .select({ closedAt: carts.closedAt, status: carts.status })
      .from(carts)
      .where(eq(carts.customerId, userIds.customerA));
    expect(balance?.availableQuantity).toBe(3);
    expect(closedCart?.status).toBe("CHECKED_OUT");
    expect(closedCart?.closedAt).toBeInstanceOf(Date);
  });

  it("preserves the actual checkout order snapshots after product and customer edits", async () => {
    await addToCart("customerA", productIds.available, 2);
    const response = await checkoutRequest("customerA", "checkout-historical-order-0001");
    expect(response.statusCode).toBe(201);
    const orderId = response.json<{ order: { id: string } }>().order.id;
    const beforeOrders = await database.select().from(orders).where(eq(orders.id, orderId));
    const beforeItems = await database.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    const beforePayments = await database.select().from(payments).where(eq(payments.orderId, orderId));
    expect(beforeOrders[0]?.customerSnapshot).toMatchObject({ id: userIds.customerA });
    expect(beforeItems[0]?.unitPrice).toBe("100.00");

    await database.update(products).set({ name: "Renamed product", sku: "CHANGED-SKU", price: "999.00", status: "INACTIVE" })
      .where(eq(products.id, productIds.available));
    await database.update(users).set({ displayName: "Renamed customer", email: "renamed@example.com" })
      .where(eq(users.id, userIds.customerA));

    expect(await database.select().from(orders).where(eq(orders.id, orderId))).toEqual(beforeOrders);
    expect(await database.select().from(orderItems).where(eq(orderItems.orderId, orderId))).toEqual(beforeItems);
    expect(await database.select().from(payments).where(eq(payments.orderId, orderId))).toEqual(beforePayments);
    const repeated = await checkoutRequest("customerA", "checkout-historical-order-0001");
    expect(repeated.statusCode).toBe(201);
    expect(repeated.json()).toEqual(response.json());
  });

  it("lists only own orders newest first, paginates and filters before counting", async () => {
    const ids: string[] = [];
    for (const [index, customer] of (["customerA", "customerA", "customerB"] as const).entries()) {
      await addToCart(customer, productIds.available, 1);
      const response = await checkoutRequest(customer, `customer-order-history-${index}`);
      expect(response.statusCode).toBe(201);
      const id = response.json<{ order: { id: string } }>().order.id;
      ids.push(id);
      await database.update(orders).set({ createdAt: new Date(`2026-01-0${index + 1}T12:00:00Z`) }).where(eq(orders.id, id));
    }
    const get = (query: string) => server.inject({ method: "GET", url: `/api/v1/orders/mine${query}`, headers: authorization(accessTokens.customerA) });
    const first = await get("?page=1&pageSize=1");
    expect(first.statusCode).toBe(200);
    expect(first.json()).toMatchObject({ page: 1, pageSize: 1, totalItems: 2, totalPages: 2, items: [{ id: ids[1], currency: "USD" }] });
    expect(first.json<{ items: unknown[] }>().items).toHaveLength(1);
    expect((await get("?page=2&pageSize=1")).json()).toMatchObject({ items: [{ id: ids[0] }] });
    expect((await get("?page=3&pageSize=1")).json()).toMatchObject({ items: [], totalItems: 2, totalPages: 2 });
    expect((await get("?status=COMPLETED")).json()).toMatchObject({ items: [], totalItems: 0, totalPages: 0 });
    await database.update(orders).set({ status: "INVOICED" }).where(eq(orders.id, ids[0]!));
    expect((await get("?status=INVOICED")).json()).toMatchObject({ items: [{ id: ids[0] }], totalItems: 1, totalPages: 1 });
    await database.update(orders).set({ createdAt: new Date("2026-01-01T12:00:00Z") });
    const tied = (await get("")).json<{ items: { id: string }[] }>();
    expect(tied.items.map(({ id }) => id)).toEqual(ids.slice(0, 2).sort().reverse());
  });

  it("protects order detail, keeps snapshots and returns current operational status", async () => {
    await addToCart("customerA", productIds.available, 1);
    const checkout = await checkoutRequest("customerA", "customer-order-detail-001");
    expect(checkout.statusCode).toBe(201);
    const id = checkout.json<{ order: { id: string } }>().order.id;
    const url = `/api/v1/orders/${id}`;
    const before = await server.inject({ method: "GET", url, headers: authorization(accessTokens.customerA) });
    expect(before.statusCode).toBe(200);
    expect(before.json()).toMatchObject({ id, status: "PROCESSING", customerSnapshot: { id: userIds.customerA }, items: [{ unitPrice: "100.00", quantity: 1 }] });
    await database.update(products).set({ name: "Edited product", price: "900.00" }).where(eq(products.id, productIds.available));
    await database.update(users).set({ displayName: "Edited customer" }).where(eq(users.id, userIds.customerA));
    await database.update(orders).set({ status: "INVOICED" }).where(eq(orders.id, id));
    const after = await server.inject({ method: "GET", url, headers: authorization(accessTokens.customerA) });
    expect(after.json()).toEqual({ ...before.json<Record<string, unknown>>(), status: "INVOICED" });
    const foreign = await server.inject({ method: "GET", url, headers: authorization(accessTokens.customerB) });
    const missing = await server.inject({ method: "GET", url: `/api/v1/orders/${randomUUID()}`, headers: authorization(accessTokens.customerB) });
    expect(foreign.statusCode).toBe(404);
    expect(missing.statusCode).toBe(404);
    expect(foreign.json()).toMatchObject({ code: "ORDER_NOT_FOUND" });
    expect(missing.json()).toMatchObject({ code: "ORDER_NOT_FOUND" });
    for (const path of [url, "/api/v1/orders/mine"]) {
      expect((await server.inject({ method: "GET", url: path })).statusCode).toBe(401);
      for (const role of ["admin", "billing"] as const) {
        expect((await server.inject({ method: "GET", url: path, headers: authorization(accessTokens[role]) })).statusCode).toBe(path === url ? 200 : 403);
      }
    }
  });

  it("validates order pagination, status and identifiers without accepting a requested owner", async () => {
    for (const suffix of ["mine?page=0", "mine?page=1.5", "mine?pageSize=101", "mine?pageSize=-1", "mine?status=UNKNOWN", `mine?customerId=${userIds.customerB}`, "not-a-uuid"]) {
      const response = await server.inject({ method: "GET", url: `/api/v1/orders/${suffix}`, headers: authorization(accessTokens.customerA) });
      expect(response.statusCode).toBe(400);
    }
    const empty = await server.inject({ method: "GET", url: "/api/v1/orders/mine", headers: authorization(accessTokens.customerA) });
    expect(empty.json()).toEqual({ items: [], page: 1, pageSize: 20, totalItems: 0, totalPages: 0 });
  });

  it("allows Admin and Billing to search, filter and paginate orders from all customers", async () => {
    const ids: string[] = [];
    for (const [index, customer] of (["customerA", "customerB"] as const).entries()) {
      await addToCart(customer, productIds.available, 1);
      const response = await checkoutRequest(customer, `administrative-orders-${index}`);
      expect(response.statusCode).toBe(201);
      const id = response.json<{ order: { id: string } }>().order.id;
      ids.push(id);
      await database.update(orders).set({ number: `ORDER-TEST-${index}`, createdAt: new Date(`2026-02-0${index + 1}T12:00:00Z`) }).where(eq(orders.id, id));
    }
    await database.insert(invoices).values({
      origin: "ORDER", orderId: ids[0], customerId: userIds.customerA,
      subtotal: "100.00", shippingTotal: "5.00", taxTotal: "0.00", total: "105.00",
      issuerSnapshot: { name: "Test store" }, customerSnapshot: { id: userIds.customerA },
    });
    for (const role of ["admin", "billing"] as const) {
      const get = (query: string) => server.inject({ method: "GET", url: `/api/v1/orders${query}`, headers: authorization(accessTokens[role]) });
      expect((await get("?pageSize=1")).json()).toMatchObject({ items: [{ id: ids[1], customerId: userIds.customerB }], totalItems: 2, totalPages: 2 });
      expect((await get("?pageSize=1&page=2")).json()).toMatchObject({ items: [{ id: ids[0] }] });
      expect((await get(`?customerId=${userIds.customerA}&search=ORDER-TEST&status=PROCESSING&invoicing=ACTIVE_INVOICE&createdFrom=2026-02-01T00:00:00Z&createdTo=2026-02-01T23:59:59Z`)).json())
        .toMatchObject({ items: [{ id: ids[0] }], totalItems: 1 });
      expect((await get("?invoicing=NO_ACTIVE_INVOICE")).json()).toMatchObject({ items: [{ id: ids[1] }], totalItems: 1 });
      expect((await get("?search=%25")).json()).toMatchObject({ items: [], totalItems: 0 });
      expect((await get("?sortBy=number&sortOrder=asc&pageSize=1")).json()).toMatchObject({ items: [{ id: ids[0] }] });
      expect((await get("?page=8")).json()).toMatchObject({ items: [], totalItems: 2 });
      for (const query of ["?page=0", "?pageSize=101", "?sortBy=password", "?status=INVALID", "?customerId=bad", "?createdFrom=bad", "?createdFrom=2026-02-03T00:00:00Z&createdTo=2026-02-01T00:00:00Z"]) {
        expect((await get(query)).statusCode).toBe(400);
      }
    }
    expect((await server.inject({ method: "GET", url: "/api/v1/orders", headers: authorization(accessTokens.customerA) })).statusCode).toBe(403);
    expect((await server.inject({ method: "GET", url: "/api/v1/orders" })).statusCode).toBe(401);
    await database.update(invoices).set({ status: "VOID", voidedAt: new Date() });
    const voided = await server.inject({ method: "GET", url: "/api/v1/orders?invoicing=ACTIVE_INVOICE", headers: authorization(accessTokens.billing) });
    expect(voided.json()).toMatchObject({ items: [], totalItems: 0 });
  });

  it("allows Admin and Billing to complete invoiced orders, rejects bypasses and serializes concurrent transitions", async () => {
    await addToCart("customerA", productIds.available, 1);
    const response = await checkoutRequest("customerA", "administrative-transition-001");
    expect(response.statusCode).toBe(201);
    const id = response.json<{ order: { id: string } }>().order.id;
    const url = `/api/v1/orders/${id}/status`;
    const patch = (role: FixtureKey, status: string) => server.inject({ method: "PATCH", url, headers: authorization(accessTokens[role]), payload: { status } });
    for (const role of ["customerA", "customerB"] as const) {
      for (const status of ["COMPLETED", "CANCELLED", "INVOICED"]) expect((await patch(role, status)).statusCode).toBe(403);
    }
    expect((await server.inject({ method: "PATCH", url, payload: { status: "COMPLETED" } })).statusCode).toBe(401);
    expect((await patch("admin", "UNKNOWN")).statusCode).toBe(400);
    expect((await patch("admin", "COMPLETED")).json()).toMatchObject({ code: "ORDER_INVALID_TRANSITION" });
    for (const role of ["admin", "billing"] as const) {
      for (const status of ["CANCELLED", "INVOICED"]) {
        const bypass = await patch(role, status);
        expect(bypass.statusCode).toBe(409);
        expect(bypass.json()).toMatchObject({ code: "ORDER_DEDICATED_WORKFLOW_REQUIRED" });
      }
    }
    const beforePayments = await database.select().from(payments);
    const beforeStock = await database.select().from(inventoryBalances);
    const beforeMovements = await database.select().from(inventoryMovements);
    await database.update(orders).set({ status: "INVOICED" }).where(eq(orders.id, id));
    const results = await Promise.all([patch("billing", "COMPLETED"), patch("billing", "COMPLETED")]);
    expect(results.map((result) => result.statusCode).sort()).toEqual([200, 409]);
    expect((await database.select().from(orders).where(eq(orders.id, id)))[0]?.status).toBe("COMPLETED");
    const audits = await database.select().from(auditEntries).where(eq(auditEntries.entityId, id));
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ action: "ORDER_STATUS_CHANGED", actorUserId: userIds.billing, changes: { before: { status: "INVOICED" }, after: { status: "COMPLETED" } } });
    expect(await database.select().from(payments)).toEqual(beforePayments);
    expect(await database.select().from(inventoryBalances)).toEqual(beforeStock);
    expect(await database.select().from(inventoryMovements)).toEqual(beforeMovements);
    expect((await patch("admin", "CANCELLED")).statusCode).toBe(409);
    expect((await server.inject({ method: "PATCH", url: `/api/v1/orders/${randomUUID()}/status`, headers: authorization(accessTokens.admin), payload: { status: "COMPLETED" } })).statusCode).toBe(404);
  });

  it("cancels once under concurrent retries and preserves the first reason, actor and payment", async () => {
    await addToCart("customerA", productIds.available, 2);
    await addToCart("customerA", productIds.precise, 1);
    const purchase = await checkoutRequest("customerA", "cancel-order-concurrent-001");
    expect(purchase.statusCode).toBe(201);
    const id = purchase.json<{ order: { id: string } }>().order.id;
    const storedPayments = await database.select().from(payments);
    const storedItems = await database.select().from(orderItems);
    const [before] = await database.select().from(orders).where(eq(orders.id, id));
    await database.update(products).set({ status: "INACTIVE", deletedAt: new Date() }).where(eq(products.id, productIds.available));
    const cancel = (reason: string) => server.inject({ method: "POST", url: `/api/v1/orders/${id}/cancel`, headers: authorization(accessTokens.billing), payload: { reason } });
    const [first, second] = await Promise.all([cancel("Customer request"), cancel("Concurrent reason")]);
    expect([first.statusCode, second.statusCode]).toEqual([200, 200]);
    expect(first.json()).toEqual(second.json());
    expect(first.json()).toMatchObject({ status: "CANCELLED", id });
    expect((await cancel("Changed on retry")).json()).toEqual(first.json());
    const movements = await database.select().from(inventoryMovements).where(and(eq(inventoryMovements.type, "CANCELLATION"), eq(inventoryMovements.referenceId, id)));
    expect(movements).toHaveLength(2);
    expect(movements.map((m) => m.quantityDelta).sort()).toEqual([1, 2]);
    const audits = await database.select().from(auditEntries).where(and(eq(auditEntries.entityId, id), eq(auditEntries.action, "ORDER_CANCELLED")));
    expect(audits).toHaveLength(1);
    expect(audits[0]?.actorUserId).toBe(userIds.billing);
    expect(["Customer request", "Concurrent reason"]).toContain(audits[0]?.changes.reason);
    expect(movements.every((m) => m.reason === audits[0]?.changes.reason && m.actorUserId === userIds.billing)).toBe(true);
    expect((await database.select().from(inventoryBalances).where(eq(inventoryBalances.productId, productIds.available)))[0]?.availableQuantity).toBe(5);
    expect(await database.select().from(payments)).toEqual(storedPayments);
    expect(await database.select().from(orderItems)).toEqual(storedItems);
    const [after] = await database.select().from(orders).where(eq(orders.id, id));
    expect(after).toEqual({ ...before, status: "CANCELLED", cancelledAt: after?.cancelledAt, updatedAt: after?.updatedAt });
    expect(after?.cancelledAt).toBeInstanceOf(Date);
  });

  it("blocks every active invoice state and cancels an invoiced order only after voiding", async () => {
    await addToCart("customerA", productIds.available, 1);
    const purchase = await checkoutRequest("customerA", "cancel-invoiced-order-001");
    const id = purchase.json<{ order: { id: string } }>().order.id;
    await database.update(orders).set({ status: "INVOICED" }).where(eq(orders.id, id));
    const createdAt = new Date("2026-01-01T00:00:00Z");
    const [invoice] = await database.insert(invoices).values({
      origin: "ORDER", orderId: id, customerId: userIds.customerA, createdAt,
      subtotal: "100.00", shippingTotal: "5.00", taxTotal: "0.00", total: "105.00",
      issuerSnapshot: { name: "Test store" }, customerSnapshot: { id: userIds.customerA },
    }).returning();
    const cancel = () => server.inject({ method: "POST", url: `/api/v1/orders/${id}/cancel`, headers: authorization(accessTokens.admin), payload: { reason: "Returned order" } });
    for (const status of ["DRAFT", "PENDING_PAYMENT", "PAID"] as const) {
      await database.update(invoices).set({ status, number: status === "DRAFT" ? null : "INV-CANCEL-1", issuedAt: status === "DRAFT" ? null : createdAt, paidAt: status === "PAID" ? createdAt : null }).where(eq(invoices.id, invoice!.id));
      const beforeInvoices = await database.select().from(invoices);
      const blocked = await cancel();
      expect(blocked.statusCode).toBe(409);
      expect(blocked.json()).toMatchObject({ code: "ORDER_ACTIVE_INVOICE" });
      expect(await database.select().from(invoices)).toEqual(beforeInvoices);
      expect((await database.select().from(orders).where(eq(orders.id, id)))[0]?.status).toBe("INVOICED");
    }
    expect(await database.select().from(inventoryMovements).where(eq(inventoryMovements.type, "CANCELLATION"))).toHaveLength(0);
    await database.update(invoices).set({ status: "VOID", voidedAt: new Date() }).where(eq(invoices.id, invoice!.id));
    const beforeInvoices = await database.select().from(invoices);
    const beforePayments = await database.select().from(payments);
    expect((await cancel()).statusCode).toBe(200);
    expect(await database.select().from(invoices)).toEqual(beforeInvoices);
    expect(await database.select().from(payments)).toEqual(beforePayments);
  });

  it("validates cancellation permissions, reason, identifiers and terminal states", async () => {
    await addToCart("customerA", productIds.available, 1);
    const purchase = await checkoutRequest("customerA", "cancel-validation-001");
    const id = purchase.json<{ order: { id: string } }>().order.id;
    const url = `/api/v1/orders/${id}/cancel`;
    for (const role of ["customerA", "customerB"] as const) {
      expect((await server.inject({ method: "POST", url, headers: authorization(accessTokens[role]), payload: { reason: "Test" } })).statusCode).toBe(403);
    }
    expect((await server.inject({ method: "POST", url, payload: { reason: "Test" } })).statusCode).toBe(401);
    for (const payload of [{}, { reason: "  " }, { reason: "x".repeat(501) }, { reason: "Test", actorUserId: userIds.customerA }]) {
      expect((await server.inject({ method: "POST", url, headers: authorization(accessTokens.admin), payload })).statusCode).toBe(400);
    }
    for (const [identifier, status] of [["bad", 400], [randomUUID(), 404]] as const) {
      expect((await server.inject({ method: "POST", url: `/api/v1/orders/${identifier}/cancel`, headers: authorization(accessTokens.admin), payload: { reason: "Test" } })).statusCode).toBe(status);
    }
    await database.update(orders).set({ status: "COMPLETED" }).where(eq(orders.id, id));
    const completed = await server.inject({ method: "POST", url, headers: authorization(accessTokens.admin), payload: { reason: "Test" } });
    expect(completed.statusCode).toBe(409);
    expect(completed.json()).toMatchObject({ code: "ORDER_INVALID_TRANSITION" });
    expect(await database.select().from(inventoryMovements).where(eq(inventoryMovements.type, "CANCELLATION"))).toHaveLength(0);
  });

  it("rolls back a late restoration failure and permits a clean retry", async () => {
    await addToCart("customerA", productIds.available, 1);
    const purchase = await checkoutRequest("customerA", "cancel-rollback-001");
    const id = purchase.json<{ order: { id: string } }>().order.id;
    const beforeStock = await database.select().from(inventoryBalances);
    const beforeAudit = await database.select().from(auditEntries);
    const inventory = app.get(InventoryStockService);
    const restore = inventory.restoreOrderInTransaction.bind(inventory);
    vi.spyOn(inventory, "restoreOrderInTransaction").mockImplementationOnce(async (...args) => {
      await restore(...args);
      throw new Error("Simulated failure after stock writes");
    });
    const cancel = () => server.inject({ method: "POST", url: `/api/v1/orders/${id}/cancel`, headers: authorization(accessTokens.admin), payload: { reason: "Retry test" } });
    expect((await cancel()).statusCode).toBe(500);
    expect(await database.select().from(inventoryBalances)).toEqual(beforeStock);
    expect(await database.select().from(auditEntries)).toEqual(beforeAudit);
    expect((await database.select().from(orders).where(eq(orders.id, id)))[0]?.status).toBe("PROCESSING");
    expect(await database.select().from(inventoryMovements).where(eq(inventoryMovements.type, "CANCELLATION"))).toHaveLength(0);
    expect((await cancel()).statusCode).toBe(200);
  });

  it("rejects restock overflow without partial cancellation", async () => {
    await addToCart("customerA", productIds.available, 1);
    const purchase = await checkoutRequest("customerA", "cancel-overflow-001");
    const id = purchase.json<{ order: { id: string } }>().order.id;
    await database.update(inventoryBalances).set({ availableQuantity: 2_147_483_647 }).where(eq(inventoryBalances.productId, productIds.available));
    const response = await server.inject({ method: "POST", url: `/api/v1/orders/${id}/cancel`, headers: authorization(accessTokens.admin), payload: { reason: "Overflow test" } });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ code: "ORDER_RESTOCK_OVERFLOW" });
    expect((await database.select().from(orders).where(eq(orders.id, id)))[0]?.status).toBe("PROCESSING");
    expect(await database.select().from(inventoryMovements).where(eq(inventoryMovements.type, "CANCELLATION"))).toHaveLength(0);
  });

  it("atomically invoices an order from historical snapshots without changing inventory", async () => {
    await addToCart("customerA", productIds.available, 2);
    const purchase = await checkoutRequest("customerA", "invoice-order-snapshot-001");
    expect(purchase.statusCode).toBe(201);
    const orderId = purchase.json<{ order: { id: string } }>().order.id;
    const [historicalLine] = await database.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    expect(historicalLine).toBeDefined();
    const beforeBalances = await database.select().from(inventoryBalances);
    const beforeMovements = await database.select().from(inventoryMovements);

    await database
      .update(products)
      .set({ name: "Changed after checkout", price: "999.00", updatedAt: new Date() })
      .where(eq(products.id, productIds.available));

    const response = await server.inject({
      method: "POST",
      url: `/api/v1/orders/${orderId}/invoice`,
      headers: authorization(accessTokens.admin),
    });
    expect(response.statusCode).toBe(201);
    const body = response.json<{
      id: string;
      number: string;
      orderId: string;
      origin: string;
      status: string;
      customerSnapshot: Record<string, unknown>;
      lines: Array<Record<string, unknown>>;
    }>();
    expect(body).toMatchObject({
      number: `INV-${body.id.toUpperCase()}`,
      orderId,
      origin: "ORDER",
      status: "PAID",
      customerSnapshot: { id: userIds.customerA },
      lines: [
        {
          productId: productIds.available,
          skuSnapshot: historicalLine?.skuSnapshot,
          nameSnapshot: historicalLine?.nameSnapshot,
          descriptionSnapshot: historicalLine?.nameSnapshot,
          quantity: 2,
          unitPrice: "100.00",
          lineSubtotal: "200.00",
          lineTotal: "200.00",
          currency: "USD",
        },
      ],
    });

    const [storedOrder] = await database.select().from(orders).where(eq(orders.id, orderId));
    const [storedInvoice] = await database.select().from(invoices).where(eq(invoices.id, body.id));
    const storedLines = await database.select().from(invoiceLines).where(eq(invoiceLines.invoiceId, body.id));
    expect(storedOrder?.status).toBe("INVOICED");
    expect(storedInvoice).toMatchObject({
      createdByUserId: userIds.admin,
      customerId: userIds.customerA,
      orderId,
      origin: "ORDER",
      status: "PAID",
    });
    expect(storedLines).toHaveLength(1);
    expect(await database.select().from(inventoryBalances)).toEqual(beforeBalances);
    expect(await database.select().from(inventoryMovements)).toEqual(beforeMovements);

    const orderAudits = await database
      .select()
      .from(auditEntries)
      .where(and(eq(auditEntries.entityId, orderId), eq(auditEntries.action, "ORDER_INVOICED")));
    const invoiceAudits = await database
      .select()
      .from(auditEntries)
      .where(and(eq(auditEntries.entityId, body.id), eq(auditEntries.action, "INVOICE_CREATED_FROM_ORDER")));
    expect(orderAudits).toHaveLength(1);
    expect(invoiceAudits).toHaveLength(1);
    expect(orderAudits[0]).toMatchObject({
      actorUserId: userIds.admin,
      changes: { before: { status: "PROCESSING" }, after: { status: "INVOICED" }, invoiceId: body.id },
    });
  });

  it("allows Billing, rejects unauthorized access and creates only one active invoice under concurrency", async () => {
    await addToCart("customerA", productIds.available, 1);
    const purchase = await checkoutRequest("customerA", "invoice-order-concurrent-001");
    const orderId = purchase.json<{ order: { id: string } }>().order.id;
    const url = `/api/v1/orders/${orderId}/invoice`;
    const beforeBalances = await database.select().from(inventoryBalances);
    const beforeMovements = await database.select().from(inventoryMovements);

    expect((await server.inject({ method: "POST", url })).statusCode).toBe(401);
    expect(
      (await server.inject({ method: "POST", url, headers: authorization(accessTokens.customerA) })).statusCode,
    ).toBe(403);
    expect(
      (
        await server.inject({
          method: "POST",
          url: "/api/v1/orders/not-a-uuid/invoice",
          headers: authorization(accessTokens.billing),
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await server.inject({
          method: "POST",
          url: `/api/v1/orders/${randomUUID()}/invoice`,
          headers: authorization(accessTokens.billing),
        })
      ).statusCode,
    ).toBe(404);

    const responses = await Promise.all([
      server.inject({ method: "POST", url, headers: authorization(accessTokens.billing) }),
      server.inject({ method: "POST", url, headers: authorization(accessTokens.billing) }),
    ]);
    expect(responses.map((result) => result.statusCode).sort()).toEqual([201, 409]);
    expect(responses.find((result) => result.statusCode === 409)?.json()).toMatchObject({
      code: "ORDER_ACTIVE_INVOICE",
    });
    const storedInvoices = await database.select().from(invoices).where(eq(invoices.orderId, orderId));
    expect(storedInvoices).toHaveLength(1);
    expect(storedInvoices[0]).toMatchObject({ createdByUserId: userIds.billing, status: "PAID" });
    expect((await database.select().from(orders).where(eq(orders.id, orderId)))[0]?.status).toBe("INVOICED");
    expect(await database.select().from(inventoryBalances)).toEqual(beforeBalances);
    expect(await database.select().from(inventoryMovements)).toEqual(beforeMovements);
  });

  it("rejects stock changed after cart validation without partial checkout writes", async () => {
    await addToCart("customerA", productIds.available, 2);
    await database
      .update(inventoryBalances)
      .set({ availableQuantity: 1, version: 1 })
      .where(eq(inventoryBalances.productId, productIds.available));

    const response = await checkoutRequest(
      "customerA",
      "checkout-stock-changed-0001",
    );

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      code: "CHECKOUT_INSUFFICIENT_STOCK",
      details: {
        shortages: [
          {
            availableQuantity: 1,
            productId: productIds.available,
            requestedQuantity: 2,
          },
        ],
      },
    });
    expect(await database.select().from(orders)).toHaveLength(0);
    expect(await database.select().from(payments)).toHaveLength(0);
    expect(await database.select().from(idempotencyRecords)).toHaveLength(0);
    expect(
      await database
        .select()
        .from(inventoryMovements)
        .where(eq(inventoryMovements.type, "SALE")),
    ).toHaveLength(0);

    const [cart] = await database
      .select({ status: carts.status })
      .from(carts)
      .where(eq(carts.customerId, userIds.customerA));
    const [balance] = await database
      .select({ availableQuantity: inventoryBalances.availableQuantity })
      .from(inventoryBalances)
      .where(eq(inventoryBalances.productId, productIds.available));
    expect(cart?.status).toBe("ACTIVE");
    expect(balance?.availableQuantity).toBe(1);
  });

  it("rejects a product deactivated after it entered the cart without creating an order", async () => {
    await addToCart("customerA", productIds.available, 1);
    await database
      .update(products)
      .set({ status: "INACTIVE", updatedAt: new Date() })
      .where(eq(products.id, productIds.available));

    const response = await checkoutRequest(
      "customerA",
      "checkout-inactive-product-0001",
    );

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      code: "CHECKOUT_PRODUCT_UNAVAILABLE",
      details: { productId: productIds.available },
    });
    expect(await database.select().from(orders)).toHaveLength(0);
    expect(await database.select().from(payments)).toHaveLength(0);
    expect(await database.select().from(idempotencyRecords)).toHaveLength(0);
    expect(
      await database
        .select()
        .from(inventoryMovements)
        .where(eq(inventoryMovements.type, "SALE")),
    ).toHaveLength(0);

    const [cart] = await database
      .select({ status: carts.status })
      .from(carts)
      .where(eq(carts.customerId, userIds.customerA));
    expect(cart?.status).toBe("ACTIVE");
  });

  it("keeps the cart and stock intact when simulated payment is rejected", async () => {
    await addToCart("customerA", productIds.available, 1);

    const response = await checkoutRequest(
      "customerA",
      "checkout-rejected-payment-0001",
      "SIMULATED_CARD_REJECTED",
    );

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      code: "PAYMENT_REJECTED",
      details: {
        method: "SIMULATED_CARD_REJECTED",
        status: "REJECTED",
      },
    });
    expect(await database.select().from(orders)).toHaveLength(0);
    expect(await database.select().from(payments)).toHaveLength(0);
    expect(
      await database
        .select()
        .from(inventoryMovements)
        .where(eq(inventoryMovements.type, "SALE")),
    ).toHaveLength(0);

    const [attempt] = await database.select().from(idempotencyRecords);
    const [cart] = await database
      .select({ status: carts.status })
      .from(carts)
      .where(eq(carts.customerId, userIds.customerA));
    const [balance] = await database
      .select({ availableQuantity: inventoryBalances.availableQuantity })
      .from(inventoryBalances)
      .where(eq(inventoryBalances.productId, productIds.available));
    expect(attempt).toMatchObject({ orderId: null, status: "FAILED" });
    expect(cart?.status).toBe("ACTIVE");
    expect(balance?.availableQuantity).toBe(5);
  });

  it("allows only one concurrent checkout to consume the last unit", async () => {
    await database
      .update(inventoryBalances)
      .set({ availableQuantity: 1, version: 0 })
      .where(eq(inventoryBalances.productId, productIds.available));
    await addToCart("customerA", productIds.available, 1);
    await addToCart("customerB", productIds.available, 1);

    const responses = await Promise.all([
      checkoutRequest("customerA", "checkout-concurrent-a-0001"),
      checkoutRequest("customerB", "checkout-concurrent-b-0001"),
    ]);

    expect(
      responses.map((response) => response.statusCode).sort((left, right) => left - right),
    ).toEqual([201, 409]);
    expect(responses.find((response) => response.statusCode === 409)?.json()).toMatchObject({
      code: "CHECKOUT_INSUFFICIENT_STOCK",
    });
    expect(await database.select().from(orders)).toHaveLength(1);
    expect(await database.select().from(payments)).toHaveLength(1);
    expect(await database.select().from(idempotencyRecords)).toHaveLength(1);
    expect(
      await database
        .select()
        .from(inventoryMovements)
        .where(eq(inventoryMovements.type, "SALE")),
    ).toHaveLength(1);

    const [balance] = await database
      .select({ availableQuantity: inventoryBalances.availableQuantity })
      .from(inventoryBalances)
      .where(eq(inventoryBalances.productId, productIds.available));
    const customerCarts = await database
      .select({ status: carts.status })
      .from(carts)
      .where(
        and(
          eq(carts.customerId, userIds.customerA),
          eq(carts.status, "CHECKED_OUT"),
        ),
      );
    const checkedOutCartB = await database
      .select({ status: carts.status })
      .from(carts)
      .where(
        and(
          eq(carts.customerId, userIds.customerB),
          eq(carts.status, "CHECKED_OUT"),
        ),
      );
    expect(balance?.availableQuantity).toBe(0);
    expect(customerCarts.length + checkedOutCartB.length).toBe(1);
  });

  it("rolls back order, payment, movement, balance, and cart when a late checkout write fails", async () => {
    await addToCart("customerA", productIds.available, 2);
    const inventory = app.get(InventoryStockService);
    const deduct = inventory.deductInTransaction.bind(inventory);
    vi.spyOn(inventory, "deductInTransaction").mockImplementationOnce(
      async (transaction, items, reference) => {
        await deduct(transaction, items, reference);
        throw new Error("Injected failure after inventory writes");
      },
    );

    const response = await checkoutRequest(
      "customerA",
      "checkout-rollback-0001",
    );

    expect(response.statusCode).toBe(500);
    expect(await database.select().from(orders)).toHaveLength(0);
    expect(await database.select().from(orderItems)).toHaveLength(0);
    expect(await database.select().from(payments)).toHaveLength(0);
    expect(await database.select().from(idempotencyRecords)).toHaveLength(0);
    expect(
      await database
        .select()
        .from(inventoryMovements)
        .where(eq(inventoryMovements.type, "SALE")),
    ).toHaveLength(0);

    const [balance] = await database
      .select({ availableQuantity: inventoryBalances.availableQuantity })
      .from(inventoryBalances)
      .where(eq(inventoryBalances.productId, productIds.available));
    const [cart] = await database
      .select({ closedAt: carts.closedAt, status: carts.status })
      .from(carts)
      .where(eq(carts.customerId, userIds.customerA));
    expect(balance?.availableQuantity).toBe(5);
    expect(cart).toMatchObject({ closedAt: null, status: "ACTIVE" });
  });
});
