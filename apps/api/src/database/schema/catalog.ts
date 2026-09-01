import { sql } from "drizzle-orm";
import {
  check,
  index,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const productStatus = pgEnum("product_status", ["ACTIVE", "INACTIVE"]);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sku: varchar("sku", { length: 64 }).notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description").notNull(),
    price: numeric("price", { precision: 12, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    status: productStatus("status").notNull().default("INACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("products_sku_unique").on(sql`upper(${table.sku})`),
    index("products_status_idx").on(table.status),
    index("products_created_at_idx").on(table.createdAt),
    check("products_sku_not_blank", sql`btrim(${table.sku}) <> ''`),
    check("products_name_not_blank", sql`btrim(${table.name}) <> ''`),
    check(
      "products_description_not_blank",
      sql`btrim(${table.description}) <> ''`,
    ),
    check("products_price_non_negative", sql`${table.price} >= 0`),
    check(
      "products_currency_iso_format",
      sql`${table.currency} ~ '^[A-Z]{3}$'`,
    ),
    check(
      "products_deleted_status_consistent",
      sql`${table.deletedAt} is null or ${table.status} = 'INACTIVE'`,
    ),
  ],
);

export const productImages = pgTable(
  "product_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    storageKey: varchar("storage_key", { length: 512 }).notNull(),
    url: text("url").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("product_images_product_unique").on(table.productId),
    uniqueIndex("product_images_storage_key_unique").on(table.storageKey),
    check(
      "product_images_storage_key_not_blank",
      sql`btrim(${table.storageKey}) <> ''`,
    ),
    check("product_images_url_not_blank", sql`btrim(${table.url}) <> ''`),
  ],
);

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type ProductImage = typeof productImages.$inferSelect;
export type NewProductImage = typeof productImages.$inferInsert;
