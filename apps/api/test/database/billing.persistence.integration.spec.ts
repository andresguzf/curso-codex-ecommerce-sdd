import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import "dotenv/config";
import { eq } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  invoiceLines,
  invoices,
  orders,
  products,
  users,
} from "../../src/database/schema";
import * as schema from "../../src/database/schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for PostgreSQL integration tests");
}

const testDatabaseName = `ecommerce_billing_${randomUUID().replaceAll("-", "")}`;

if (!/^ecommerce_billing_[a-f0-9]{32}$/.test(testDatabaseName)) {
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

async function insertUser(email: string, displayName = "Billing customer") {
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
      subtotal: "100.00",
      shippingTotal: "10.00",
      taxTotal: "19.00",
      total: "129.00",
      customerSnapshot: {
        displayName: "Billing customer",
        email: "billing-customer@example.com",
      },
      shippingAddressSnapshot: {
        addressLine: "123 Invoice Street",
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

function invoiceSnapshots() {
  return {
    issuerSnapshot: {
      legalName: "Historical Technology Store SpA",
      taxIdentifier: "76.000.000-0",
    },
    customerSnapshot: {
      displayName: "Historical billing customer",
      email: "historical-billing-customer@example.com",
    },
  };
}

async function insertIssuedManualInvoice(
  customerId: string,
  number: string | null,
) {
  const issuedAt = new Date();
  const [createdInvoice] = await database
    .insert(invoices)
    .values({
      number,
      origin: "MANUAL",
      status: "PENDING_PAYMENT",
      customerId,
      currency: "USD",
      subtotal: "100.00",
      shippingTotal: "0.00",
      taxTotal: "19.00",
      total: "119.00",
      ...invoiceSnapshots(),
      createdAt: issuedAt,
      issuedAt,
    })
    .returning({ id: invoices.id });

  if (!createdInvoice) {
    throw new Error("PostgreSQL did not return the inserted invoice");
  }

  return createdInvoice;
}

describe("billing persistence constraints", () => {
  beforeAll(async () => {
    maintenancePool = new Pool({
      application_name: "technology-ecommerce-billing-test-admin",
      connectionString: maintenanceUrl.toString(),
      max: 1,
    });

    await maintenancePool.query(
      `create database ${quotedTestDatabaseName} template template0`,
    );
    isolatedDatabaseCreated = true;

    testPool = new Pool({
      application_name: "technology-ecommerce-billing-test",
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

  it("enforces unique issued numbers while allowing unnumbered drafts", async () => {
    const customer = await insertUser("invoice-number-customer@example.com");

    await insertIssuedManualInvoice(customer.id, "INV-2026-0001");

    await expect(
      insertIssuedManualInvoice(customer.id, "INV-2026-0001"),
    ).rejects.toMatchObject({
      cause: { code: "23505", constraint: "invoices_number_unique" },
    });

    await database.insert(invoices).values([
      {
        origin: "MANUAL",
        customerId: customer.id,
        currency: "USD",
        subtotal: "0.00",
        total: "0.00",
        ...invoiceSnapshots(),
      },
      {
        origin: "MANUAL",
        customerId: customer.id,
        currency: "USD",
        subtotal: "50.00",
        taxTotal: "9.50",
        total: "59.50",
        ...invoiceSnapshots(),
      },
    ]);

    await expect(
      insertIssuedManualInvoice(customer.id, null),
    ).rejects.toMatchObject({
      cause: {
        code: "23514",
        constraint: "invoices_numbering_state_consistent",
      },
    });
  });

  it("allows only one active invoice for an order and permits reissue after void", async () => {
    const customer = await insertUser("order-invoice-customer@example.com");
    const order = await insertOrder(customer.id, "ORD-INVOICE-0001");
    const [draft] = await database
      .insert(invoices)
      .values({
        origin: "ORDER",
        orderId: order.id,
        customerId: customer.id,
        currency: "USD",
        subtotal: "100.00",
        shippingTotal: "10.00",
        taxTotal: "19.00",
        total: "129.00",
        ...invoiceSnapshots(),
      })
      .returning({ id: invoices.id });

    if (!draft) {
      throw new Error("PostgreSQL did not return the order invoice draft");
    }

    await expect(
      database.insert(invoices).values({
        origin: "ORDER",
        orderId: order.id,
        customerId: customer.id,
        currency: "USD",
        subtotal: "100.00",
        shippingTotal: "10.00",
        taxTotal: "19.00",
        total: "129.00",
        ...invoiceSnapshots(),
      }),
    ).rejects.toMatchObject({
      cause: {
        code: "23505",
        constraint: "invoices_active_order_unique",
      },
    });

    await database
      .update(invoices)
      .set({ status: "VOID", voidedAt: new Date() })
      .where(eq(invoices.id, draft.id));

    const issuedAt = new Date();
    const [replacement] = await database
      .insert(invoices)
      .values({
        number: "INV-2026-0002",
        origin: "ORDER",
        status: "PAID",
        orderId: order.id,
        customerId: customer.id,
        currency: "USD",
        subtotal: "100.00",
        shippingTotal: "10.00",
        taxTotal: "19.00",
        total: "129.00",
        ...invoiceSnapshots(),
        createdAt: issuedAt,
        issuedAt,
        paidAt: issuedAt,
      })
      .returning({ id: invoices.id });

    expect(replacement?.id).toBeTypeOf("string");
  });

  it("keeps manual order references optional and validates ordered origins", async () => {
    const customer = await insertUser("invoice-origin-customer@example.com");
    const order = await insertOrder(customer.id, "ORD-INVOICE-0002");
    const missingId = randomUUID();

    const [manualInvoice] = await database
      .insert(invoices)
      .values({
        origin: "MANUAL",
        customerId: customer.id,
        currency: "USD",
        subtotal: "25.00",
        taxTotal: "4.75",
        total: "29.75",
        ...invoiceSnapshots(),
      })
      .returning({ id: invoices.id, orderId: invoices.orderId });

    expect(manualInvoice?.orderId).toBeNull();

    await expect(
      database.insert(invoices).values({
        origin: "MANUAL",
        orderId: order.id,
        customerId: customer.id,
        currency: "USD",
        subtotal: "25.00",
        taxTotal: "4.75",
        total: "29.75",
        ...invoiceSnapshots(),
      }),
    ).rejects.toMatchObject({
      cause: {
        code: "23514",
        constraint: "invoices_origin_order_consistent",
      },
    });

    await expect(
      database.insert(invoices).values({
        origin: "ORDER",
        customerId: customer.id,
        currency: "USD",
        subtotal: "25.00",
        taxTotal: "4.75",
        total: "29.75",
        ...invoiceSnapshots(),
      }),
    ).rejects.toMatchObject({
      cause: {
        code: "23514",
        constraint: "invoices_origin_order_consistent",
      },
    });

    await expect(
      database.insert(invoices).values({
        origin: "ORDER",
        orderId: missingId,
        customerId: customer.id,
        currency: "USD",
        subtotal: "25.00",
        taxTotal: "4.75",
        total: "29.75",
        ...invoiceSnapshots(),
      }),
    ).rejects.toMatchObject({
      cause: {
        code: "23503",
        constraint: "invoices_order_id_orders_id_fk",
      },
    });

    await expect(
      database.insert(invoices).values({
        origin: "MANUAL",
        customerId: missingId,
        currency: "USD",
        subtotal: "25.00",
        taxTotal: "4.75",
        total: "29.75",
        ...invoiceSnapshots(),
      }),
    ).rejects.toMatchObject({
      cause: {
        code: "23503",
        constraint: "invoices_customer_id_users_id_fk",
      },
    });

    await expect(
      database.insert(invoiceLines).values({
        invoiceId: missingId,
        position: 1,
        nameSnapshot: "Orphan line",
        descriptionSnapshot: "Line without an existing invoice",
        quantity: 1,
        unitPrice: "25.00",
        taxRate: "19.0000",
        taxAmount: "4.75",
        lineSubtotal: "25.00",
        lineTotal: "29.75",
        currency: "USD",
      }),
    ).rejects.toMatchObject({
      cause: {
        code: "23503",
        constraint: "invoice_lines_invoice_id_invoices_id_fk",
      },
    });
  });

  it("preserves invoice and line snapshots after master data changes", async () => {
    const customer = await insertUser(
      "historical-billing-customer@example.com",
      "Historical billing customer",
    );
    const product = await insertProduct(
      "INVOICE-SNAPSHOT-001",
      "Historical invoice product",
    );
    const invoice = await insertIssuedManualInvoice(
      customer.id,
      "INV-2026-0003",
    );

    await database.insert(invoiceLines).values({
      invoiceId: invoice.id,
      productId: product.id,
      position: 1,
      skuSnapshot: "INVOICE-SNAPSHOT-001",
      nameSnapshot: "Historical invoice product",
      descriptionSnapshot: "Original invoice line description",
      quantity: 1,
      unitPrice: "100.00",
      taxRate: "19.0000",
      taxAmount: "19.00",
      lineSubtotal: "100.00",
      lineTotal: "119.00",
      currency: "USD",
    });

    await expect(
      database.insert(invoiceLines).values({
        invoiceId: invoice.id,
        productId: product.id,
        position: 1,
        skuSnapshot: "INVOICE-SNAPSHOT-001",
        nameSnapshot: "Duplicate position",
        descriptionSnapshot: "Invalid duplicate invoice position",
        quantity: 1,
        unitPrice: "100.00",
        taxRate: "19.0000",
        taxAmount: "19.00",
        lineSubtotal: "100.00",
        lineTotal: "119.00",
        currency: "USD",
      }),
    ).rejects.toMatchObject({
      cause: {
        code: "23505",
        constraint: "invoice_lines_invoice_position_unique",
      },
    });

    await database
      .update(users)
      .set({
        email: "changed-billing-customer@example.com",
        displayName: "Changed billing customer",
      })
      .where(eq(users.id, customer.id));
    await database
      .update(products)
      .set({ name: "Changed invoice product", price: "250.00" })
      .where(eq(products.id, product.id));

    const [storedInvoice] = await database
      .select({
        issuerSnapshot: invoices.issuerSnapshot,
        customerSnapshot: invoices.customerSnapshot,
      })
      .from(invoices)
      .where(eq(invoices.id, invoice.id));
    const [storedLine] = await database
      .select({
        skuSnapshot: invoiceLines.skuSnapshot,
        nameSnapshot: invoiceLines.nameSnapshot,
        descriptionSnapshot: invoiceLines.descriptionSnapshot,
        unitPrice: invoiceLines.unitPrice,
        taxRate: invoiceLines.taxRate,
        taxAmount: invoiceLines.taxAmount,
      })
      .from(invoiceLines)
      .where(eq(invoiceLines.invoiceId, invoice.id));

    expect(storedInvoice).toEqual(invoiceSnapshots());
    expect(storedLine).toEqual({
      skuSnapshot: "INVOICE-SNAPSHOT-001",
      nameSnapshot: "Historical invoice product",
      descriptionSnapshot: "Original invoice line description",
      unitPrice: "100.00",
      taxRate: "19.0000",
      taxAmount: "19.00",
    });
  });
});
