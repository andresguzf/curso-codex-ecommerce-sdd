import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";

import { DatabaseService } from "../database/database.service";
import {
  auditEntries,
  inventoryBalances,
  inventoryMovements,
} from "../database/schema";
import type {
  InventoryShortage,
  InventoryStockChange,
  InventoryStockItem,
  InventoryStockMovementType,
  InventoryStockReference,
} from "./inventory-stock.types";

const POSTGRES_INTEGER_MAX = 2_147_483_647;

export class InventoryStockUnavailableError extends Error {
  constructor(readonly shortages: readonly InventoryShortage[]) {
    super("There is not enough inventory to complete the operation");
    this.name = "InventoryStockUnavailableError";
  }
}

export class InventoryStockOverflowError extends Error {
  constructor(readonly productId: string) {
    super("The restored inventory exceeds the supported quantity");
    this.name = "InventoryStockOverflowError";
  }
}

@Injectable()
export class InventoryStockRepository {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  async deduct(
    items: readonly InventoryStockItem[],
    reference: InventoryStockReference,
  ): Promise<readonly InventoryStockChange[]> {
    return this.apply(items, reference, "SALE");
  }

  async restore(
    items: readonly InventoryStockItem[],
    reference: InventoryStockReference,
  ): Promise<readonly InventoryStockChange[]> {
    return this.apply(items, reference, "CANCELLATION");
  }

  private async apply(
    items: readonly InventoryStockItem[],
    reference: InventoryStockReference,
    movementType: InventoryStockMovementType,
  ): Promise<readonly InventoryStockChange[]> {
    return this.database.client.transaction(async (transaction) => {
      if (movementType === "CANCELLATION") {
        for (const item of items) {
          await transaction
            .insert(inventoryBalances)
            .values({ availableQuantity: 0, productId: item.productId })
            .onConflictDoNothing({ target: inventoryBalances.productId });
        }
      }

      const lockedBalances: Array<{
        availableQuantity: number;
        item: InventoryStockItem;
        version: number;
      }> = [];
      const shortages: InventoryShortage[] = [];

      // Callers provide an ascending, de-duplicated list so every transaction
      // acquires row locks in the same order and avoids lock-order inversion.
      for (const item of items) {
        const [balance] = await transaction
          .select({
            availableQuantity: inventoryBalances.availableQuantity,
            version: inventoryBalances.version,
          })
          .from(inventoryBalances)
          .where(eq(inventoryBalances.productId, item.productId))
          .for("update");

        const availableQuantity = balance?.availableQuantity ?? 0;
        if (movementType === "SALE" && availableQuantity < item.quantity) {
          shortages.push({
            availableQuantity,
            productId: item.productId,
            requestedQuantity: item.quantity,
          });
        }
        if (balance) lockedBalances.push({ ...balance, item });
      }

      if (shortages.length > 0) {
        throw new InventoryStockUnavailableError(shortages);
      }
      if (lockedBalances.length !== items.length) {
        throw new InventoryStockUnavailableError(
          items
            .filter(
              (item) =>
                !lockedBalances.some(
                  ({ item: lockedItem }) => lockedItem.productId === item.productId,
                ),
            )
            .map((item) => ({
              availableQuantity: 0,
              productId: item.productId,
              requestedQuantity: item.quantity,
            })),
        );
      }

      const changes: InventoryStockChange[] = [];
      for (const current of lockedBalances) {
        const quantityDelta =
          movementType === "SALE" ? -current.item.quantity : current.item.quantity;
        const availableQuantity = current.availableQuantity + quantityDelta;
        if (availableQuantity > POSTGRES_INTEGER_MAX) {
          throw new InventoryStockOverflowError(current.item.productId);
        }

        const [balance] = await transaction
          .update(inventoryBalances)
          .set({
            availableQuantity,
            updatedAt: new Date(),
            version: current.version + 1,
          })
          .where(eq(inventoryBalances.productId, current.item.productId))
          .returning({
            availableQuantity: inventoryBalances.availableQuantity,
            productId: inventoryBalances.productId,
            version: inventoryBalances.version,
          });
        if (!balance) throw new Error("PostgreSQL did not return the inventory balance");

        const [movement] = await transaction
          .insert(inventoryMovements)
          .values({
            actorUserId: reference.actorUserId,
            balanceAfter: balance.availableQuantity,
            productId: balance.productId,
            quantityDelta,
            reason: reference.reason,
            referenceId: reference.referenceId,
            referenceType: reference.referenceType,
            type: movementType,
          })
          .returning({ id: inventoryMovements.id });
        if (!movement) throw new Error("PostgreSQL did not return the inventory movement");

        await transaction.insert(auditEntries).values({
          action:
            movementType === "SALE"
              ? "INVENTORY_DEDUCTED"
              : "INVENTORY_RESTORED",
          actorUserId: reference.actorUserId,
          changes: {
            after: { availableQuantity: balance.availableQuantity },
            before: { availableQuantity: current.availableQuantity },
            movementId: movement.id,
            quantityDelta,
            reason: reference.reason,
            referenceId: reference.referenceId,
            referenceType: reference.referenceType,
          },
          entityId: balance.productId,
          entityType: "INVENTORY_BALANCE",
        });

        changes.push({ ...balance, movementId: movement.id });
      }

      return changes;
    });
  }
}

