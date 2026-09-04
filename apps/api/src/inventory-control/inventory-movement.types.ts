export const INVENTORY_MOVEMENT_TYPES = [
  "OPENING",
  "ADJUSTMENT",
  "SALE",
  "CANCELLATION",
] as const;

export type InventoryMovementType = (typeof INVENTORY_MOVEMENT_TYPES)[number];

export type InventoryMovementActor = Readonly<{
  id: string;
  displayName: string;
  email: string;
}>;

export type InventoryMovementItem = Readonly<{
  id: string;
  productId: string;
  type: InventoryMovementType;
  quantityDelta: number;
  balanceAfter: number;
  reason: string;
  referenceType: string | null;
  referenceId: string | null;
  actor: InventoryMovementActor | null;
  createdAt: Date;
}>;

export type InventoryMovementPage = Readonly<{
  items: readonly InventoryMovementItem[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}>;
