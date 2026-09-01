import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import "dotenv/config";
import { eq } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  cartItems,
  carts,
  idempotencyRecords,
  orderItems,
  orders,
  payments,
  products,
  users,
} from "../../src/database/schema";
import * as schema from "../../src/database/schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for PostgreSQL integration tests");
}

const testDatabaseName = `ecommerce_orders_${randomUUID().replaceAll("-", "")}`;

if (!/^ecommerce_orders_[a-f0-9]{32}$/.test(testDatabaseName)) {
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

async function insertUser(email: string, displayName = "Test customer") {
  const [createdUser] = await database
    .insert(users)
    .values({
      email,
      passwordHash: "integration-test-password-hash",
      displayName,
    })
    .returning({ id: users.id });

  if (!createdUser) {
    throw new Error("PostgreSQL did not return the inserted user");
  }

  return createdUser;
}

async function insertProduct(sku: string, name = `Product ${sku}`) {
  const [createdProduct] = await database
    .insert(products)
    .values({
      sku,
      name,
      description: `Technology product identified by ${sku}`,
      price: "100.00",
      currency: "USD",
      status: "ACTIVE",
    })
    .returning({ id: products.id });

  if (!createdProduct) {
    throw new Error("PostgreSQL did not return the inserted product");
  }

  return createdProduct;
}

async function insertOrder(customerId: string, number: string) {
  const [createdOrder] = await database
    .insert(orders)
    .values({
      number,
      customerId,
      currency: "USD",
      subtotal: "200.00",
      shippingTotal: "10.00",
      taxTotal: "19.00",
      total: "229.00",
      customerSnapshot: {
        displayName: "Historical customer",
        email: "historical-customer@example.com",
      },
      shippingAddressSnapshot: {
        addressLine: "123 Historical Street",
        city: "Santiago",
        country: "CL",
      },
      shippingMethodSnapshot: {
        code: "STANDARD",
        name: "Standard shipping",
        price: "10.00",
      },
      paymentSnapshot: {
        method: "SIMULATED_CARD",
        status: "APPROVED",
      },
    })
    .returning({ id: orders.id });

  if (!createdOrder) {
    throw new Error("PostgreSQL did not return the inserted order");
  }

  return createdOrder;
}

describe("cart, order, payment, and idempotency persistence", () => {
  beforeAll(async () => {
    maintenancePool = new Pool({
      application_name: "technology-ecommerce-orders-test-admin",
      connectionString: maintenanceUrl.toString(),
      max: 1,
    });

    await maintenancePool.query(
      `create database ${quotedTestDatabaseName} template template0`,
    );
    isolatedDatabaseCreated = true;

    testPool = new Pool({
      application_name: "technology-ecommerce-orders-test",
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

  it("allows one active cart per customer and one line per product", async () => {
    const customer = await insertUser("cart-customer@example.com");
    const product = await insertProduct("CART-001");
    const [cart] = await database
      .insert(carts)
      .values({ customerId: customer.id })
      .returning({ id: carts.id });

    if (!cart) {
      throw new Error("PostgreSQL did not return the inserted cart");
    }

    await expect(
      database.insert(carts).values({ customerId: customer.id }),
    ).rejects.toMatchObject({
      cause: {
        code: "23505",
        constraint: "carts_customer_active_unique",
      },
    });

    await database.insert(cartItems).values({
      cartId: cart.id,
      productId: product.id,
      quantity: 1,
    });

    await expect(
      database.insert(cartItems).values({
        cartId: cart.id,
        productId: product.id,
        quantity: 2,
      }),
    ).rejects.toMatchObject({
      cause: {
        code: "23505",
        constraint: "cart_items_cart_product_unique",
      },
    });

    await expect(
      database
        .update(cartItems)
        .set({ quantity: 0 })
        .where(eq(cartItems.cartId, cart.id)),
    ).rejects.toMatchObject({
      cause: {
        code: "23514",
        constraint: "cart_items_quantity_positive",
      },
    });

    await database
      .update(carts)
      .set({ status: "CHECKED_OUT", closedAt: new Date() })
      .where(eq(carts.id, cart.id));

    const [nextCart] = await database
      .insert(carts)
      .values({ customerId: customer.id })
      .returning({ id: carts.id });

    expect(nextCart?.id).toBeTypeOf("string");
  });

  it("rejects orphaned carts, lines, orders, and payments", async () => {
    const missingId = randomUUID();
    const customer = await insertUser("relations-customer@example.com");
    const product = await insertProduct("RELATION-001");

    await expect(
      database.insert(carts).values({ customerId: missingId }),
    ).rejects.toMatchObject({
      cause: {
        code: "23503",
        constraint: "carts_customer_id_users_id_fk",
      },
    });

    await expect(
      database.insert(cartItems).values({
        cartId: missingId,
        productId: product.id,
        quantity: 1,
      }),
    ).rejects.toMatchObject({
      cause: {
        code: "23503",
        constraint: "cart_items_cart_id_carts_id_fk",
      },
    });

    await expect(insertOrder(missingId, "ORD-ORPHAN")).rejects.toMatchObject({
      cause: {
        code: "23503",
        constraint: "orders_customer_id_users_id_fk",
      },
    });

    await expect(
      database.insert(payments).values({
        orderId: missingId,
        method: "SIMULATED_CARD",
        amount: "229.00",
        currency: "USD",
        resultSnapshot: {},
      }),
    ).rejects.toMatchObject({
      cause: {
        code: "23503",
        constraint: "payments_order_id_orders_id_fk",
      },
    });

    expect(customer.id).toBeTypeOf("string");
  });

  it("enforces unique order, payment, line, and idempotency identities", async () => {
    const customer = await insertUser("unique-order-customer@example.com");
    const product = await insertProduct("ORDER-UNIQUE-001");
    const order = await insertOrder(customer.id, "ORD-2026-0001");

    await expect(
      insertOrder(customer.id, "ORD-2026-0001"),
    ).rejects.toMatchObject({
      cause: { code: "23505", constraint: "orders_number_unique" },
    });

    await database.insert(orderItems).values({
      orderId: order.id,
      productId: product.id,
      skuSnapshot: "ORDER-UNIQUE-001",
      nameSnapshot: "Historical product",
      quantity: 2,
      unitPrice: "100.00",
      taxAmount: "19.00",
      lineTotal: "219.00",
      currency: "USD",
    });

    await expect(
      database.insert(orderItems).values({
        orderId: order.id,
        productId: product.id,
        skuSnapshot: "ORDER-UNIQUE-001",
        nameSnapshot: "Duplicate historical product",
        quantity: 2,
        unitPrice: "100.00",
        taxAmount: "19.00",
        lineTotal: "219.00",
        currency: "USD",
      }),
    ).rejects.toMatchObject({
      cause: {
        code: "23505",
        constraint: "order_items_order_product_unique",
      },
    });

    const payment = {
      orderId: order.id,
      status: "APPROVED" as const,
      method: "SIMULATED_CARD",
      amount: "229.00",
      currency: "USD",
      resultSnapshot: { authorizationCode: "TEST-AUTH-001" },
      processedAt: new Date(),
    };

    await database.insert(payments).values(payment);

    await expect(database.insert(payments).values(payment)).rejects.toMatchObject(
      {
        cause: { code: "23505", constraint: "payments_order_unique" },
      },
    );

    const idempotencyRecord = {
      customerId: customer.id,
      scope: "CHECKOUT",
      keyHash: "hashed-idempotency-key-001",
      requestHash: "hashed-checkout-request-001",
      expiresAt: new Date(Date.now() + 60_000),
    };

    await database.insert(idempotencyRecords).values(idempotencyRecord);

    await expect(
      database.insert(idempotencyRecords).values(idempotencyRecord),
    ).rejects.toMatchObject({
      cause: {
        code: "23505",
        constraint: "idempotency_records_key_unique",
      },
    });
  });

  it("keeps order and payment snapshots unchanged after master data edits", async () => {
    const customer = await insertUser(
      "historical-customer@example.com",
      "Historical customer",
    );
    const product = await insertProduct(
      "SNAPSHOT-001",
      "Historical product",
    );
    const order = await insertOrder(customer.id, "ORD-2026-0002");

    await database.insert(orderItems).values({
      orderId: order.id,
      productId: product.id,
      skuSnapshot: "SNAPSHOT-001",
      nameSnapshot: "Historical product",
      quantity: 2,
      unitPrice: "100.00",
      taxAmount: "19.00",
      lineTotal: "219.00",
      currency: "USD",
    });

    await database.insert(payments).values({
      orderId: order.id,
      status: "APPROVED",
      method: "SIMULATED_CARD",
      amount: "229.00",
      currency: "USD",
      providerReference: "provider-reference-001",
      resultSnapshot: {
        authorizationCode: "TEST-AUTH-002",
        provider: "SIMULATED",
      },
      processedAt: new Date(),
    });

    await database.insert(idempotencyRecords).values({
      customerId: customer.id,
      scope: "CHECKOUT",
      keyHash: "hashed-idempotency-key-002",
      requestHash: "hashed-checkout-request-002",
      status: "COMPLETED",
      responseSnapshot: {
        orderId: order.id,
        orderNumber: "ORD-2026-0002",
      },
      orderId: order.id,
      expiresAt: new Date(Date.now() + 60_000),
    });

    await database
      .update(users)
      .set({
        email: "changed-customer@example.com",
        displayName: "Changed customer",
      })
      .where(eq(users.id, customer.id));
    await database
      .update(products)
      .set({ name: "Changed product", price: "250.00" })
      .where(eq(products.id, product.id));

    const [storedOrder] = await database
      .select({
        customerSnapshot: orders.customerSnapshot,
        shippingAddressSnapshot: orders.shippingAddressSnapshot,
        shippingMethodSnapshot: orders.shippingMethodSnapshot,
        paymentSnapshot: orders.paymentSnapshot,
      })
      .from(orders)
      .where(eq(orders.id, order.id));
    const [storedLine] = await database
      .select({
        skuSnapshot: orderItems.skuSnapshot,
        nameSnapshot: orderItems.nameSnapshot,
        unitPrice: orderItems.unitPrice,
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id));
    const [storedPayment] = await database
      .select({ resultSnapshot: payments.resultSnapshot })
      .from(payments)
      .where(eq(payments.orderId, order.id));
    const [storedIdempotency] = await database
      .select({ responseSnapshot: idempotencyRecords.responseSnapshot })
      .from(idempotencyRecords)
      .where(eq(idempotencyRecords.orderId, order.id));

    expect(storedOrder).toEqual({
      customerSnapshot: {
        displayName: "Historical customer",
        email: "historical-customer@example.com",
      },
      shippingAddressSnapshot: {
        addressLine: "123 Historical Street",
        city: "Santiago",
        country: "CL",
      },
      shippingMethodSnapshot: {
        code: "STANDARD",
        name: "Standard shipping",
        price: "10.00",
      },
      paymentSnapshot: {
        method: "SIMULATED_CARD",
        status: "APPROVED",
      },
    });
    expect(storedLine).toEqual({
      skuSnapshot: "SNAPSHOT-001",
      nameSnapshot: "Historical product",
      unitPrice: "100.00",
    });
    expect(storedPayment?.resultSnapshot).toEqual({
      authorizationCode: "TEST-AUTH-002",
      provider: "SIMULATED",
    });
    expect(storedIdempotency?.responseSnapshot).toEqual({
      orderId: order.id,
      orderNumber: "ORD-2026-0002",
    });
  });
});
