import { Inject, Injectable } from "@nestjs/common";
import { and, asc, count, desc, eq, gte, ilike, isNull, lte, or } from "drizzle-orm";

import { DatabaseService } from "../database/database.service.js";
import { inventoryMovements, products, users } from "../database/schema/index.js";
import type { InventoryMovementPage, InventoryMovementQuery } from "./inventory-movement.types.js";

function escapeLikePattern(value: string): string {
  return `%${value.replace(/[\\%_]/g, "\\$&")}%`;
}

@Injectable()
export class InventoryMovementRepository {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  async listByProduct(
    productId: string,
    query: InventoryMovementQuery,
  ): Promise<InventoryMovementPage | undefined> {
    return this.database.client.transaction(async (transaction) => {
      const [product] = await transaction
        .select({ id: products.id })
        .from(products)
        .where(and(eq(products.id, productId), isNull(products.deletedAt)))
        .limit(1);
      if (!product) return undefined;

      const conditions = [eq(inventoryMovements.productId, productId)];
      if (query.type) conditions.push(eq(inventoryMovements.type, query.type));
      if (query.createdFrom) conditions.push(gte(inventoryMovements.createdAt, new Date(query.createdFrom)));
      if (query.createdTo) conditions.push(lte(inventoryMovements.createdAt, new Date(query.createdTo)));
      if (query.search) {
        const pattern = escapeLikePattern(query.search);
        conditions.push(or(
          ilike(inventoryMovements.reason, pattern),
          ilike(inventoryMovements.referenceId, pattern),
          ilike(users.displayName, pattern),
          ilike(users.email, pattern),
        )!);
      }
      const where = and(...conditions);
      const [{ totalItems = 0 } = {}] = await transaction
        .select({ totalItems: count() })
        .from(inventoryMovements)
        .leftJoin(users, eq(users.id, inventoryMovements.actorUserId))
        .where(where);
      const sortColumn = {
        createdAt: inventoryMovements.createdAt,
        type: inventoryMovements.type,
        quantityDelta: inventoryMovements.quantityDelta,
        balanceAfter: inventoryMovements.balanceAfter,
      }[query.sortBy];
      const direction = query.sortOrder === "asc" ? asc : desc;
      const rows = await transaction
        .select({
          actorDisplayName: users.displayName,
          actorEmail: users.email,
          actorUserId: inventoryMovements.actorUserId,
          balanceAfter: inventoryMovements.balanceAfter,
          createdAt: inventoryMovements.createdAt,
          id: inventoryMovements.id,
          productId: inventoryMovements.productId,
          quantityDelta: inventoryMovements.quantityDelta,
          reason: inventoryMovements.reason,
          referenceId: inventoryMovements.referenceId,
          referenceType: inventoryMovements.referenceType,
          type: inventoryMovements.type,
        })
        .from(inventoryMovements)
        .leftJoin(users, eq(users.id, inventoryMovements.actorUserId))
        .where(where)
        .orderBy(direction(sortColumn), direction(inventoryMovements.id))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize);

      return {
        items: rows.map((row) => ({
          actor:
            row.actorUserId && row.actorDisplayName && row.actorEmail
              ? { displayName: row.actorDisplayName, email: row.actorEmail, id: row.actorUserId }
              : null,
          balanceAfter: row.balanceAfter,
          createdAt: row.createdAt,
          id: row.id,
          productId: row.productId,
          quantityDelta: row.quantityDelta,
          reason: row.reason,
          referenceId: row.referenceId,
          referenceType: row.referenceType,
          type: row.type,
        })),
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / query.pageSize),
      };
    }, { isolationLevel: "repeatable read", accessMode: "read only" });
  }
}
