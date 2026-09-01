import { sql } from "drizzle-orm";
import {
  check,
  index,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { users } from "./identity";

export const auditEntries = pgTable(
  "audit_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: varchar("action", { length: 100 }).notNull(),
    entityType: varchar("entity_type", { length: 100 }).notNull(),
    entityId: varchar("entity_id", { length: 128 }).notNull(),
    changes: jsonb("changes")
      .$type<Readonly<Record<string, unknown>>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    correlationId: uuid("correlation_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("audit_entries_actor_idx").on(table.actorUserId),
    index("audit_entries_entity_idx").on(table.entityType, table.entityId),
    index("audit_entries_created_at_idx").on(table.createdAt),
    index("audit_entries_correlation_idx").on(table.correlationId),
    check("audit_entries_action_not_blank", sql`btrim(${table.action}) <> ''`),
    check(
      "audit_entries_entity_type_not_blank",
      sql`btrim(${table.entityType}) <> ''`,
    ),
    check(
      "audit_entries_entity_id_not_blank",
      sql`btrim(${table.entityId}) <> ''`,
    ),
    check(
      "audit_entries_changes_is_object",
      sql`jsonb_typeof(${table.changes}) = 'object'`,
    ),
  ],
);

export type AuditEntry = typeof auditEntries.$inferSelect;
export type NewAuditEntry = typeof auditEntries.$inferInsert;
