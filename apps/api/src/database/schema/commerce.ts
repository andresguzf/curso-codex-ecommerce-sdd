import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { products } from "./catalog";
import { users } from "./identity";

type JsonObject = Readonly<Record<string, unknown>>;

export const cartStatus = pgEnum("cart_status", [
  "ACTIVE",
  "CHECKED_OUT",
  "ABANDONED",
]);

export const orderStatus = pgEnum("order_status", [
  "PROCESSING",
  "INVOICED",
  "COMPLETED",
  "CANCELLED",
]);

export const paymentStatus = pgEnum("payment_status", [
  "PENDING",
  "APPROVED",
  "REJECTED",
]);

export const idempotencyStatus = pgEnum("idempotency_status", [
  "IN_PROGRESS",
  "COMPLETED",
  "FAILED",
]);

export const carts = pgTable(
  "carts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    status: cartStatus("status").notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("carts_customer_active_unique")
      .on(table.customerId)
      .where(sql`${table.status} = 'ACTIVE'`),
    index("carts_customer_status_idx").on(table.customerId, table.status),
    check(
      "carts_closed_at_consistent",
      sql`(${table.status} = 'ACTIVE' and ${table.closedAt} is null)
        or (${table.status} <> 'ACTIVE' and ${table.closedAt} is not null)`,
    ),
  ],
);

