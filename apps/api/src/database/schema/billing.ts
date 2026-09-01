import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { products } from "./catalog";
import { orders } from "./commerce";
import { users } from "./identity";

type JsonObject = Readonly<Record<string, unknown>>;

export const invoiceOrigin = pgEnum("invoice_origin", ["MANUAL", "ORDER"]);

export const invoiceStatus = pgEnum("invoice_status", [
  "DRAFT",
  "PENDING_PAYMENT",
  "PAID",
  "VOID",
]);

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    number: varchar("number", { length: 64 }),
    origin: invoiceOrigin("origin").notNull(),
    status: invoiceStatus("status").notNull().default("DRAFT"),
    orderId: uuid("order_id").references(() => orders.id, {
      onDelete: "restrict",
    }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    currency: varchar("currency", { length: 3 }).notNull(),
    subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull(),
    shippingTotal: numeric("shipping_total", { precision: 14, scale: 2 })
      .notNull()
      .default("0.00"),
    taxTotal: numeric("tax_total", { precision: 14, scale: 2 })
      .notNull()
      .default("0.00"),
    total: numeric("total", { precision: 14, scale: 2 }).notNull(),
    issuerSnapshot: jsonb("issuer_snapshot").$type<JsonObject>().notNull(),
    customerSnapshot: jsonb("customer_snapshot").$type<JsonObject>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    issuedAt: timestamp("issued_at", { withTimezone: true }),
    dueAt: timestamp("due_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("invoices_number_unique")
      .on(table.number)
      .where(sql`${table.number} is not null`),
    uniqueIndex("invoices_active_order_unique")
      .on(table.orderId)
      .where(sql`${table.orderId} is not null and ${table.status} <> 'VOID'`),
    index("invoices_customer_created_idx").on(
      table.customerId,
      table.createdAt,
    ),
    index("invoices_status_created_idx").on(table.status, table.createdAt),
    index("invoices_origin_created_idx").on(table.origin, table.createdAt),
    index("invoices_created_by_idx").on(table.createdByUserId),
    check(
      "invoices_number_not_blank",
      sql`${table.number} is null or btrim(${table.number}) <> ''`,
    ),
    check(
      "invoices_origin_order_consistent",
      sql`(${table.origin} = 'MANUAL' and ${table.orderId} is null)
        or (${table.origin} = 'ORDER' and ${table.orderId} is not null)`,
    ),
    check(
      "invoices_numbering_state_consistent",
      sql`(${table.status} = 'DRAFT' and ${table.number} is null and ${table.issuedAt} is null)
        or (${table.status} in ('PENDING_PAYMENT', 'PAID') and ${table.number} is not null and ${table.issuedAt} is not null)
        or (${table.status} = 'VOID' and ((${table.number} is null and ${table.issuedAt} is null)
          or (${table.number} is not null and ${table.issuedAt} is not null)))`,
    ),
    check(
      "invoices_voided_at_consistent",
      sql`(${table.status} = 'VOID') = (${table.voidedAt} is not null)`,
    ),
    check(
      "invoices_paid_at_consistent",
      sql`(${table.status} = 'PAID' and ${table.paidAt} is not null)
        or (${table.status} in ('DRAFT', 'PENDING_PAYMENT') and ${table.paidAt} is null)
        or ${table.status} = 'VOID'`,
    ),
    check(
      "invoices_issued_after_creation",
      sql`${table.issuedAt} is null or ${table.issuedAt} >= ${table.createdAt}`,
    ),
    check(
      "invoices_due_after_issue",
      sql`${table.dueAt} is null or (${table.issuedAt} is not null and ${table.dueAt} >= ${table.issuedAt})`,
    ),
    check(
      "invoices_paid_after_issue",
      sql`${table.paidAt} is null or (${table.issuedAt} is not null and ${table.paidAt} >= ${table.issuedAt})`,
    ),
    check("invoices_currency_iso_format", sql`${table.currency} ~ '^[A-Z]{3}$'`),
    check("invoices_subtotal_non_negative", sql`${table.subtotal} >= 0`),
    check(
      "invoices_shipping_total_non_negative",
      sql`${table.shippingTotal} >= 0`,
    ),
    check("invoices_tax_total_non_negative", sql`${table.taxTotal} >= 0`),
    check("invoices_total_non_negative", sql`${table.total} >= 0`),
    check(
      "invoices_total_consistent",
      sql`${table.total} = ${table.subtotal} + ${table.shippingTotal} + ${table.taxTotal}`,
    ),
    check(
      "invoices_issuer_snapshot_is_object",
      sql`jsonb_typeof(${table.issuerSnapshot}) = 'object'`,
    ),
    check(
      "invoices_customer_snapshot_is_object",
      sql`jsonb_typeof(${table.customerSnapshot}) = 'object'`,
    ),
  ],
);

export const invoiceLines = pgTable(
  "invoice_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "restrict",
    }),
    position: integer("position").notNull(),
    skuSnapshot: varchar("sku_snapshot", { length: 64 }),
    nameSnapshot: varchar("name_snapshot", { length: 200 }).notNull(),
    descriptionSnapshot: text("description_snapshot").notNull(),
    quantity: integer("quantity").notNull(),
    unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull(),
    taxRate: numeric("tax_rate", { precision: 7, scale: 4 })
      .notNull()
      .default("0.0000"),
    taxAmount: numeric("tax_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0.00"),
    lineSubtotal: numeric("line_subtotal", { precision: 14, scale: 2 })
      .notNull(),
    lineTotal: numeric("line_total", { precision: 14, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("invoice_lines_invoice_position_unique").on(
      table.invoiceId,
      table.position,
    ),
    index("invoice_lines_product_idx").on(table.productId),
    check("invoice_lines_position_positive", sql`${table.position} > 0`),
    check(
      "invoice_lines_sku_snapshot_not_blank",
      sql`${table.skuSnapshot} is null or btrim(${table.skuSnapshot}) <> ''`,
    ),
    check(
      "invoice_lines_name_snapshot_not_blank",
      sql`btrim(${table.nameSnapshot}) <> ''`,
    ),
    check(
      "invoice_lines_description_snapshot_not_blank",
      sql`btrim(${table.descriptionSnapshot}) <> ''`,
    ),
    check("invoice_lines_quantity_positive", sql`${table.quantity} > 0`),
    check(
      "invoice_lines_unit_price_non_negative",
      sql`${table.unitPrice} >= 0`,
    ),
    check(
      "invoice_lines_tax_rate_valid",
      sql`${table.taxRate} >= 0 and ${table.taxRate} <= 100`,
    ),
    check(
      "invoice_lines_tax_amount_non_negative",
      sql`${table.taxAmount} >= 0`,
    ),
    check(
      "invoice_lines_subtotal_consistent",
      sql`${table.lineSubtotal} = ${table.unitPrice} * ${table.quantity}`,
    ),
    check(
      "invoice_lines_total_consistent",
      sql`${table.lineTotal} = ${table.lineSubtotal} + ${table.taxAmount}`,
    ),
    check(
      "invoice_lines_currency_iso_format",
      sql`${table.currency} ~ '^[A-Z]{3}$'`,
    ),
  ],
);

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type InvoiceLine = typeof invoiceLines.$inferSelect;
export type NewInvoiceLine = typeof invoiceLines.$inferInsert;
