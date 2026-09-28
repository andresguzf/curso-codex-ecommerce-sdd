import { Inject, Injectable } from "@nestjs/common";
import { sql, type SQL } from "drizzle-orm";

import { createAuditEntry } from "../audit-observability/audit-entry";
import { DatabaseService } from "../database/database.service";
import { auditEntries, categories, tags } from "../database/schema";
import type {
  ClassificationInput,
  ClassificationKind,
  ClassificationPage,
  ClassificationPatch,
  ClassificationQuery,
  ClassificationRecord,
} from "./classification.types";

type CountRow = { totalItems: number };

@Injectable()
export class ClassificationRepository {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async list(kind: ClassificationKind, query: ClassificationQuery): Promise<ClassificationPage<ClassificationRecord>> {
    const table = this.table(kind);
    const conditions: SQL[] = [sql`${table.deletedAt} is null`];
    if (query.view === "public" || query.status) {
      conditions.push(sql`${table.status} = ${query.view === "public" ? "ACTIVE" : query.status}`);
    }
    if (query.search) {
      const pattern = `%${query.search.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
      conditions.push(kind === "category"
        ? sql`(${table.name} ilike ${pattern} escape '\\' or ${categories.description} ilike ${pattern} escape '\\')`
        : sql`${table.name} ilike ${pattern} escape '\\'`);
    }
    const where = sql.join(conditions, sql` and `);
    const orderColumn = {
      createdAt: table.createdAt,
      updatedAt: table.updatedAt,
      name: table.name,
      slug: table.slug,
      status: table.status,
    }[query.sortBy];
    const direction = query.sortOrder === "asc" ? sql`asc` : sql`desc`;
    const [{ totalItems = 0 } = {}] = (await this.database.client.execute<CountRow>(
      sql`select count(*)::int as "totalItems" from ${table} where ${where}`,
    )).rows;
    const items = (await this.database.client.execute<ClassificationRecord>(
      sql`select id, name, slug, ${kind === "category" ? sql`${categories.description}` : sql`null::text`} as description,
        status, created_at as "createdAt", updated_at as "updatedAt", deleted_at as "deletedAt"
        from ${table} where ${where} order by ${orderColumn} ${direction}, ${table.id} asc
        limit ${query.pageSize} offset ${(query.page - 1) * query.pageSize}`,
    )).rows;
    return { items, page: query.page, pageSize: query.pageSize, totalItems, totalPages: Math.ceil(totalItems / query.pageSize) };
  }

  async find(kind: ClassificationKind, id: string, includeInactive: boolean): Promise<ClassificationRecord | undefined> {
    const table = this.table(kind);
    const rows = (await this.database.client.execute<ClassificationRecord>(
      sql`select id, name, slug, ${kind === "category" ? sql`${categories.description}` : sql`null::text`} as description,
        status, created_at as "createdAt", updated_at as "updatedAt", deleted_at as "deletedAt"
        from ${table} where ${table.id} = ${id} and ${table.deletedAt} is null
        ${includeInactive ? sql`` : sql`and ${table.status} = 'ACTIVE'`} limit 1`,
    )).rows;
    return rows[0];
  }

  async create(kind: ClassificationKind, input: ClassificationInput & { slug: string }, actorUserId: string): Promise<ClassificationRecord> {
    return this.database.client.transaction(async (transaction) => {
      const rows = (await transaction.execute<ClassificationRecord>(
        kind === "category"
          ? sql`insert into ${categories} (name, slug, description, status)
              values (${input.name}, ${input.slug}, ${input.description ?? ""}, ${input.status ?? "ACTIVE"})
              returning id, name, slug, description, status, created_at as "createdAt", updated_at as "updatedAt", deleted_at as "deletedAt"`
          : sql`insert into ${tags} (name, slug, status)
              values (${input.name}, ${input.slug}, ${input.status ?? "ACTIVE"})
              returning id, name, slug, null::text as description, status, created_at as "createdAt", updated_at as "updatedAt", deleted_at as "deletedAt"`,
      )).rows;
      const created = rows[0];
      if (!created) throw new Error("PostgreSQL did not return the created classification");
      await transaction.insert(auditEntries).values(createAuditEntry({
        action: `${kind.toUpperCase()}_CREATED`, actorUserId, entityId: created.id,
        entityType: kind.toUpperCase(), changes: { after: created },
      }));
      return created;
    });
  }

  async update(kind: ClassificationKind, id: string, input: ClassificationPatch, actorUserId: string): Promise<ClassificationRecord | undefined> {
    const table = this.table(kind);
    return this.database.client.transaction(async (transaction) => {
      const previous = (await transaction.execute<ClassificationRecord>(
        sql`select id, name, slug, ${kind === "category" ? sql`${categories.description}` : sql`null::text`} as description,
          status, created_at as "createdAt", updated_at as "updatedAt", deleted_at as "deletedAt"
          from ${table} where ${table.id} = ${id} and ${table.deletedAt} is null for update`,
      )).rows[0];
      if (!previous) return undefined;
      const nextStatus = input.status ?? previous.status;
      const updated = (await transaction.execute<ClassificationRecord>(
        kind === "category"
          ? sql`update ${categories} set name = ${input.name ?? previous.name}, slug = ${input.slug ?? previous.slug},
              description = ${input.description ?? previous.description ?? ""}, status = ${nextStatus}, updated_at = now()
              where id = ${id} returning id, name, slug, description, status, created_at as "createdAt", updated_at as "updatedAt", deleted_at as "deletedAt"`
          : sql`update ${tags} set name = ${input.name ?? previous.name}, slug = ${input.slug ?? previous.slug},
              status = ${nextStatus}, updated_at = now() where id = ${id}
              returning id, name, slug, null::text as description, status, created_at as "createdAt", updated_at as "updatedAt", deleted_at as "deletedAt"`,
      )).rows[0];
      if (!updated) throw new Error("PostgreSQL did not return the updated classification");
      await transaction.insert(auditEntries).values(createAuditEntry({
        action: `${kind.toUpperCase()}_UPDATED`, actorUserId, entityId: id,
        entityType: kind.toUpperCase(), changes: { before: previous, after: updated },
      }));
      return updated;
    });
  }

  async softDelete(kind: ClassificationKind, id: string, actorUserId: string): Promise<boolean> {
    const table = this.table(kind);
    return this.database.client.transaction(async (transaction) => {
      const previous = (await transaction.execute<ClassificationRecord>(
        sql`select id, name, slug, ${kind === "category" ? sql`${categories.description}` : sql`null::text`} as description,
          status, created_at as "createdAt", updated_at as "updatedAt", deleted_at as "deletedAt"
          from ${table} where ${table.id} = ${id} and ${table.deletedAt} is null for update`,
      )).rows[0];
      if (!previous) return false;
      await transaction.execute(sql`update ${table} set status = 'INACTIVE', deleted_at = now(), updated_at = now() where ${table.id} = ${id}`);
      await transaction.insert(auditEntries).values(createAuditEntry({
        action: `${kind.toUpperCase()}_DELETED`, actorUserId, entityId: id,
        entityType: kind.toUpperCase(), changes: { before: previous, after: { ...previous, status: "INACTIVE", deleted: true } },
      }));
      return true;
    });
  }

  private table(kind: ClassificationKind): typeof categories | typeof tags {
    return kind === "category" ? categories : tags;
  }
}
