export type InventoryAdjustmentInput = Readonly<{
  quantityDelta: number;
  reason: string;
}>;

export type InventoryAdjustmentMovement = Readonly<{
  id: string;
  productId: string;
  type: "ADJUSTMENT";
  quantityDelta: number;
  balanceAfter: number;
  reason: string;
  actorUserId: string;
  createdAt: Date;
}>;

export type InventoryAdjustmentResult = Readonly<{
  productId: string;
  availableQuantity: number;
  version: number;
  updatedAt: Date;
  movement: InventoryAdjustmentMovement;
}>;
