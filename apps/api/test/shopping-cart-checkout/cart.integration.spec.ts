import { randomUUID } from "node:crypto";
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
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import { configureApplication } from "../../src/application";
import {
  cartItems,
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
  customerId: string;
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
  "available" | "differentCurrency" | "inactive" | "outOfStock" | "precise",
  string
>;

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

async function createProduct(input: {
  currency?: string;
  price?: string;
  sku: string;
  status: "ACTIVE" | "INACTIVE";
  stock: number;
}): Promise<string> {
  const [product] = await database
    .insert(products)
    .values({
      currency: input.currency ?? "USD",
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

describe("persistent customer cart", () => {
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
      differentCurrency: await createProduct({
        currency: "EUR",
        price: "20.00",
        sku: "CART-EUR",
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
    await database.delete(carts);
    await database
      .update(products)
      .set({ price: "100.00", updatedAt: new Date() })
      .where(eq(products.id, productIds.available));
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

  it("allows only CUSTOMER to read a cart", async () => {
    const responses = await Promise.all([
      server.inject({ method: "GET", url: "/api/v1/cart" }),
      server.inject({ method: "GET", url: "/api/v1/cart", headers: authorization(accessTokens.admin) }),
      server.inject({ method: "GET", url: "/api/v1/cart", headers: authorization(accessTokens.billing) }),
      server.inject({ method: "GET", url: "/api/v1/cart", headers: authorization(accessTokens.customerA) }),
    ]);

    expect(responses.map((response) => response.statusCode)).toEqual([
      401, 403, 403, 200,
    ]);
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

  it("rejects products in a different currency without changing the cart", async () => {
    await server.inject({
      method: "POST",
      url: "/api/v1/cart/items",
      headers: authorization(accessTokens.customerA),
      payload: { productId: productIds.available, quantity: 1 },
    });

    const rejected = await server.inject({
      method: "POST",
      url: "/api/v1/cart/items",
      headers: authorization(accessTokens.customerA),
      payload: { productId: productIds.differentCurrency, quantity: 1 },
    });
    expect(rejected.statusCode).toBe(409);
    expect(rejected.json()).toMatchObject({
      code: "CART_CURRENCY_MISMATCH",
      details: { cartCurrency: "USD", productCurrency: "EUR" },
    });

    const current = await server.inject({
      method: "GET",
      url: "/api/v1/cart",
      headers: authorization(accessTokens.customerA),
    });
    expect(current.json<CartResponse>()).toMatchObject({
      currency: "USD",
      items: [{ productId: productIds.available }],
      subtotal: "100.00",
      total: "100.00",
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
    const addition = await server.inject({
      method: "POST",
      url: "/api/v1/cart/items",
      headers: authorization(accessTokens.customerA),
      payload: { productId: productIds.available, quantity: 2 },
    });
    expect(addition.statusCode).toBe(201);

    const request = {
      method: "POST" as const,
      url: "/api/v1/checkout",
      headers: {
        ...authorization(accessTokens.customerA),
        "idempotency-key": "checkout-customer-a-0001",
      },
      payload: {
        paymentMethod: "SIMULATED_CARD_APPROVED",
        shippingMethod: "STANDARD",
        shippingAddress: {
          city: "Santiago",
          countryCode: "CL",
          line1: "Avenida Tecnología 123",
          postalCode: "8320000",
          recipientName: "customerA",
          region: "Región Metropolitana",
        },
      },
    };
    const first = await server.inject(request);
    const repeated = await server.inject(request);

    expect([first.statusCode, repeated.statusCode]).toEqual([201, 201]);
    expect(repeated.json()).toEqual(first.json());
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
});
