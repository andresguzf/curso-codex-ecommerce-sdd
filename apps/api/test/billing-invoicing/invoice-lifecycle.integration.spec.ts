import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import "dotenv/config";
import { asc, eq } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  InvoiceAggregate,
  type InvoiceCommercialSnapshot,
  type InvoiceSnapshot,
} from "../../src/billing-invoicing/invoice.aggregate";
import { InvoiceLifecycleService } from "../../src/billing-invoicing/invoice-lifecycle.service";
import type { DatabaseService } from "../../src/database/database.service";
import {
  auditEntries,
  invoiceLines,
  invoices,
  products,
  users,
} from "../../src/database/schema";
import * as schema from "../../src/database/schema";
import type { AuthenticatedUser } from "../../src/identity-access/auth.types";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for PostgreSQL integration tests");
}

const testDatabaseName = `ecommerce_invoice_lifecycle_${randomUUID().replaceAll("-", "")}`;
if (!/^ecommerce_invoice_lifecycle_[a-f0-9]{32}$/.test(testDatabaseName)) {
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
let service: InvoiceLifecycleService;
let isolatedDatabaseCreated = false;
let customerId: string;
let productId: string;
let admin: AuthenticatedUser;
let billing: AuthenticatedUser;

const createdAt = new Date("2026-09-10T12:00:00.000Z");
const issuedAt = new Date("2026-09-10T13:00:00.000Z");
const paidAt = new Date("2026-09-10T14:00:00.000Z");
const voidedAt = new Date("2026-09-10T15:00:00.000Z");

async function insertUser(
  email: string,
  displayName: string,
): Promise<string> {
  const [user] = await database
    .insert(users)
    .values({
      email,
      displayName,
      passwordHash: "integration-test-password-hash",
    })
    .returning({ id: users.id });
  if (!user) throw new Error("Expected PostgreSQL to return the user");
  return user.id;
}

function commercialSnapshot(
  createdByUserId: string,
): InvoiceCommercialSnapshot {
  return {
    origin: "MANUAL",
    orderId: null,
    customerId,
    createdByUserId,
    currency: "USD",
    subtotal: "100.00",
    shippingTotal: "0.00",
    taxTotal: "19.00",
    total: "119.00",
    issuerSnapshot: {
      legalName: "Historical Technology Store SpA",
      taxIdentifier: "76.000.000-0",
    },
    customerSnapshot: {
      displayName: "Historical invoice customer",
      email: "invoice-customer@example.com",
    },
    lines: [
      {
        productId,
        position: 1,
        skuSnapshot: "INVOICE-LIFECYCLE-001",
        nameSnapshot: "Historical invoice product",
        descriptionSnapshot: "Original product description",
        quantity: 1,
        unitPrice: "100.00",
        taxRate: "19.0000",
        taxAmount: "19.00",
        lineSubtotal: "100.00",
        lineTotal: "119.00",
        currency: "USD",
      },
    ],
  };
}

async function persistDraft(
  createdByUserId = admin.id,
): Promise<InvoiceSnapshot> {
  const snapshot = InvoiceAggregate.createDraft(
    commercialSnapshot(createdByUserId),
    createdAt,
  ).snapshot;
  await database.insert(invoices).values({
    id: snapshot.id,
    number: snapshot.number,
    origin: snapshot.origin,
    status: snapshot.status,
    orderId: snapshot.orderId,
    customerId: snapshot.customerId,
    createdByUserId: snapshot.createdByUserId,
    currency: snapshot.currency,
    subtotal: snapshot.subtotal,
    shippingTotal: snapshot.shippingTotal,
    taxTotal: snapshot.taxTotal,
    total: snapshot.total,
    issuerSnapshot: snapshot.issuerSnapshot,
    customerSnapshot: snapshot.customerSnapshot,
    createdAt: new Date(snapshot.createdAt),
    updatedAt: new Date(snapshot.updatedAt),
  });
  await database.insert(invoiceLines).values(
    snapshot.lines.map((line) => ({
      ...line,
      invoiceId: snapshot.id,
    })),
  );
  return snapshot;
}

describe("invoice lifecycle persistence", () => {
  beforeAll(async () => {
    maintenancePool = new Pool({
      application_name: "technology-ecommerce-invoice-lifecycle-admin",
      connectionString: maintenanceUrl.toString(),
      max: 1,
    });
    await maintenancePool.query(
      `create database ${quotedTestDatabaseName} template template0`,
    );
    isolatedDatabaseCreated = true;

    testPool = new Pool({
      application_name: "technology-ecommerce-invoice-lifecycle-test",
      connectionString: isolatedDatabaseUrl.toString(),
      max: 4,
    });
    database = drizzle({ client: testPool, schema });
    await migrate(database, {
      migrationsFolder: resolve("src/database/migrations"),
      migrationsSchema: "drizzle",
      migrationsTable: "__drizzle_migrations",
    });
    service = new InvoiceLifecycleService({
      client: database,
    } as unknown as DatabaseService);

    const adminId = await insertUser("invoice-admin@example.com", "Invoice admin");
    const billingId = await insertUser(
      "invoice-billing@example.com",
      "Invoice billing",
    );
    customerId = await insertUser(
      "invoice-customer@example.com",
      "Historical invoice customer",
    );
    admin = {
      id: adminId,
      email: "invoice-admin@example.com",
      displayName: "Invoice admin",
      role: "ADMIN",
    };
    billing = {
      id: billingId,
      email: "invoice-billing@example.com",
      displayName: "Invoice billing",
      role: "BILLING",
    };
    const [product] = await database
      .insert(products)
      .values({
        sku: "INVOICE-LIFECYCLE-001",
        name: "Historical invoice product",
        description: "Original product description",
        price: "100.00",
        currency: "USD",
        status: "ACTIVE",
      })
      .returning({ id: products.id });
    if (!product) throw new Error("Expected PostgreSQL to return the product");
    productId = product.id;
  }, 30_000);

  afterAll(async () => {
    await testPool?.end();
    if (maintenancePool && isolatedDatabaseCreated) {
      await maintenancePool.query(
        "select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()",
        [testDatabaseName],
      );
      await maintenancePool.query(`drop database ${quotedTestDatabaseName}`);
    }
    await maintenancePool?.end();
  }, 30_000);

  it("issues, pays and voids with immutable snapshots and atomic audit entries", async () => {
    const draft = await persistDraft();
    expect(draft).toMatchObject({ status: "DRAFT", number: null });

    const pending = await service.transition(
      admin,
      draft.id,
      "PENDING_PAYMENT",
      issuedAt,
    );
    expect(pending).toMatchObject({
      status: "PENDING_PAYMENT",
      number: `INV-${draft.id.toUpperCase()}`,
      issuedAt: issuedAt.toISOString(),
    });

    await database
      .update(users)
      .set({ displayName: "Changed customer" })
      .where(eq(users.id, customerId));
    await database
      .update(products)
      .set({ name: "Changed product", price: "999.00" })
      .where(eq(products.id, productId));

    const paid = await service.transition(
      billing,
      draft.id,
      "PAID",
      paidAt,
    );
    expect(paid).toMatchObject({
      status: "PAID",
      paidAt: paidAt.toISOString(),
      customerSnapshot: draft.customerSnapshot,
      issuerSnapshot: draft.issuerSnapshot,
      lines: draft.lines,
    });

    const voided = await service.transition(
      admin,
      draft.id,
      "VOID",
      voidedAt,
    );
    expect(voided).toMatchObject({
      status: "VOID",
      number: pending.number,
      paidAt: paidAt.toISOString(),
      voidedAt: voidedAt.toISOString(),
      lines: draft.lines,
    });

    const audits = await database
      .select({
        action: auditEntries.action,
        actorUserId: auditEntries.actorUserId,
        changes: auditEntries.changes,
        createdAt: auditEntries.createdAt,
        entityId: auditEntries.entityId,
        entityType: auditEntries.entityType,
      })
      .from(auditEntries)
      .where(eq(auditEntries.entityId, draft.id))
      .orderBy(asc(auditEntries.createdAt));
    expect(
      audits.map(({ action, actorUserId, changes }) => ({
        action,
        actorUserId,
        changes,
      })),
    ).toEqual([
      {
        action: "INVOICE_STATUS_CHANGED",
        actorUserId: admin.id,
        changes: {
          before: { status: "DRAFT", number: null },
          after: { status: "PENDING_PAYMENT", number: pending.number },
        },
      },
      {
        action: "INVOICE_STATUS_CHANGED",
        actorUserId: billing.id,
        changes: {
          before: { status: "PENDING_PAYMENT", number: pending.number },
          after: { status: "PAID", number: pending.number },
        },
      },
      {
        action: "INVOICE_STATUS_CHANGED",
        actorUserId: admin.id,
        changes: {
          before: { status: "PAID", number: pending.number },
          after: { status: "VOID", number: pending.number },
        },
      },
    ]);
    expect(
      audits.every(
        (audit) =>
          audit.entityId === draft.id &&
          audit.entityType === "INVOICE" &&
          audit.createdAt instanceof Date,
      ),
    ).toBe(true);
    expect(JSON.stringify(audits)).not.toMatch(/password|token|secret/i);
  });

  it("assigns different numbers when two drafts are issued concurrently", async () => {
    const [first, second] = await Promise.all([persistDraft(), persistDraft()]);
    const issued = await Promise.all([
      service.transition(admin, first.id, "PENDING_PAYMENT", issuedAt),
      service.transition(billing, second.id, "PENDING_PAYMENT", issuedAt),
    ]);
    expect(new Set(issued.map(({ number }) => number)).size).toBe(2);
  });

  it("voids an unissued draft without assigning a number", async () => {
    const draft = await persistDraft();
    const voided = await service.transition(
      billing,
      draft.id,
      "VOID",
      issuedAt,
    );
    expect(voided).toMatchObject({
      status: "VOID",
      number: null,
      issuedAt: null,
      voidedAt: issuedAt.toISOString(),
    });
  });

  it("rejects unauthorized and invalid transitions without auditing them", async () => {
    const draft = await persistDraft();
    const customer: AuthenticatedUser = {
      id: customerId,
      email: "invoice-customer@example.com",
      displayName: "Invoice customer",
      role: "CUSTOMER",
    };
    await expect(
      service.transition(customer, draft.id, "VOID", issuedAt),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      service.transition(admin, draft.id, "PAID", issuedAt),
    ).rejects.toMatchObject({ status: 409 });
    expect(
      await database
        .select()
        .from(auditEntries)
        .where(eq(auditEntries.entityId, draft.id)),
    ).toEqual([]);
  });

  it("rolls back the state transition when its audit entry cannot persist", async () => {
    const draft = await persistDraft();
    await expect(
      service.transition(
        { ...admin, id: randomUUID() },
        draft.id,
        "PENDING_PAYMENT",
        issuedAt,
      ),
    ).rejects.toBeDefined();

    const [stored] = await database
      .select({
        status: invoices.status,
        number: invoices.number,
        issuedAt: invoices.issuedAt,
      })
      .from(invoices)
      .where(eq(invoices.id, draft.id));
    expect(stored).toEqual({
      status: "DRAFT",
      number: null,
      issuedAt: null,
    });
  });
});
