import { Inject, Injectable } from "@nestjs/common";

import { InventoryStockRepository } from "./inventory-stock.repository";
import type {
  InventoryStockChange,
  InventoryStockItem,
  InventoryStockReference,
} from "./inventory-stock.types";

export function normalizeInventoryStockItems(
  items: readonly InventoryStockItem[],
): readonly InventoryStockItem[] {
  if (items.length === 0) throw new TypeError("At least one inventory item is required");

  const quantities = new Map<string, number>();
  for (const item of items) {
    const productId = item.productId.trim();
    if (productId.length === 0) throw new TypeError("Product id cannot be blank");
    if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0) {
      throw new TypeError("Inventory quantity must be a positive safe integer");
    }
    const quantity = (quantities.get(productId) ?? 0) + item.quantity;
    if (!Number.isSafeInteger(quantity) || quantity > 2_147_483_647) {
      throw new TypeError("Consolidated inventory quantity is too large");
    }
    quantities.set(productId, quantity);
  }

  return [...quantities]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([productId, quantity]) => ({ productId, quantity }));
}

function normalizeReference(
  reference: InventoryStockReference,
): InventoryStockReference {
  const reason = reference.reason.trim();
  const referenceId = reference.referenceId.trim();
  const referenceType = reference.referenceType.trim();
  if (!reason || !referenceId || !referenceType) {
    throw new TypeError("Inventory movement reference fields cannot be blank");
  }
  return { ...reference, reason, referenceId, referenceType };
}

@Injectable()
export class InventoryStockService {
  constructor(
    @Inject(InventoryStockRepository)
    private readonly repository: InventoryStockRepository,
  ) {}

  deduct(
    items: readonly InventoryStockItem[],
    reference: InventoryStockReference,
  ): Promise<readonly InventoryStockChange[]> {
    return this.repository.deduct(
      normalizeInventoryStockItems(items),
      normalizeReference(reference),
    );
  }

  restore(
    items: readonly InventoryStockItem[],
    reference: InventoryStockReference,
  ): Promise<readonly InventoryStockChange[]> {
    return this.repository.restore(
      normalizeInventoryStockItems(items),
      normalizeReference(reference),
    );
  }
}

