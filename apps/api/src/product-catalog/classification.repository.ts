import { BadRequestException, ConflictException, Inject, Injectable } from "@nestjs/common";
import { eq, sql, type SQL } from "drizzle-orm";

import { createAuditEntry } from "../audit-observability/audit-entry.js";
import { DatabaseService } from "../database/database.service.js";
import { auditEntries, categories, tags } from "../database/schema/index.js";
import type {
  ClassificationInput,
  ClassificationKind,
  ClassificationPage,
  ClassificationPatch,
  ClassificationQuery,
  ClassificationRecord,
} from "./classification.types.js";

type CountRow = { totalItems: number };
type RawClassificationRecord = Omit<ClassificationRecord, "createdAt" | "updatedAt" | "deletedAt"> & {
  createdAt: string | Date;
  updatedAt: string | Date;
  deletedAt: string | Date | null;
};

function normalizeRecord(row: RawClassificationRecord): ClassificationRecord {
  return {
    ...row,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
    deletedAt: row.deletedAt === null ? null : new Date(row.deletedAt),
  };
}

@Injectable()
export class ClassificationRepository {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async list(kind: ClassificationKind, query: ClassificationQuery): Promise<ClassificationPage<ClassificationRecord>> {
    const table = this.table(kind);
    const conditions: SQL[] = [sql`${table.deletedAt} is null`];
    if (kind === "category" && query.showOnLanding !== undefined) {
      conditions.push(sql`${categories.showOnLanding} = ${query.showOnLanding}`);
    }
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
    const items = (await this.database.client.execute<RawClassificationRecord>(
      sql`select id, name, slug, ${kind === "category" ? sql`${categories.description}` : sql`null::text`} as description,
        status, created_at as "createdAt", updated_at as "updatedAt", deleted_at as "deletedAt" ${this.editorialProjection(kind)}
        from ${table} where ${where} order by ${orderColumn} ${direction}, ${table.id} asc
        limit ${query.pageSize} offset ${(query.page - 1) * query.pageSize}`,
    )).rows.map(normalizeRecord);
    return { items, page: query.page, pageSize: query.pageSize, totalItems, totalPages: Math.ceil(totalItems / query.pageSize) };
  }

  async find(kind: ClassificationKind, id: string, includeInactive: boolean): Promise<ClassificationRecord | undefined> {
    const table = this.table(kind);
    const rows = (await this.database.client.execute<RawClassificationRecord>(
      sql`select id, name, slug, ${kind === "category" ? sql`${categories.description}` : sql`null::text`} as description,
        status, created_at as "createdAt", updated_at as "updatedAt", deleted_at as "deletedAt" ${this.editorialProjection(kind)}
        from ${table} where ${table.id} = ${id} and ${table.deletedAt} is null
        ${includeInactive ? sql`` : sql`and ${table.status} = 'ACTIVE'`} limit 1`,
    )).rows;
    return rows[0] ? normalizeRecord(rows[0]) : undefined;
  }

  async create(kind: ClassificationKind, input: ClassificationInput & { slug: string }, actorUserId: string): Promise<ClassificationRecord> {
    return this.database.client.transaction(async (transaction) => {
      const rows = (await transaction.execute<RawClassificationRecord>(
        kind === "category"
          ? sql`insert into ${categories} (name, slug, description, status)
              values (${input.name}, ${input.slug}, ${input.description ?? ""}, ${input.status ?? "ACTIVE"})
              returning id, name, slug, description, status, created_at as "createdAt", updated_at as "updatedAt", deleted_at as "deletedAt", show_on_landing as "showOnLanding", landing_order as "landingOrder"`
          : sql`insert into ${tags} (name, slug, status)
              values (${input.name}, ${input.slug}, ${input.status ?? "ACTIVE"})
              returning id, name, slug, null::text as description, status, created_at as "createdAt", updated_at as "updatedAt", deleted_at as "deletedAt"`,
      )).rows;
      const rawCreated = rows[0];
      if (!rawCreated) throw new Error("PostgreSQL did not return the created classification");
      const created = normalizeRecord(rawCreated);
      await transaction.insert(auditEntries).values(createAuditEntry({
        action: `${kind.toUpperCase()}_CREATED`, actorUserId, entityId: created.id,
        entityType: kind.toUpperCase(), changes: { after: created },
      }));
      return created;
    });
  }

