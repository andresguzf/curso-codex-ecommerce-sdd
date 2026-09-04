import { Inject, Injectable } from "@nestjs/common";
import { and, count, desc, eq, isNull } from "drizzle-orm";

import { DatabaseService } from "../database/database.service";
import { inventoryMovements, products, users } from "../database/schema";
import type { InventoryMovementPage } from "./inventory-movement.types";

@Injectable()
export class InventoryMovementRepository {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  async listByProduct(
    productId: string,
    page: number,
    pageSize: number,
  ): Promise<InventoryMovementPage | undefined> {
    const [product] = await this.database.client
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.id, productId), isNull(products.deletedAt)))
      .limit(1);
    if (!product) return undefined;

    const [{ totalItems = 0 } = {}] = await this.database.client
      .select({ totalItems: count() })
      .from(inventoryMovements)
      .where(eq(inventoryMovements.productId, productId));
    const rows = await this.database.client
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
      .where(eq(inventoryMovements.productId, productId))
      .orderBy(desc(inventoryMovements.createdAt), desc(inventoryMovements.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    return {
      items: rows.map((row) => ({
        actor:
          row.actorUserId && row.actorDisplayName && row.actorEmail
            ? {
                displayName: row.actorDisplayName,
                email: row.actorEmail,
                id: row.actorUserId,
              }
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
      page,
      pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / pageSize),
    };
  }
}
