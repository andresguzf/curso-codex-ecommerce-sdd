import { createHash, randomUUID } from "node:crypto";
import { resolve } from "node:path";

import "dotenv/config";
import { eq } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { InvoiceFromOrderService } from "../../src/billing-invoicing/invoice-from-order.service";
import { ManualInvoiceService } from "../../src/billing-invoicing/manual-invoice.service";
import { StoreProfileService } from "../../src/billing-invoicing/store-profile.service";
import { currentIssuerSnapshot } from "../../src/billing-invoicing/issuer-snapshot";
import { DocumentExportService } from "../../src/document-export/document-export.service";
import { SimplePdfAdapter } from "../../src/document-export/simple-pdf.adapter";
import type { DatabaseService } from "../../src/database/database.service";
import { invoices, orders, payments, products, roleAssignments, storeLogoAssets, users } from "../../src/database/schema";
import * as schema from "../../src/database/schema";
import type { AuthenticatedUser } from "../../src/identity-access/auth.types";
import { CustomerOrdersService } from "../../src/order-management/customer-orders.service";
import { OrderService } from "../../src/order-management/order.service";
import type { ImageStorageService } from "../../src/product-catalog/image-storage/image-storage.service";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for issuer snapshot integration tests");
const databaseName = `ecommerce_issuer_snapshot_${randomUUID().replaceAll("-", "")}`;
if (!/^ecommerce_issuer_snapshot_[a-f0-9]{32}$/.test(databaseName)) throw new Error("Unsafe test database name");
const maintenanceUrl = new URL(databaseUrl);
maintenanceUrl.pathname = "/postgres";
const isolatedUrl = new URL(databaseUrl);
isolatedUrl.pathname = `/${databaseName}`;
const quotedName = `"${databaseName}"`;

let maintenancePool: Pool | undefined;
let testPool: Pool | undefined;
let database: NodePgDatabase<typeof schema>;
let created = false;
let admin: AuthenticatedUser;
let customer: AuthenticatedUser;
let productId: string;

function dbService(): DatabaseService {
  return { client: database } as DatabaseService;
}

