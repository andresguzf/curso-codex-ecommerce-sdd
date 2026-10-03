import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

// No bytes, credentials, or remote error payloads belong in this journal.
export const catalogImageOperations = pgTable("catalog_image_operations", {
  id: uuid("id").primaryKey(),
  cloudName: varchar("cloud_name", { length: 100 }).notNull(),
  storageKey: varchar("storage_key", { length: 512 }),
  state: varchar("state", { length: 16 }).$type<"UPLOADING" | "CONFIRMED" | "PENDING" | "DONE" | "BLOCKED">().notNull(),
  attempts: integer("attempts").notNull().default(0),
  nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("catalog_image_operations_due_idx").on(table.state, table.nextAttemptAt),
  check("catalog_image_operations_state", sql`${table.state} in ('UPLOADING','CONFIRMED','PENDING','DONE','BLOCKED')`),
  check("catalog_image_operations_attempts", sql`${table.attempts} between 0 and 8`),
]);
