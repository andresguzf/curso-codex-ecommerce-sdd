import { Inject, Injectable } from "@nestjs/common";
import { and, eq, isNull } from "drizzle-orm";

import { DatabaseService } from "../database/database.service";
import {
  auditEntries,
  inventoryBalances,
  inventoryMovements,
  products,
} from "../database/schema";
import type {
  InventoryAdjustmentInput,
  InventoryAdjustmentResult,
} from "./inventory-adjustment.types";

const POSTGRES_INTEGER_MAX = 2_147_483_647;

export class InsufficientInventoryError extends Error {
  constructor(readonly availableQuantity: number) {
    super("The inventory adjustment would produce a negative balance");
    this.name = "InsufficientInventoryError";
  }
}

export class InventoryQuantityOverflowError extends Error {
  constructor() {
    super("The inventory adjustment exceeds the supported quantity");
    this.name = "InventoryQuantityOverflowError";
  }
}

@Injectable()
export class InventoryAdjustmentRepository {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  async adjust(
    productId: string,
    input: InventoryAdjustmentInput,
    actorUserId: string,
  ): Promise<InventoryAdjustmentResult | undefined> {
    return this.database.client.transaction(async (transaction) => {
      const [product] = await transaction
        .select({ id: products.id })
        .from(products)
        .where(and(eq(products.id, productId), isNull(products.deletedAt)))
        .limit(1);
      if (!product) return undefined;

      await transaction
        .insert(inventoryBalances)
        .values({ availableQuantity: 0, productId })
        .onConflictDoNothing({ target: inventoryBalances.productId });

      const [current] = await transaction
        .select({
          availableQuantity: inventoryBalances.availableQuantity,
          version: inventoryBalances.version,
        })
        .from(inventoryBalances)
        .where(eq(inventoryBalances.productId, productId))
        .for("update");
      if (!current) throw new Error("The product inventory balance could not be initialized");

      const availableQuantity = current.availableQuantity + input.quantityDelta;
      if (availableQuantity < 0) {
        throw new InsufficientInventoryError(current.availableQuantity);
      }
      if (availableQuantity > POSTGRES_INTEGER_MAX) {
        throw new InventoryQuantityOverflowError();
      }

      const now = new Date();
      const [balance] = await transaction
        .update(inventoryBalances)
        .set({
          availableQuantity,
          updatedAt: now,
          version: current.version + 1,
        })
        .where(eq(inventoryBalances.productId, productId))
        .returning({
          availableQuantity: inventoryBalances.availableQuantity,
          productId: inventoryBalances.productId,
          updatedAt: inventoryBalances.updatedAt,
          version: inventoryBalances.version,
        });
      if (!balance) throw new Error("PostgreSQL did not return the adjusted balance");

      const [movement] = await transaction
        .insert(inventoryMovements)
        .values({
          actorUserId,
          balanceAfter: balance.availableQuantity,
          productId,
          quantityDelta: input.quantityDelta,
          reason: input.reason,
          type: "ADJUSTMENT",
        })
        .returning({
          actorUserId: inventoryMovements.actorUserId,
          balanceAfter: inventoryMovements.balanceAfter,
          createdAt: inventoryMovements.createdAt,
          id: inventoryMovements.id,
          productId: inventoryMovements.productId,
          quantityDelta: inventoryMovements.quantityDelta,
          reason: inventoryMovements.reason,
          type: inventoryMovements.type,
        });
      if (!movement || !movement.actorUserId || movement.type !== "ADJUSTMENT") {
        throw new Error("PostgreSQL did not return the inventory movement");
      }

      await transaction.insert(auditEntries).values({
        action: "INVENTORY_ADJUSTED",
        actorUserId,
        changes: {
          after: { availableQuantity: balance.availableQuantity },
          before: { availableQuantity: current.availableQuantity },
          movementId: movement.id,
          quantityDelta: input.quantityDelta,
          reason: input.reason,
        },
        entityId: productId,
        entityType: "INVENTORY_BALANCE",
      });

      return { ...balance, movement: { ...movement, actorUserId, type: "ADJUSTMENT" } };
    });
  }
}