describe("historical issuer snapshots", () => {
  beforeAll(async () => {
    maintenancePool = new Pool({ connectionString: maintenanceUrl.toString(), max: 1 });
    await maintenancePool.query(`create database ${quotedName} template template0`);
    created = true;
    testPool = new Pool({ connectionString: isolatedUrl.toString(), max: 4 });
    database = drizzle({ client: testPool, schema });
    await migrate(database, { migrationsFolder: resolve("src/database/migrations"), migrationsSchema: "drizzle", migrationsTable: "__drizzle_migrations" });
    const [adminRow, customerRow] = await database.insert(users).values([
      { email: "admin@example.com", displayName: "Admin", passwordHash: "test-hash" },
      { email: "customer@example.com", displayName: "Customer", passwordHash: "test-hash" },
    ]).returning();
    if (!adminRow || !customerRow) throw new Error("User fixtures missing");
    admin = { id: adminRow.id, email: adminRow.email, displayName: adminRow.displayName, role: "ADMIN" };
    customer = { id: customerRow.id, email: customerRow.email, displayName: customerRow.displayName, role: "CUSTOMER" };
    await database.insert(roleAssignments).values({ userId: customer.id, role: "CUSTOMER" });
    const [product] = await database.insert(products).values({
      sku: "ISSUER-TEST", name: "Teclado", description: "Teclado de prueba", price: "100.00", currency: "USD", status: "ACTIVE",
    }).returning();
    if (!product) throw new Error("Product fixture missing");
    productId = product.id;
  }, 30_000);

  afterAll(async () => {
    await testPool?.end();
    if (maintenancePool && created) {
      await maintenancePool.query("select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()", [databaseName]);
      await maintenancePool.query(`drop database ${quotedName}`);
    }
    await maintenancePool?.end();
  }, 30_000);

  it("preserves the confirmed order issuer, reuses it for its invoice, and captures the updated issuer for a manual invoice", async () => {
    const profile = new StoreProfileService(dbService());
    const orderService = new OrderService();
    const orderQuery = new CustomerOrdersService(dbService());
    const fromOrder = new InvoiceFromOrderService(dbService());
    const manual = new ManualInvoiceService(dbService());

    await expect(database.transaction((transaction) => currentIssuerSnapshot(transaction)))
      .rejects.toMatchObject({ response: { code: "STORE_PROFILE_NOT_CONFIGURED" } });

    const logoData = await sharp({ create: { width: 40, height: 20, channels: 3, background: "#164a83" } }).png().toBuffer();
    const logoSha = createHash("sha256").update(logoData).digest("hex");
    await database.insert(storeLogoAssets).values({ storageKey: "managed-logo.png", url: "http://localhost:3001/api/v1/media/images/managed-logo.png", mimeType: "image/png", size: logoData.length, sha256: logoSha });
    const documents = new DocumentExportService(new SimplePdfAdapter(), {
      read: async () => ({ data: logoData, mimeType: "image/png" }),
    } as unknown as ImageStorageService);
    await profile.update(admin, {
      tradeName: "Nexo Original", legalName: "Nexo Original SpA", taxIdentifier: "TAX-OLD",
      address: { line1: "Calle Antigua 1", city: "Santiago", countryCode: "CL" },
      contact: { email: "old@example.com" },
      logo: { storageKey: "managed-logo.png" },
    });
    const confirmed = await database.transaction(async (transaction) => {
      const issuerSnapshot = await currentIssuerSnapshot(transaction);
      const order = await orderService.createInTransaction(transaction, {
        customerId: customer.id,
        customerSnapshot: { id: customer.id, displayName: customer.displayName, email: customer.email },
        issuerSnapshot,
        shippingAddressSnapshot: { line1: "Cliente 123" },
        shippingMethodSnapshot: { method: "STANDARD" },
        paymentSnapshot: { status: "APPROVED", method: "SIMULATED_CARD_APPROVED" },
        currency: "USD", subtotal: "100.00", shippingTotal: "0.00", taxTotal: "0.00", total: "100.00",
        items: [{ productId, sku: "ISSUER-TEST", name: "Teclado", quantity: 1, unitPrice: "100.00", taxAmount: "0.00", lineTotal: "100.00", currency: "USD" }],
      }, new Date());
      await transaction.insert(payments).values({
        orderId: order.snapshot.id, status: "APPROVED", method: "SIMULATED_CARD_APPROVED", amount: "100.00",
        currency: "USD", resultSnapshot: { status: "APPROVED" }, processedAt: new Date(),
      });
      return order.snapshot;
    });
    expect(confirmed.issuerSnapshot?.legalName).toBe("Nexo Original SpA");
    expect(confirmed.issuerSnapshot?.logo).toMatchObject({ storageKey: "managed-logo.png", sha256: logoSha });
    const orderPdfBefore = await documents.renderOrder(confirmed);

    await profile.update(admin, {
      tradeName: "Nexo Nueva", legalName: "Nexo Nueva SpA", taxIdentifier: "TAX-NEW",
      address: { line1: "Calle Nueva 2" }, logo: null,
    });
    const persistedOrder = await orderQuery.detail(customer, confirmed.id);
    expect(persistedOrder.issuerSnapshot).toEqual(confirmed.issuerSnapshot);
    expect((await documents.renderOrder(confirmed)).equals(orderPdfBefore)).toBe(true);
    expect(orderPdfBefore.toString("latin1")).toContain("/Subtype /Image");
    const issued = await fromOrder.convert(admin, confirmed.id);
    expect(issued.issuerSnapshot).toEqual(confirmed.issuerSnapshot);
    expect((await documents.renderInvoice(issued)).toString("latin1")).toContain("/Subtype /Image");
    const [storedOrder, storedInvoice] = await Promise.all([
      database.select({ issuerSnapshot: orders.issuerSnapshot }).from(orders).where(eq(orders.id, confirmed.id)),
      database.select({ issuerSnapshot: invoices.issuerSnapshot }).from(invoices).where(eq(invoices.id, issued.id)),
    ]);
    expect(storedOrder[0]?.issuerSnapshot).toEqual(confirmed.issuerSnapshot);
    expect(storedInvoice[0]?.issuerSnapshot).toEqual(confirmed.issuerSnapshot);

    const manualInvoice = await manual.create(admin, {
      customerId: customer.id, shippingTotal: "0.00",
      lines: [{ productId: null, sku: "SERVICE", name: "Servicio", description: "Servicio técnico", quantity: 1, unitPrice: "25.00", taxRate: "0.0000" }],
    });
    expect(manualInvoice.issuerSnapshot).toMatchObject({ tradeName: "Nexo Nueva", legalName: "Nexo Nueva SpA", taxIdentifier: "TAX-NEW", address: { line1: "Calle Nueva 2" }, logo: null });
    expect((await orderQuery.detail(customer, confirmed.id)).issuerSnapshot).toEqual(confirmed.issuerSnapshot);
  }, 30_000);
});
