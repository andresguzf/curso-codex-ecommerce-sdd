import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { products } from "./catalog";
import { users } from "./identity";

export const inventoryMovementType = pgEnum("inventory_movement_type", [
  "OPENING",
  "ADJUSTMENT",
  "SALE",
  "CANCELLATION",
]);

export const inventoryBalances = pgTable(
  "inventory_balances",
  {
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    availableQuantity: integer("available_quantity").notNull().default(0),
    version: integer("version").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ name: "inventory_balances_pkey", columns: [table.productId] }),
    index("inventory_balances_quantity_idx").on(table.availableQuantity),
    check(
      "inventory_balances_quantity_non_negative",
      sql`${table.availableQuantity} >= 0`,
    ),
    check(
      "inventory_balances_version_non_negative",
      sql`${table.version} >= 0`,
    ),
  ],
);

export const inventoryMovements = pgTable(
  "inventory_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    type: inventoryMovementType("type").notNull(),
    quantityDelta: integer("quantity_delta").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    reason: varchar("reason", { length: 500 }).notNull(),
    referenceType: varchar("reference_type", { length: 100 }),
    referenceId: varchar("reference_id", { length: 128 }),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("inventory_movements_product_created_idx").on(
      table.productId,
      table.createdAt,
    ),
    index("inventory_movements_actor_idx").on(table.actorUserId),
    index("inventory_movements_reference_idx").on(
      table.referenceType,
      table.referenceId,
    ),
    check(
      "inventory_movements_quantity_non_zero",
      sql`${table.quantityDelta} <> 0`,
    ),
    check(
      "inventory_movements_balance_non_negative",
      sql`${table.balanceAfter} >= 0`,
    ),
    check(
      "inventory_movements_reason_not_blank",
      sql`btrim(${table.reason}) <> ''`,
    ),
    check(
      "inventory_movements_reference_consistent",
      sql`(${table.referenceType} is null and ${table.referenceId} is null)
        or (${table.referenceType} is not null and ${table.referenceId} is not null)`,
    ),
  ],
);

export type InventoryBalance = typeof inventoryBalances.$inferSelect;
export type NewInventoryBalance = typeof inventoryBalances.$inferInsert;
export type InventoryMovement = typeof inventoryMovements.$inferSelect;
export type NewInventoryMovement = typeof inventoryMovements.$inferInsert;