export const cartItems = pgTable(
  "cart_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cartId: uuid("cart_id")
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("cart_items_cart_product_unique").on(
      table.cartId,
      table.productId,
    ),
    index("cart_items_product_idx").on(table.productId),
    check("cart_items_quantity_positive", sql`${table.quantity} > 0`),
  ],
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    number: varchar("number", { length: 64 }).notNull(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    status: orderStatus("status").notNull().default("PROCESSING"),
    currency: varchar("currency", { length: 3 }).notNull(),
    subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull(),
    shippingTotal: numeric("shipping_total", { precision: 14, scale: 2 })
      .notNull()
      .default("0.00"),
    taxTotal: numeric("tax_total", { precision: 14, scale: 2 })
      .notNull()
      .default("0.00"),
    total: numeric("total", { precision: 14, scale: 2 }).notNull(),
    customerSnapshot: jsonb("customer_snapshot").$type<JsonObject>().notNull(),
    shippingAddressSnapshot: jsonb("shipping_address_snapshot")
      .$type<JsonObject>()
      .notNull(),
    shippingMethodSnapshot: jsonb("shipping_method_snapshot")
      .$type<JsonObject>()
      .notNull(),
    paymentSnapshot: jsonb("payment_snapshot").$type<JsonObject>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("orders_number_unique").on(table.number),
    index("orders_customer_created_idx").on(table.customerId, table.createdAt),
    index("orders_status_created_idx").on(table.status, table.createdAt),
    check("orders_number_not_blank", sql`btrim(${table.number}) <> ''`),
    check("orders_currency_iso_format", sql`${table.currency} ~ '^[A-Z]{3}$'`),
    check("orders_subtotal_non_negative", sql`${table.subtotal} >= 0`),
    check(
      "orders_shipping_total_non_negative",
      sql`${table.shippingTotal} >= 0`,
    ),
    check("orders_tax_total_non_negative", sql`${table.taxTotal} >= 0`),
    check("orders_total_non_negative", sql`${table.total} >= 0`),
    check(
      "orders_total_consistent",
      sql`${table.total} = ${table.subtotal} + ${table.shippingTotal} + ${table.taxTotal}`,
    ),
    check(
      "orders_customer_snapshot_is_object",
      sql`jsonb_typeof(${table.customerSnapshot}) = 'object'`,
    ),
    check(
      "orders_shipping_address_snapshot_is_object",
      sql`jsonb_typeof(${table.shippingAddressSnapshot}) = 'object'`,
    ),
    check(
      "orders_shipping_method_snapshot_is_object",
      sql`jsonb_typeof(${table.shippingMethodSnapshot}) = 'object'`,
    ),
    check(
      "orders_payment_snapshot_is_object",
      sql`jsonb_typeof(${table.paymentSnapshot}) = 'object'`,
    ),
    check(
      "orders_cancellation_consistent",
      sql`(${table.status} = 'CANCELLED') = (${table.cancelledAt} is not null)`,
    ),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    skuSnapshot: varchar("sku_snapshot", { length: 64 }).notNull(),
    nameSnapshot: varchar("name_snapshot", { length: 200 }).notNull(),
    quantity: integer("quantity").notNull(),
    unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull(),
    taxAmount: numeric("tax_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0.00"),
    lineTotal: numeric("line_total", { precision: 14, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("order_items_order_product_unique").on(
      table.orderId,
      table.productId,
    ),
    index("order_items_product_idx").on(table.productId),
    check(
      "order_items_sku_snapshot_not_blank",
      sql`btrim(${table.skuSnapshot}) <> ''`,
    ),
    check(
      "order_items_name_snapshot_not_blank",
      sql`btrim(${table.nameSnapshot}) <> ''`,
    ),
    check("order_items_quantity_positive", sql`${table.quantity} > 0`),
    check("order_items_unit_price_non_negative", sql`${table.unitPrice} >= 0`),
    check("order_items_tax_amount_non_negative", sql`${table.taxAmount} >= 0`),
    check("order_items_line_total_non_negative", sql`${table.lineTotal} >= 0`),
    check(
      "order_items_line_total_consistent",
      sql`${table.lineTotal} = (${table.unitPrice} * ${table.quantity}) + ${table.taxAmount}`,
    ),
    check(
      "order_items_currency_iso_format",
      sql`${table.currency} ~ '^[A-Z]{3}$'`,
    ),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    status: paymentStatus("status").notNull().default("PENDING"),
    method: varchar("method", { length: 100 }).notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    providerReference: varchar("provider_reference", { length: 255 }),
    resultSnapshot: jsonb("result_snapshot").$type<JsonObject>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("payments_order_unique").on(table.orderId),
    index("payments_status_created_idx").on(table.status, table.createdAt),
    check("payments_method_not_blank", sql`btrim(${table.method}) <> ''`),
    check("payments_amount_non_negative", sql`${table.amount} >= 0`),
    check(
      "payments_currency_iso_format",
      sql`${table.currency} ~ '^[A-Z]{3}$'`,
    ),
    check(
      "payments_result_snapshot_is_object",
      sql`jsonb_typeof(${table.resultSnapshot}) = 'object'`,
    ),
    check(
      "payments_processed_at_consistent",
      sql`(${table.status} = 'PENDING' and ${table.processedAt} is null)
        or (${table.status} <> 'PENDING' and ${table.processedAt} is not null)`,
    ),
  ],
);

export const idempotencyRecords = pgTable(
  "idempotency_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    scope: varchar("scope", { length: 100 }).notNull(),
    keyHash: varchar("key_hash", { length: 128 }).notNull(),
    requestHash: varchar("request_hash", { length: 128 }).notNull(),
    status: idempotencyStatus("status").notNull().default("IN_PROGRESS"),
    responseSnapshot: jsonb("response_snapshot").$type<JsonObject>(),
    orderId: uuid("order_id").references(() => orders.id, {
      onDelete: "restrict",
    }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("idempotency_records_key_unique").on(
      table.customerId,
      table.scope,
      table.keyHash,
    ),
    index("idempotency_records_expires_at_idx").on(table.expiresAt),
    index("idempotency_records_order_idx").on(table.orderId),
    check("idempotency_records_scope_not_blank", sql`btrim(${table.scope}) <> ''`),
    check(
      "idempotency_records_key_hash_not_blank",
      sql`btrim(${table.keyHash}) <> ''`,
    ),
    check(
      "idempotency_records_request_hash_not_blank",
      sql`btrim(${table.requestHash}) <> ''`,
    ),
    check(
      "idempotency_records_response_snapshot_is_object",
      sql`${table.responseSnapshot} is null or jsonb_typeof(${table.responseSnapshot}) = 'object'`,
    ),
    check(
      "idempotency_records_expiry_after_creation",
      sql`${table.expiresAt} > ${table.createdAt}`,
    ),
  ],
);

export type Cart = typeof carts.$inferSelect;
export type NewCart = typeof carts.$inferInsert;
export type CartItem = typeof cartItems.$inferSelect;
export type NewCartItem = typeof cartItems.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;
export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
export type IdempotencyRecord = typeof idempotencyRecords.$inferSelect;
export type NewIdempotencyRecord = typeof idempotencyRecords.$inferInsert;
