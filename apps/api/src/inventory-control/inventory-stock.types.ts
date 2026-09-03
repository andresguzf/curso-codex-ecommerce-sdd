export type InventoryStockItem = Readonly<{
  productId: string;
  quantity: number;
}>;

export type InventoryStockReference = Readonly<{
  actorUserId?: string;
  reason: string;
  referenceId: string;
  referenceType: string;
}>;

export type InventoryStockMovementType = "SALE" | "CANCELLATION";

export type InventoryStockChange = Readonly<{
  availableQuantity: number;
  movementId: string;
  productId: string;
  version: number;
}>;

export type InventoryShortage = Readonly<{
  availableQuantity: number;
  productId: string;
  requestedQuantity: number;
}>;