  async update(kind: ClassificationKind, id: string, input: ClassificationPatch, actorUserId: string): Promise<ClassificationRecord | undefined> {
    if (kind === "category") return this.updateCategory(id, input, actorUserId);
    const table = this.table(kind);
    return this.database.client.transaction(async (transaction) => {
      const rawPrevious = (await transaction.execute<RawClassificationRecord>(
        sql`select id, name, slug, null::text as description,
          status, created_at as "createdAt", updated_at as "updatedAt", deleted_at as "deletedAt"
          from ${table} where ${table.id} = ${id} and ${table.deletedAt} is null for update`,
      )).rows[0];
      if (!rawPrevious) return undefined;
      const previous = normalizeRecord(rawPrevious);
      const nextStatus = input.status ?? previous.status;
      const rawUpdated = (await transaction.execute<RawClassificationRecord>(
        sql`update ${tags} set name = ${input.name ?? previous.name}, slug = ${input.slug ?? previous.slug},
              status = ${nextStatus}, updated_at = now() where id = ${id}
              returning id, name, slug, null::text as description, status, created_at as "createdAt", updated_at as "updatedAt", deleted_at as "deletedAt"`,
      )).rows[0];
      if (!rawUpdated) throw new Error("PostgreSQL did not return the updated classification");
      const updated = normalizeRecord(rawUpdated);
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
      if (kind === "category") await transaction.execute(sql`select pg_advisory_xact_lock(84110420262102::bigint)`);
      const rawPrevious = (await transaction.execute<RawClassificationRecord>(
        sql`select id, name, slug, ${kind === "category" ? sql`${categories.description}` : sql`null::text`} as description,
          status, created_at as "createdAt", updated_at as "updatedAt", deleted_at as "deletedAt" ${this.editorialProjection(kind)}
          from ${table} where ${table.id} = ${id} and ${table.deletedAt} is null for update`,
      )).rows[0];
      if (!rawPrevious) return false;
      const previous = normalizeRecord(rawPrevious);
      await transaction.execute(sql`update ${table} set status = 'INACTIVE', deleted_at = now(), updated_at = now()
        ${kind === "category" ? sql`, show_on_landing = false, landing_order = null` : sql``} where ${table.id} = ${id}`);
      await transaction.insert(auditEntries).values(createAuditEntry({
        action: `${kind.toUpperCase()}_DELETED`, actorUserId, entityId: id,
        entityType: kind.toUpperCase(), changes: { before: previous, after: { ...previous, ...(kind === "category" ? { showOnLanding: false, landingOrder: null } : {}), status: "INACTIVE", deleted: true } },
      }));
      return true;
    });
  }

  private table(kind: ClassificationKind): typeof categories | typeof tags {
    return kind === "category" ? categories : tags;
  }

  private editorialProjection(kind: ClassificationKind): SQL {
    return kind === "category" ? sql`, show_on_landing as "showOnLanding", landing_order as "landingOrder"` : sql``;
  }

  private async updateCategory(id: string, input: ClassificationPatch, actorUserId: string): Promise<ClassificationRecord | undefined> {
    return this.database.client.transaction(async (tx) => {
      // Serialize configuration commands before locking rows to avoid swap deadlocks.
      await tx.execute(sql`select pg_advisory_xact_lock(84110420262102::bigint)`);
      const [previous] = await tx.select().from(categories).where(sql`${categories.id} = ${id} and ${categories.deletedAt} is null`).for("update");
      if (!previous) return undefined;
      const nextStatus = input.status ?? previous.status;
      const showOnLanding = input.showOnLanding ?? previous.showOnLanding;
      if (showOnLanding && (input.showOnLanding === true || input.landingOrder !== undefined) && nextStatus !== "ACTIVE") {
        throw new BadRequestException({ code: "CATEGORY_LANDING_REQUIRES_ACTIVE", message: "Only active categories can be selected or reordered" });
      }
      if (!showOnLanding && input.landingOrder !== undefined && input.landingOrder !== null) {
        throw new BadRequestException({ code: "CATEGORY_LANDING_INVALID", message: "An unselected category cannot have a landing position" });
      }
      const selected = await tx.select().from(categories).where(eq(categories.showOnLanding, true));
      if (showOnLanding && !previous.showOnLanding && selected.length >= 3) {
        throw new ConflictException({ code: "CATEGORY_LANDING_LIMIT_EXCEEDED", message: "Select at most three categories" });
      }
      const landingOrder = showOnLanding
        ? (input.landingOrder === undefined ? previous.landingOrder ?? [1, 2, 3].find((position) => !selected.some((item) => item.landingOrder === position))! : input.landingOrder)
        : null;
      if (showOnLanding && landingOrder === null) {
        throw new BadRequestException({ code: "CATEGORY_LANDING_INVALID", message: "A selected category requires a landing position" });
      }
      const occupant = selected.find((item) => item.id !== id && item.landingOrder === landingOrder);
      if (occupant && !previous.showOnLanding) {
        throw new ConflictException({ code: "CATEGORY_LANDING_POSITION_OCCUPIED", message: "Choose an available landing position" });
      }
      if (occupant && occupant.status !== "ACTIVE") {
        throw new BadRequestException({ code: "CATEGORY_LANDING_REQUIRES_ACTIVE", message: "Remove the inactive category selection before reusing its position" });
      }
      const now = new Date();
      if (occupant) {
        // Release both slots only within this transaction; a failure restores the whole swap.
        await tx.update(categories).set({ showOnLanding: false, landingOrder: null }).where(sql`${categories.id} in (${id}, ${occupant.id})`);
        const [moved] = await tx.update(categories).set({ showOnLanding: true, landingOrder: previous.landingOrder, updatedAt: now })
          .where(eq(categories.id, occupant.id)).returning();
        await tx.insert(auditEntries).values(createAuditEntry({ action: "CATEGORY_UPDATED", actorUserId, entityId: occupant.id,
          entityType: "CATEGORY", changes: { before: occupant, after: moved } }));
      }
      const [updated] = await tx.update(categories).set({
        name: input.name ?? previous.name, slug: input.slug ?? previous.slug,
        description: input.description ?? previous.description, status: nextStatus,
        showOnLanding, landingOrder, updatedAt: now,
      }).where(eq(categories.id, id)).returning();
      if (!updated) throw new Error("PostgreSQL did not return the updated category");
      await tx.insert(auditEntries).values(createAuditEntry({ action: "CATEGORY_UPDATED", actorUserId, entityId: id,
        entityType: "CATEGORY", changes: { before: previous, after: updated } }));
      return updated;
    });
  }
}
