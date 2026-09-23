import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
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
export const classificationStatus = pgEnum("classification_status", ["ACTIVE", "INACTIVE"]);

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 200 }).notNull(),
    slug: varchar("slug", { length: 220 }).notNull(),
    description: text("description").notNull().default(""),
    status: classificationStatus("status").notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("categories_name_unique").on(sql`upper(${table.name})`),
    uniqueIndex("categories_slug_unique").on(table.slug),
    index("categories_status_name_idx").on(table.status, table.name),
    check("categories_name_not_blank", sql`btrim(${table.name}) <> ''`),
    check("categories_slug_format", sql`${table.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
    check("categories_deleted_status_consistent", sql`${table.deletedAt} is null or ${table.status} = 'INACTIVE'`),
  ],
);

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 120 }).notNull(),
    slug: varchar("slug", { length: 140 }).notNull(),
    status: classificationStatus("status").notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("tags_name_unique").on(sql`upper(${table.name})`),
    uniqueIndex("tags_slug_unique").on(table.slug),
    index("tags_status_name_idx").on(table.status, table.name),
    check("tags_name_not_blank", sql`btrim(${table.name}) <> ''`),
    check("tags_slug_format", sql`${table.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
    check("tags_deleted_status_consistent", sql`${table.deletedAt} is null or ${table.status} = 'INACTIVE'`),
  ],
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sku: varchar("sku", { length: 64 }).notNull(),
    slug: varchar("slug", { length: 220 }),
    categoryId: uuid("category_id").references(() => categories.id),
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description").notNull(),
    price: numeric("price", { precision: 12, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),
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
    uniqueIndex("products_slug_unique").on(table.slug),
    index("products_category_idx").on(table.categoryId),
    index("products_status_idx").on(table.status),
    index("products_created_at_idx").on(table.createdAt),
    check("products_sku_not_blank", sql`btrim(${table.sku}) <> ''`),
    check("products_name_not_blank", sql`btrim(${table.name}) <> ''`),
    check("products_slug_format", sql`${table.slug} is null or ${table.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
    check(
      "products_description_not_blank",
      sql`btrim(${table.description}) <> ''`,
    ),
    check("products_price_non_negative", sql`${table.price} >= 0`),
    check(
      "products_currency_usd_only",
      sql`${table.currency} = 'USD'`,
    ),
    check(
      "products_deleted_status_consistent",
      sql`${table.deletedAt} is null or ${table.status} = 'INACTIVE'`,
    ),
  ],
);

export const productTags = pgTable(
  "product_tags",
  {
    productId: uuid("product_id").notNull().references(() => products.id),
    tagId: uuid("tag_id").notNull().references(() => tags.id),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [
    uniqueIndex("product_tags_product_tag_unique").on(table.productId, table.tagId),
    index("product_tags_tag_product_idx").on(table.tagId, table.productId),
    check("product_tags_sort_order_non_negative", sql`${table.sortOrder} >= 0`),
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
export type Category = typeof categories.$inferSelect;
export type Tag = typeof tags.$inferSelect;
